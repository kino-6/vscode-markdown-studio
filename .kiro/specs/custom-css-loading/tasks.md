# 実装計画: カスタムCSS読み込み

## 概要

ユーザーが指定したCSSファイルをプレビューおよびPDF出力に適用する機能を実装する。`src/infra/customCssLoader.ts` を中核モジュールとして新設し、既存の `config.ts`、`buildHtml.ts`、`exportPdf.ts`、`webviewPanel.ts` を拡張する。サンプルCSSとテストも含む。

## タスク

- [x] 1. 型定義と設定キーの追加
  - [x] 1.1 `src/types/models.ts` に `CustomCssResult` インターフェースを追加
    - `css: string` と `warnings: string[]` フィールドを定義
    - _要件: 2.1, 4.1, 4.2_
  - [x] 1.2 `package.json` に `markdownStudio.style.customCssPath` 設定キーを追加
    - type: string, default: "", description を設定
    - _要件: 1.1_
  - [x] 1.3 `src/infra/config.ts` の `MarkdownStudioConfig` に `customCssPath: string` を追加し、`getConfig()` で読み取る
    - _要件: 1.1, 1.2, 1.3_

- [x] 2. カスタムCSSローダーの実装
  - [x] 2.1 `src/infra/customCssLoader.ts` を新規作成し、以下の関数を実装
    - `resolveCustomCssPath(configPath, workspaceFolders)`: パス解決（絶対/相対/空文字列）
    - `isRemoteUrl(filePath)`: リモートURL判定
    - `sanitizeCss(css)`: `<script>` タグと `javascript:` URL除去
    - `loadCustomCss(configPath)`: ファイル読み込み・バリデーション・サニタイズの統合関数
    - `MAX_CSS_FILE_SIZE` 定数（1MB）
    - _要件: 1.2, 1.3, 1.4, 4.1, 4.2, 4.3, 4.4, 5.2, 5.3, 5.4_
  - [ ]* 2.2 プロパティテスト: パス解決の正当性
    - **Property 1: パス解決の正当性**
    - **検証対象: 要件 1.2, 1.3, 1.4**
    - `test/unit/customCssLoader.property.test.ts` に作成
  - [ ]* 2.3 プロパティテスト: リモートURL拒否
    - **Property 5: リモートURL拒否**
    - **検証対象: 要件 5.2, 5.3**
    - `test/unit/customCssLoader.property.test.ts` に追加
  - [ ]* 2.4 プロパティテスト: CSSサニタイズの安全性
    - **Property 6: CSSサニタイズの安全性**
    - **検証対象: 要件 5.4**
    - `test/unit/customCssLoader.property.test.ts` に追加
  - [ ]* 2.5 プロパティテスト: ファイルエラー時のグレースフルデグラデーション
    - **Property 4: ファイルエラー時のグレースフルデグラデーション**
    - **検証対象: 要件 4.1, 4.2**
    - `test/unit/customCssLoader.property.test.ts` に追加
  - [ ]* 2.6 ユニットテスト: customCssLoader
    - `test/unit/customCssLoader.test.ts` に作成
    - 空パスでのスキップ、1MB超ファイル拒否、UTF-8読み取りなどのエッジケース
    - _要件: 1.4, 4.3, 4.4_

- [x] 3. チェックポイント - テスト確認
  - すべてのテストが通ることを確認し、不明点があればユーザーに質問する。

- [x] 4. プレビューHTMLへのカスタムCSS注入
  - [x] 4.1 `src/preview/buildHtml.ts` の `buildHtml()` を変更し、カスタムCSSを `styleBlock` の後に `<style>` タグとして注入
    - `loadCustomCss()` を呼び出してCSS文字列を取得
    - プリセットスタイルブロック（`/* md-studio-style */`）の後に配置
    - `</head>` の前に注入
    - _要件: 2.1, 2.2, 5.1_
  - [ ]* 4.2 プロパティテスト: CSS注入の構造的正当性
    - **Property 2: CSS注入の構造的正当性**
    - **検証対象: 要件 2.1, 2.2, 5.1**
    - `test/unit/customCssLoader.property.test.ts` に追加

- [x] 5. PDF出力へのカスタムCSS注入
  - [x] 5.1 `src/export/exportPdf.ts` の `exportToPdf()` を変更し、preview.css/hljs-theme.css注入の後にカスタムCSSを注入
    - `loadCustomCss()` を呼び出してCSS文字列を取得
    - 既存CSS注入の後に `<style>` タグとして注入
    - _要件: 3.1, 3.2, 3.3_
  - [ ]* 5.2 プロパティテスト: loadCustomCssの冪等性
    - **Property 3: loadCustomCssの冪等性**
    - **検証対象: 要件 3.3**
    - `test/unit/customCssLoader.property.test.ts` に追加

- [x] 6. チェックポイント - テスト確認
  - すべてのテストが通ることを確認し、不明点があればユーザーに質問する。

- [x] 7. CSSファイル変更のリアルタイム監視
  - [x] 7.1 `src/preview/webviewPanel.ts` に `FileSystemWatcher` 統合を追加
    - カスタムCSSパスが設定されている場合、`vscode.workspace.createFileSystemWatcher` でファイル変更を監視
    - 500msデバウンス付きでプレビュー再描画をトリガー
    - 設定変更時にwatcherを再作成（古いwatcher停止→新しいwatcher開始）
    - パネル破棄時にwatcherサブスクリプションを解放
    - ファイル削除検知時にカスタムCSSなしで再描画
    - _要件: 1.5, 2.3, 2.4, 6.1, 6.2, 6.3, 6.4_

- [x] 8. サンプルCSSファイルの作成
  - [x] 8.1 `examples/custom-styles/modern.css` を新規作成
    - モダンなデザイン（CSS変数、グラデーション、シャドウ、タイポグラフィ）
    - 本文、見出し（h1〜h6）、コードブロック、インラインコード、テーブル、ブロック引用、リスト、リンク、画像、TOC、ダイアグラムコンテナのスタイル
    - ライトモード/ダークモード対応（`prefers-color-scheme` / `.vscode-dark`）
    - `@media print` ルール
    - 各セクションにコメント付与
    - _要件: 7.1, 7.2, 7.3, 7.4, 7.5_
  - [x] 8.2 `examples/demo.md` にカスタムCSS使用方法のセクションを追加
    - サンプルCSSファイルへのパスを記載
    - _要件: 7.6_
  - [ ]* 8.3 サンプルCSS検証テスト
    - `test/unit/sampleCss.test.ts` に作成
    - 必須セレクタの存在、ダークモード対応、コメント付与を検証
    - _要件: 7.3, 7.4, 7.5_

- [x] 9. 最終チェックポイント - 全テスト確認
  - すべてのテストが通ることを確認し、不明点があればユーザーに質問する。

## 備考

- `*` マーク付きタスクはオプションであり、MVPでスキップ可能
- 各タスクは具体的な要件番号を参照しトレーサビリティを確保
- チェックポイントで段階的に品質を検証
- プロパティテストは設計ドキュメントの正当性プロパティに対応
- ユニットテストは具体的なエッジケースと例を検証
