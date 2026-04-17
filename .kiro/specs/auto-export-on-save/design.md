# 設計書: 保存時自動エクスポート (Auto-Export on Save)

## 概要

Markdownファイルの保存時にPDFエクスポートを自動実行する「ウォッチモード」機能の設計。既存の `exportToPdf` 関数を再利用し、デバウンス処理・エクスポート対象管理・ステータスバー表示を新規モジュールとして追加する。

## アーキテクチャ

### 新規モジュール構成

```
src/
  autoExport/
    autoExportEngine.ts    # 保存イベント監視・デバウンス・エクスポートトリガー
    exportRegistry.ts      # エクスポート対象ファイル管理（セッションベース）
    statusBarItem.ts       # ステータスバーUI管理
```

### コンポーネント間の関係

```
extension.ts (activate)
  ├── AutoExportEngine
  │     ├── onDidSaveTextDocument listener
  │     ├── debounce timers (per-file Map)
  │     ├── ExportRegistry (eligibility check)
  │     └── exportToPdf (既存関数を呼び出し)
  ├── ExportRegistry
  │     ├── session-based Set<string> (file paths)
  │     └── .markdownstudio config check
  └── StatusBarItem
        ├── vscode.StatusBarItem
        └── toggleAutoExport command
```

## 詳細設計

### 1. ExportRegistry (`src/autoExport/exportRegistry.ts`)

エクスポート対象ファイルの追跡を管理するモジュール。

```typescript
import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Tracks files eligible for auto-export.
 * A file becomes eligible when:
 * 1. It has been manually exported via "Export PDF" command during the current session, OR
 * 2. Its workspace folder contains a `.markdownstudio` configuration file
 *
 * Session-based history is cleared on VS Code restart (in-memory Set).
 */
export class ExportRegistry {
  private readonly sessionExports: Set<string> = new Set();

  /**
   * Register a file as eligible for auto-export.
   * Called after a successful manual "Export PDF" command.
   */
  register(filePath: string): void {
    this.sessionExports.add(filePath);
  }

  /**
   * Check whether a file is eligible for auto-export.
   * Returns true if the file was manually exported this session
   * OR if a `.markdownstudio` file exists in the file's workspace folder.
   */
  async isEligible(filePath: string): Promise<boolean> {
    if (this.sessionExports.has(filePath)) {
      return true;
    }
    return this.hasWorkspaceConfig(filePath);
  }

  /**
   * Check if a `.markdownstudio` config file exists in the workspace folder
   * containing the given file.
   */
  private async hasWorkspaceConfig(filePath: string): Promise<boolean> {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(
      vscode.Uri.file(filePath)
    );
    if (!workspaceFolder) {
      return false;
    }
    const configPath = path.join(workspaceFolder.uri.fsPath, '.markdownstudio');
    try {
      await fs.access(configPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Clear all session-based export history.
   * (Implicitly happens on VS Code restart since the Set is in-memory.)
   */
  clear(): void {
    this.sessionExports.clear();
  }

  /** Check if a file is in the session-based registry (for testing). */
  hasSession(filePath: string): boolean {
    return this.sessionExports.has(filePath);
  }
}
```

### 2. AutoExportEngine (`src/autoExport/autoExportEngine.ts`)

保存イベントの監視、デバウンス処理、エクスポートトリガーを管理するモジュール。

