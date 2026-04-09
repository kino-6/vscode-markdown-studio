# 実装計画: プレビューテーマ自動切り替え

## 概要

VS Codeのカラーテーマ種別に連動してプレビューパネルの外観を自動切り替えする機能を実装する。既存のCSS変数ベースのダークモード対応を活用し、手動オーバーライド設定、Mermaid/highlight.js連動、PDF出力の分離を段階的に実装する。

## タスク

- [x] 1. データモデルと設定の追加
  - [x] 1.1 `PreviewThemeMode` 型を `src/types/models.ts` に追加
    - `export type PreviewThemeMode = 'auto' | 'light' | 'dark';` を定義
    - _Requirements: 6.1_

  - [x] 1.2 `package.json` に `markdownStudio.preview.theme` 設定を追加
    - `contributes.configuration.properties` に `markdownStudio.preview.theme` を追加
    - `type: "string"`, `default: "auto"`, `enum: ["auto", "light", "dark"]`
    - 日本語の `enumDescriptions` と `description` を設定
    - _Requirements: 6.1, 6.5_

  - [x] 1.3 `src/infra/config.ts` の `MarkdownStudioConfig` に `previewTheme` フィールドを追加
    - `getConfig()` で `cfg.get<PreviewThemeMode>('preview.theme', 'auto')` を読み取り
    - _Requirements: 6.1, 6.5_

  - [ ]* 1.4 `getConfig()` の `previewTheme` デフォルト値テストを `test/unit/config.test.ts` に追加
    - デフォルト値が `'auto'` であることを検証
    - _Requirements: 6.5_

- [x] 2. Webview側テーマ適用ロジックの実装
  - [x] 2.1 `media/preview.js` に `resolveEffectiveThemeKind` 関数を追加
    - オーバーライド値（`auto` / `light` / `dark`）とVS Codeテーマ種別から有効なテーマ種別を決定
    - `auto` の場合は `detectThemeKind()` の結果を返す
    - `light` の場合は `'vscode-light'` を返す
    - `dark` の場合は `'vscode-dark'` を返す
    - _Requirements: 6.2, 6.3, 6.4_

  - [x] 2.2 `media/preview.js` に `applyThemeClass` 関数を追加
    - bodyから既存テーマクラス（`vscode-light`, `vscode-dark`, `vscode-high-contrast`, `vscode-high-contrast-light`）を除去
    - 新しいテーマ種別のクラスを追加
    - _Requirements: 1.3, 1.4, 2.1, 2.2, 2.3, 2.4_

  - [x] 2.3 `media/preview.js` に `onThemeChanged` 関数を追加
    - `applyThemeClass` でbodyクラスを更新
    - Mermaid再初期化（`mermaid.initialize` + `renderMermaidBlocks`）
    - _Requirements: 3.1, 3.2, 5.2_

  - [x] 2.4 `media/preview.js` の `window.addEventListener('message')` に `theme-override` メッセージハンドラを追加
    - `currentOverride` 変数を管理し、`onThemeChanged(resolveEffectiveThemeKind(currentOverride))` を呼び出す
    - _Requirements: 6.6_

  - [x] 2.5 `media/preview.js` の `observeThemeChanges` コールバックを更新
    - オーバーライドモード（`light` / `dark`）時はVS Codeテーマ変更を無視
    - `auto` モード時のみ `onThemeChanged` を呼び出す
    - _Requirements: 5.1, 5.3, 6.2_

  - [x] 2.6 `media/preview.js` の `initPreview` を更新
    - 初期化時に `body` の `data-theme-override` 属性を読み取り `currentOverride` を設定
    - `resolveEffectiveThemeKind` で初期テーマを決定し `applyThemeClass` を適用
    - 新しい関数を `export` に追加
    - _Requirements: 1.1, 1.2_

  - [ ]* 2.7 `resolveEffectiveThemeKind` のプロパティテストを作成
    - **Property 1: テーマオーバーライド解決の正当性**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4**
    - ファイル: `test/unit/previewTheme.property.test.ts`

  - [ ]* 2.8 `getMermaidTheme` のプロパティテストを作成
    - **Property 3: Mermaidテーママッピングの一貫性**
    - **Validates: Requirements 3.1, 3.3**
    - ファイル: `test/unit/previewTheme.property.test.ts`

  - [ ]* 2.9 `detectThemeKind` と `resolveEffectiveThemeKind` のユニットテストを作成
    - 4種類のテーマ種別の正しい識別を検証
    - 不明な属性値でのフォールバック動作を検証
    - ファイル: `test/unit/previewTheme.test.ts`
    - _Requirements: 1.1, 1.2_

