# タスク: markdown-pdf テーマCSS精度改善

## タスク一覧

- [x] 1. プリセット設定値の修正（`src/infra/presets.ts`）
  - [x] 1.1 `MARKDOWN_PDF_DEFAULTS.fontFamily` を `'-apple-system, BlinkMacSystemFont, "Segoe WPC", "Segoe UI", "Ubuntu", "Droid Sans", sans-serif'` に変更する
  - [x] 1.2 `MARKDOWN_PDF_DEFAULTS.codeFontFamily` を `'"SFMono-Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace'` に変更する
  - [x] 1.3 `MARKDOWN_PDF_DEFAULTS.codeBlockStyle.borderRadius` を `'3px'` に変更する
- [x] 2. テーマCSSの検証と微調整（`media/themes/markdown-pdf.css`）
  - [x] 2.1 テーマCSSの全スタイル値が要件1〜8の受け入れ基準と一致していることを確認する
  - [x] 2.2 差分がある場合はテーマCSSを修正する
- [x] 3. カスタムスタイル例の同期（`examples/custom-styles/markdown-pdf.css`）
  - [x] 3.1 `examples/custom-styles/markdown-pdf.css` が `media/themes/markdown-pdf.css` と同一内容であることを確認する
  - [x] 3.2 差分がある場合はカスタムスタイル例を更新する
- [x] 4. テーマCSSスタイル値の検証テスト作成
  - [x] 4.1 CSSパース用テストヘルパー関数（`extractCssProperty`、`extractMediaProperty`）を実装する
  - [x] 4.2 見出しスタイル（h1〜h6）の検証テストを作成する（要件1）
  - [x] 4.3 コードブロック・インラインコードスタイルの検証テストを作成する（要件2）
  - [x] 4.4 テーブルスタイルの検証テストを作成する（要件3）
  - [x] 4.5 ブロック引用スタイルの検証テストを作成する（要件4）
  - [x] 4.6 リンクスタイルの検証テストを作成する（要件5）
  - [x] 4.7 基本タイポグラフィ・スペーシングの検証テストを作成する（要件6）
  - [x] 4.8 ダークモードスタイルの検証テストを作成する（要件7）
  - [x] 4.9 印刷/PDF出力スタイルの検証テストを作成する（要件8）
- [x] 5. プリセット設定とテーマCSSの整合性テスト作成
  - [x] 5.1 `fontFamily` の整合性テストを作成する（要件9.1）
  - [x] 5.2 `fontSize`・`lineHeight` の整合性テストを作成する（要件9.2）
  - [x] 5.3 `codeBlockStyle` の整合性テストを作成する（要件9.3）
  - [x] 5.4 `codeFontFamily` の整合性テストを作成する（要件9.4）
- [x] 6. カスタムスタイル例の同期テスト作成
  - [x] 6.1 `examples/custom-styles/markdown-pdf.css` と `media/themes/markdown-pdf.css` のファイル内容同一性テストを作成する（要件10）
- [x] 7. 全テストの実行と検証
  - [x] 7.1 ユニットテストを実行し、全テストがパスすることを確認する
  - [x] 7.2 既存テストに影響がないことを確認する