```typescript
import * as vscode from 'vscode';
import { exportToPdf, ProgressReporter, CancellationChecker, CancellationError } from '../export/exportPdf';
import { ExportRegistry } from './exportRegistry';

const DEBOUNCE_INTERVAL_MS = 1000;

interface PendingExport {
  timer: ReturnType<typeof setTimeout>;
  cancellation?: { cancel(): void };
}

/**
 * Monitors Markdown file save events and triggers PDF export
 * with debounce logic. Each file has an independent debounce timer.
 */
export class AutoExportEngine {
  private saveListener: vscode.Disposable | undefined;
  private readonly pendingExports: Map<string, PendingExport> = new Map();
  private readonly registry: ExportRegistry;
  private readonly context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext, registry: ExportRegistry) {
    this.context = context;
    this.registry = registry;
  }

  /** Start monitoring save events. */
  start(): void {
    if (this.saveListener) return; // already monitoring
    this.saveListener = vscode.workspace.onDidSaveTextDocument(
      (document) => this.onDocumentSaved(document)
    );
  }

  /** Stop monitoring and cancel all pending exports. */
  stop(): void {
    this.saveListener?.dispose();
    this.saveListener = undefined;
    for (const [, pending] of this.pendingExports) {
      clearTimeout(pending.timer);
      pending.cancellation?.cancel();
    }
    this.pendingExports.clear();
  }

  /** Handle a document save event with debounce. */
  private async onDocumentSaved(document: vscode.TextDocument): Promise<void> {
    if (document.languageId !== 'markdown') return;

    const filePath = document.uri.fsPath;

    // Check eligibility (Requirement 7)
    const eligible = await this.registry.isEligible(filePath);
    if (!eligible) return; // skip silently

    // Cancel any pending export for this file (debounce)
    const existing = this.pendingExports.get(filePath);
    if (existing) {
      clearTimeout(existing.timer);
      existing.cancellation?.cancel();
    }

    // Set new debounce timer
    const timer = setTimeout(() => {
      this.pendingExports.delete(filePath);
      void this.executeExport(document);
    }, DEBOUNCE_INTERVAL_MS);

    this.pendingExports.set(filePath, { timer });
  }

  /** Execute the PDF export with progress notification. */
  private async executeExport(document: vscode.TextDocument): Promise<void> {
    const filePath = document.uri.fsPath;
    let cancelled = false;
    const cancellationSource = {
      cancel() { cancelled = true; },
    };

    // Store cancellation handle so a subsequent save can cancel this export
    const pending = this.pendingExports.get(filePath);
    if (pending) {
      pending.cancellation = cancellationSource;
    }

    try {
      const outputPath = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Markdown Studio: Auto-exporting PDF',
          cancellable: true,
        },
        async (progress, token) => {
          const reporter: ProgressReporter = {
            report(message: string, increment?: number) {
              progress.report({ message, increment });
            },
          };
          const cancellation: CancellationChecker = {
            isCancelled() {
              return token.isCancellationRequested || cancelled;
            },
          };
          return exportToPdf(document, this.context, reporter, cancellation);
        }
      );
      void vscode.window.showInformationMessage(
        `Markdown Studio: Auto-exported PDF to ${outputPath}`
      );
    } catch (error) {
      if (error instanceof CancellationError) return;
      void vscode.window.showErrorMessage(
        `Markdown Studio: Auto-export failed: ${String(error)}`
      );
    }
  }

  /** Dispose all resources. */
  dispose(): void {
    this.stop();
  }
}
```

### 3. StatusBarItem (`src/autoExport/statusBarItem.ts`)

ステータスバーのON/OFF表示とトグル操作を管理するモジュール。

```typescript
import * as vscode from 'vscode';

const TOGGLE_COMMAND = 'markdownStudio.toggleAutoExport';

/**
 * Manages the status bar item that shows auto-export state.
 * Visible only when auto-export is enabled.
 */
export class AutoExportStatusBar {
  private readonly item: vscode.StatusBarItem;
  private readonly configListener: vscode.Disposable;

  constructor() {
    this.item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    this.item.command = TOGGLE_COMMAND;
    this.item.text = '$(file-pdf) Auto-export: ON';
    this.item.tooltip = 'Click to disable auto-export';

    // Listen for configuration changes
    this.configListener = vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('markdownStudio.export.autoExport')) {
        this.update();
      }
    });

    this.update();
  }

  /** Update visibility based on current setting. */
  update(): void {
    const enabled = vscode.workspace
      .getConfiguration('markdownStudio')
      .get<boolean>('export.autoExport', false);

    if (enabled) {
      this.item.text = '$(file-pdf) Auto-export: ON';
      this.item.show();
    } else {
      this.item.hide();
    }
  }

  /** Dispose the status bar item and config listener. */
  dispose(): void {
    this.configListener.dispose();
    this.item.dispose();
  }
}
```