- [x] 3. Extension Host側のオーバーライド伝達
  - [x] 3.1 `src/preview/buildHtml.ts` の `buildHtml` 関数を更新
    - `<body>` タグに `data-theme-override` 属性を追加（`config.previewTheme` の値）
    - Webview コンテキスト時: 設定値をそのまま埋め込む
    - PDF コンテキスト（`webview === undefined`）時: 常に `"light"` を埋め込む
    - _Requirements: 6.2, 6.3, 6.4, 7.1_

  - [x] 3.2 `src/preview/webviewPanel.ts` の設定変更リスナーを更新
    - `markdownStudio.preview.theme` の変更を検出
    - 変更時に `currentPanel.webview.postMessage({ type: 'theme-override', value: cfg.previewTheme })` を送信
    - _Requirements: 6.6_

- [x] 4. チェックポイント - テーマ切り替え基本動作の確認
  - すべてのテストが通ることを確認し、不明点があればユーザーに質問する。

- [x] 5. PDF出力のライトモード分離
  - [x] 5.1 `src/export/exportPdf.ts` に `page.evaluate()` でbodyクラスリセットを追加
    - `page.setContent` 後に `document.body.classList.remove('vscode-dark', 'vscode-high-contrast')` を実行
    - `document.body.classList.add('vscode-light')` を実行
    - 2パスレンダリング（PDF Index）の両方のパスで適用
    - _Requirements: 7.1, 7.2, 7.3_

  - [ ]* 5.2 PDF出力のライトモード固定プロパティテストを作成
    - **Property 2: PDF出力のライトモード固定**
    - **Validates: Requirements 7.1, 7.2**
    - `buildHtml` をPDFコンテキスト（`webview === undefined`）で呼び出し、生成HTMLに `vscode-dark` / `vscode-high-contrast` クラスが含まれないことを検証
    - ファイル: `test/unit/previewTheme.property.test.ts`

- [x] 6. ビルトインテーマの互換性確認
  - [x] 6.1 ビルトインテーマCSS（`media/themes/modern.css`, `markdown-pdf.css`, `minimal.css`）に `body.vscode-dark` セレクタが存在することを確認
    - 不足している場合はダークモード用のCSS変数オーバーライドを追加
    - _Requirements: 8.2, 8.4_

  - [ ]* 6.2 ビルトインテーマのダークモードCSS構造テストを作成
    - 各テーマファイルに `body.vscode-dark` セレクタが存在することを検証
    - `@media print` ルールがライトモードの固定スタイルを含むことを検証
    - ファイル: `test/unit/previewTheme.test.ts`
    - _Requirements: 8.2, 8.4_

- [x] 7. 最終チェックポイント - 全テスト通過の確認
  - すべてのテストが通ることを確認し、不明点があればユーザーに質問する。

## 備考

- `*` マーク付きタスクはオプションであり、MVP実装時にスキップ可能
- 各タスクは具体的な要件番号を参照しトレーサビリティを確保
- チェックポイントで段階的な検証を実施
- プロパティテストは設計ドキュメントの正当性プロパティに基づく
- ユニットテストは具体的なシナリオとエッジケースを検証
