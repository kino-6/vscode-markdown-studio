# 要件定義書

## はじめに

Markdownファイルの保存時にPDFエクスポートを自動実行する「ウォッチモード」機能。編集のたびに手動で「Export PDF」コマンドを実行する手間を省き、ライティングワークフローを効率化する。

## 用語集

- **Auto_Export_Engine**: 保存イベントを監視し、デバウンス処理を経てPDFエクスポートを自動トリガーするモジュール
- **Status_Bar_Item**: VS Codeステータスバーに表示される自動エクスポートのON/OFF状態インジケーター
- **Debounce_Timer**: 連続保存時に最後の保存のみエクスポートをトリガーするための遅延タイマー
- **Export_Registry**: 手動エクスポート済みファイル、または自動エクスポート対象として明示的に設定されたファイルを追跡する仕組み
- **Export_Engine**: 既存のPDFエクスポート処理（`exportToPdf`関数）を実行するモジュール
- **Progress_Notification**: エクスポート進捗を表示するVS Code通知UI（既存のプログレスUIを再利用）

## 要件

### 要件 1: 自動エクスポート設定

**ユーザーストーリー:** 開発者として、自動エクスポート機能のON/OFFを設定で切り替えたい。手動エクスポートのみ使いたい場合に不要な処理が走らないようにするため。

#### 受け入れ基準

1. THE Extension SHALL provide a boolean setting `markdownStudio.export.autoExport` with a default value of `false`
2. WHEN the `markdownStudio.export.autoExport` setting is changed to `true`, THE Auto_Export_Engine SHALL begin monitoring Markdown file save events
3. WHEN the `markdownStudio.export.autoExport` setting is changed to `false`, THE Auto_Export_Engine SHALL stop monitoring Markdown file save events and cancel any pending Debounce_Timer

### 要件 2: 保存時の自動PDFエクスポート

**ユーザーストーリー:** 開発者として、Markdownファイルを保存するだけでPDFが自動生成されるようにしたい。編集と確認のサイクルを高速化するため。

#### 受け入れ基準

1. WHEN a `.md` file is saved AND `markdownStudio.export.autoExport` is `true`, THE Auto_Export_Engine SHALL trigger a PDF export for the saved document
2. THE Auto_Export_Engine SHALL pass the saved document to the existing Export_Engine (`exportToPdf` function)
3. THE Auto_Export_Engine SHALL respect all existing export settings including page format, header/footer templates, PDF index, bookmarks, style preset, theme, custom CSS, and output filename template

### 要件 3: デバウンス処理

**ユーザーストーリー:** 開発者として、短時間に複数回保存しても最後の保存のみがエクスポートをトリガーするようにしたい。不要なエクスポート処理によるリソース消費を防ぐため。

#### 受け入れ基準

1. WHEN multiple save events occur for the same file within the debounce interval, THE Auto_Export_Engine SHALL cancel all previous pending exports and execute only the export triggered by the last save event
2. THE Auto_Export_Engine SHALL use a debounce interval of 1000 milliseconds
3. WHEN a save event occurs for a different file while a Debounce_Timer is active for another file, THE Auto_Export_Engine SHALL manage each file's Debounce_Timer independently

### 要件 4: プログレス通知

**ユーザーストーリー:** 開発者として、自動エクスポートの進捗状況を確認したい。エクスポートが実行中であることを把握するため。

#### 受け入れ基準

1. WHEN the Auto_Export_Engine starts a PDF export, THE Progress_Notification SHALL display the export progress using the existing notification-based progress UI
2. WHEN the PDF export completes successfully, THE Progress_Notification SHALL display the output file path
3. THE Progress_Notification SHALL be non-blocking so that the user can continue editing during auto-export

### 要件 5: エラーハンドリング

**ユーザーストーリー:** 開発者として、自動エクスポートが失敗してもファイル保存がブロックされないようにしたい。エクスポートエラーが編集作業を妨げないようにするため。

#### 受け入れ基準

1. IF the auto-export fails, THEN THE Auto_Export_Engine SHALL display an error notification with the failure reason
2. IF the auto-export fails, THEN THE Auto_Export_Engine SHALL allow the file save to complete without interruption
3. IF a previous auto-export is still running when a new save event triggers another export, THEN THE Auto_Export_Engine SHALL cancel the in-progress export before starting the new one

### 要件 6: ステータスバー表示

**ユーザーストーリー:** 開発者として、自動エクスポートが有効かどうかをステータスバーで一目で確認したい。現在の状態を素早く把握するため。

#### 受け入れ基準

1. WHILE `markdownStudio.export.autoExport` is `true`, THE Status_Bar_Item SHALL display "Auto-export: ON" in the VS Code status bar
2. WHILE `markdownStudio.export.autoExport` is `false`, THE Status_Bar_Item SHALL be hidden from the VS Code status bar
3. WHEN the user clicks the Status_Bar_Item, THE Extension SHALL toggle the `markdownStudio.export.autoExport` setting
4. WHEN the `markdownStudio.export.autoExport` setting changes, THE Status_Bar_Item SHALL update its visibility and text within 100 milliseconds

### 要件 7: エクスポート対象ファイルの制限

**ユーザーストーリー:** 開発者として、すべてのMarkdownファイルではなく、意図的にエクスポート対象としたファイルのみ自動エクスポートされるようにしたい。不要なPDF生成を防ぐため。

#### 受け入れ基準

1. WHEN a `.md` file is saved AND `markdownStudio.export.autoExport` is `true`, THE Auto_Export_Engine SHALL trigger auto-export only if the file has been manually exported at least once during the current VS Code session OR the file's workspace folder contains a `.markdownstudio` configuration indicating auto-export eligibility
2. WHEN a manual PDF export is executed via the "Export PDF" command, THE Export_Registry SHALL register the exported file as eligible for auto-export
3. WHEN VS Code is restarted, THE Export_Registry SHALL clear the session-based export history
4. IF a `.md` file is saved that has not been registered in the Export_Registry, THEN THE Auto_Export_Engine SHALL skip the auto-export silently without displaying any notification
