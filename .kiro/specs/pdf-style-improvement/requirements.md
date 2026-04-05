# 要件定義書: PDFスタイル改善

## はじめに

Markdown Studio のPDF出力およびプレビューのデフォルトスタイルを、人気のある「Markdown PDF」（yzane.markdown-pdf）拡張機能の出力品質に近づける。加えて、フォント、行間、余白、ページサイズなどのスタイル設定をユーザーがきめ細かくカスタマイズできるようにする。また、demo.md のインラインSVGサンプルをより複雑で印象的なものに更新する。

## 用語集

- **Style_Engine**: preview.css および PDF エクスポート時に適用されるCSSスタイルを管理するコンポーネント
- **Config_Reader**: VS Code の設定（`markdownStudio.*`）を読み取り、型付きオブジェクトとして返すモジュール（src/infra/config.ts）
- **PDF_Exporter**: Playwright Chromium を使用して HTML を PDF に変換するモジュール（src/export/exportPdf.ts）
- **Preview_Panel**: VS Code Webview 上で Markdown のプレビューを表示するコンポーネント
- **Markdown_PDF**: 参照実装として使用する VS Code 拡張機能「yzane.markdown-pdf」
- **Demo_Document**: examples/demo.md に配置されるデモ用 Markdown ファイル

## 要件

### 要件 1: デフォルトPDFタイポグラフィの改善

**ユーザーストーリー:** 開発者として、PDF出力のデフォルトスタイルが Markdown_PDF の出力品質に近いものであってほしい。追加設定なしで見栄えの良いPDFを生成できるようにしたい。

#### 受け入れ基準

1. THE Style_Engine SHALL apply a default font-family of `-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"` to the body element in the print media context
2. THE Style_Engine SHALL apply a default font-size of `14px` to the body element in the print media context
3. THE Style_Engine SHALL apply a default line-height of `1.6` to the body element in the print media context
4. THE Style_Engine SHALL apply default page margins of `top: 20mm, bottom: 20mm, left: 20mm, right: 20mm` when header/footer are disabled
5. WHEN a heading element (h1–h6) is rendered, THE Style_Engine SHALL apply margin-top and margin-bottom spacing consistent with Markdown_PDF output
6. WHEN a code block is rendered in print media, THE Style_Engine SHALL apply a monospace font-family of `"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace`

### 要件 2: フォントファミリー設定

**ユーザーストーリー:** 開発者として、PDF出力およびプレビューで使用するフォントファミリーを設定で変更できるようにしたい。組織のスタイルガイドに合わせたフォントを使用したい。

#### 受け入れ基準

1. THE Config_Reader SHALL expose a `markdownStudio.style.fontFamily` setting of type string
2. THE Config_Reader SHALL use `-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif` as the default value for `fontFamily`
3. WHEN the user sets a custom `fontFamily` value, THE Style_Engine SHALL apply that font-family to the body element in both preview and PDF output
4. WHEN the `fontFamily` setting is an empty string, THE Style_Engine SHALL fall back to the default font-family value

### 要件 3: フォントサイズ設定

**ユーザーストーリー:** 開発者として、PDF出力およびプレビューの基本フォントサイズを設定で変更できるようにしたい。文書の用途に応じて読みやすいサイズを選択したい。

#### 受け入れ基準

1. THE Config_Reader SHALL expose a `markdownStudio.style.fontSize` setting of type number
2. THE Config_Reader SHALL use `14` (pixels) as the default value for `fontSize`
3. WHEN the user sets a custom `fontSize` value, THE Style_Engine SHALL apply that font-size in pixels to the body element in both preview and PDF output
4. IF the `fontSize` value is less than 8 or greater than 32, THEN THE Config_Reader SHALL clamp the value to the nearest boundary (8 or 32)

### 要件 4: 行間設定

**ユーザーストーリー:** 開発者として、PDF出力およびプレビューの行間（line-height）を設定で変更できるようにしたい。文書の可読性を調整したい。

#### 受け入れ基準

1. THE Config_Reader SHALL expose a `markdownStudio.style.lineHeight` setting of type number
2. THE Config_Reader SHALL use `1.6` as the default value for `lineHeight`
3. WHEN the user sets a custom `lineHeight` value, THE Style_Engine SHALL apply that line-height to the body element in both preview and PDF output
4. IF the `lineHeight` value is less than 1.0 or greater than 3.0, THEN THE Config_Reader SHALL clamp the value to the nearest boundary (1.0 or 3.0)

### 要件 5: ページ余白設定

**ユーザーストーリー:** 開発者として、PDF出力のページ余白を設定で変更できるようにしたい。印刷時のレイアウトを細かく制御したい。

#### 受け入れ基準

1. THE Config_Reader SHALL expose a `markdownStudio.export.margin` setting of type string
2. THE Config_Reader SHALL use `20mm` as the default value for `margin`
3. WHEN the user sets a custom `margin` value, THE PDF_Exporter SHALL apply that value as the margin for top, bottom, left, and right of the PDF page
4. WHEN header/footer are enabled, THE PDF_Exporter SHALL use the custom margin value for left and right, and add sufficient space for header/footer to the top and bottom margins
5. THE Config_Reader SHALL accept margin values with CSS units (mm, cm, in, px)

### 要件 6: ページサイズ設定の拡張

**ユーザーストーリー:** 開発者として、PDF出力のページサイズを A4 以外にも選択できるようにしたい。用途に応じて適切なページサイズを使用したい。

#### 受け入れ基準

1. THE Config_Reader SHALL expose a `markdownStudio.export.pageFormat` setting with enum values: `A3`, `A4`, `A5`, `Letter`, `Legal`, `Tabloid`
2. THE Config_Reader SHALL use `A4` as the default value for `pageFormat`
3. WHEN the user selects a page format, THE PDF_Exporter SHALL pass the selected format to Playwright's `page.pdf()` method
4. THE Config_Reader SHALL replace the existing `pageFormat` enum (currently `A4`, `Letter` only) with the expanded set of values

### 要件 7: プレビューとPDFのスタイル一貫性

**ユーザーストーリー:** 開発者として、プレビュー画面とPDF出力のスタイルが一貫していてほしい。プレビューで確認した見た目がそのままPDFに反映されることを期待したい。

#### 受け入れ基準

1. WHEN style settings (fontFamily, fontSize, lineHeight) are changed, THE Preview_Panel SHALL reflect the updated styles in the Webview preview
2. WHEN style settings are changed, THE PDF_Exporter SHALL apply the same styles to the PDF output
3. THE Style_Engine SHALL inject user-configured styles as inline CSS or a dynamic `<style>` block into both the preview HTML and the PDF HTML
4. WHEN no custom styles are configured, THE Style_Engine SHALL apply the same default styles to both preview and PDF output

### 要件 8: demo.md のSVGサンプル改善

**ユーザーストーリー:** 開発者として、demo.md のインラインSVGサンプルがより複雑で印象的なものであってほしい。拡張機能のSVGレンダリング能力をより効果的にデモンストレーションしたい。

#### 受け入れ基準

1. THE Demo_Document SHALL contain an inline SVG that uses gradients, paths, and text elements to demonstrate advanced SVG rendering capabilities
2. THE Demo_Document SHALL contain an SVG with a minimum of 10 distinct SVG elements (rect, circle, path, text, line, polygon, etc.)
3. THE Demo_Document SHALL render the updated SVG correctly in both the preview panel and PDF output
4. THE Demo_Document SHALL include a visual representation related to the Markdown Studio workflow or architecture theme