### 4. Extension統合 (`src/extension.ts` への変更)

```typescript
// activate() 内に追加:

import { AutoExportEngine } from './autoExport/autoExportEngine';
import { ExportRegistry } from './autoExport/exportRegistry';
import { AutoExportStatusBar } from './autoExport/statusBarItem';

// activate() 内:
const exportRegistry = new ExportRegistry();
const autoExportEngine = new AutoExportEngine(context, exportRegistry);
const autoExportStatusBar = new AutoExportStatusBar();

// 設定に基づいて初期状態を設定
const autoExportEnabled = vscode.workspace
  .getConfiguration('markdownStudio')
  .get<boolean>('export.autoExport', false);
if (autoExportEnabled) {
  autoExportEngine.start();
}

// 設定変更の監視
const configWatcher = vscode.workspace.onDidChangeConfiguration((e) => {
  if (e.affectsConfiguration('markdownStudio.export.autoExport')) {
    const enabled = vscode.workspace
      .getConfiguration('markdownStudio')
      .get<boolean>('export.autoExport', false);
    if (enabled) {
      autoExportEngine.start();
    } else {
      autoExportEngine.stop();
    }
  }
});

// toggleAutoExport コマンド登録
context.subscriptions.push(
  vscode.commands.registerCommand('markdownStudio.toggleAutoExport', async () => {
    const cfg = vscode.workspace.getConfiguration('markdownStudio');
    const current = cfg.get<boolean>('export.autoExport', false);
    await cfg.update('export.autoExport', !current, vscode.ConfigurationTarget.Workspace);
  }),
  autoExportEngine,
  autoExportStatusBar,
  configWatcher,
);

// 既存の exportPdf コマンド内で、エクスポート成功後にレジストリに登録:
// exportPdfCommand 内の成功パスに追加:
//   exportRegistry.register(editor.document.uri.fsPath);
```

### 5. package.json への変更

```json
{
  "contributes": {
    "commands": [
      {
        "command": "markdownStudio.toggleAutoExport",
        "title": "Markdown Studio: Toggle Auto-Export"
      }
    ],
    "configuration": {
      "properties": {
        "markdownStudio.export.autoExport": {
          "type": "boolean",
          "default": false,
          "description": "Markdownファイル保存時にPDFを自動エクスポートする。対象はセッション中に手動エクスポートしたファイル、または.markdownstudio設定ファイルがあるワークスペースのファイルに限定。"
        }
      }
    }
  }
}
```

## Correctness Properties

### Property 1: Debounce Consolidation

For any sequence of N (N ≥ 1) save events for the same file within the debounce interval (1000ms), exactly 1 export is triggered.

**Validates:** Requirements 3.1, 3.2

### Property 2: Per-File Timer Independence

For any two distinct files A and B, a save event for file A does not affect the debounce timer or export execution for file B, and vice versa.

**Validates:** Requirements 3.3

### Property 3: Registry Eligibility Consistency

For any file path P, after `register(P)` is called, `isEligible(P)` always returns `true` for the remainder of the session. Before registration and without a `.markdownstudio` config, `isEligible(P)` returns `false`.

**Validates:** Requirements 7.1, 7.2, 7.3, 7.4

### Property 4: Engine State Consistency

Calling `start()` when already started is idempotent (no duplicate listeners). Calling `stop()` clears all pending timers and the save listener. After `stop()`, no save events trigger exports.

**Validates:** Requirements 1.2, 1.3

## エラーハンドリング

- `exportToPdf` が例外をスローした場合、`CancellationError` 以外はエラー通知として表示
- 保存イベントハンドラは非同期で実行されるため、ファイル保存自体はブロックされない
- デバウンスタイマー中に新しい保存が発生した場合、前のタイマーをキャンセルして新しいタイマーを設定

## 制約事項

- セッションベースのレジストリはVS Code再起動でクリアされる（意図的な設計）
- `.markdownstudio` ファイルの存在チェックは `fs.access` で行い、ファイル内容は読まない
- 自動エクスポートは `onDidSaveTextDocument`（保存完了後）で発火するため、保存処理自体には影響しない
