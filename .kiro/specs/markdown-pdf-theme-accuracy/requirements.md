# 要件定義書

## はじめに

本機能は、「markdown-pdf」テーマのCSSスタイルを、オリジナルのMarkdown PDF拡張機能（yzane/vscode-markdown-pdf）のデフォルトスタイルに正確に一致させることを目的とする。ユーザーがオリジナル拡張機能から移行する際に、視覚的な一貫性を確保し、違和感のない体験を提供する。

対象ファイル:
- テーマCSS: `media/themes/markdown-pdf.css`
- プリセット設定: `src/infra/presets.ts`
- カスタムスタイル例: `examples/custom-styles/markdown-pdf.css`

## 用語集

- **Theme_CSS**: `media/themes/markdown-pdf.css` に定義されたテーマスタイルシート
- **Preset_Config**: `src/infra/presets.ts` に定義されたプリセットスタイル設定オブジェクト
- **Example_CSS**: `examples/custom-styles/markdown-pdf.css` に配置されたカスタムスタイル例ファイル
- **Original_Extension**: yzane/vscode-markdown-pdf 拡張機能のデフォルトスタイル
- **Build_Pipeline**: `src/preview/buildHtml.ts` の `buildStyleBlock` 関数によるスタイル生成パイプライン
- **Preview_CSS**: `media/preview.css` に定義されたベーススタイルシート

## 要件

### 要件1: 見出しスタイルの正確な再現

**ユーザーストーリー:** ユーザーとして、markdown-pdfテーマの見出しスタイルがオリジナル拡張機能と同一であることを期待する。これにより、移行時に見出しの見た目が変わらない。

#### 受け入れ基準

1. WHEN markdown-pdfテーマが選択されている場合、THE Theme_CSS SHALL h1要素に `font-size: 2em`、`font-weight: 600`、`padding-bottom: 0.3em`、`border-bottom: 1px solid #eaecef` を適用する
2. WHEN markdown-pdfテーマが選択されている場合、THE Theme_CSS SHALL h2要素に `font-size: 1.5em`、`font-weight: 600`、`padding-bottom: 0.3em`、`border-bottom: 1px solid #eaecef` を適用する
3. WHEN markdown-pdfテーマが選択されている場合、THE Theme_CSS SHALL h3要素に `font-size: 1.25em`、`font-weight: 600` を適用し、border-bottomを適用しない
4. WHEN markdown-pdfテーマが選択されている場合、THE Theme_CSS SHALL h4要素に `font-size: 1em`、`font-weight: 600` を適用する
5. WHEN markdown-pdfテーマが選択されている場合、THE Theme_CSS SHALL h5要素に `font-size: 0.875em`、`font-weight: 600` を適用する
6. WHEN markdown-pdfテーマが選択されている場合、THE Theme_CSS SHALL h6要素に `font-size: 0.85em`、`font-weight: 600`、`color: #6a737d` を適用する
7. THE Theme_CSS SHALL すべての見出し要素（h1〜h6）に `margin-top: 24px`、`margin-bottom: 16px` を適用する

### 要件2: コードブロックスタイルの正確な再現

**ユーザーストーリー:** ユーザーとして、コードブロックの背景色・ボーダー・パディングがオリジナル拡張機能と一致することを期待する。これにより、コードの可読性が維持される。

#### 受け入れ基準

1. WHEN markdown-pdfテーマが選択されている場合、THE Theme_CSS SHALL pre要素に `background: #f6f8fa`、`border: 1px solid #d0d7de`、`border-radius: 3px`、`padding: 16px` を適用する
2. WHEN markdown-pdfテーマが選択されている場合、THE Theme_CSS SHALL pre code要素に `font-size: 0.85em`、`line-height: 1.45`、`background: none`、`padding: 0` を適用する
3. WHEN markdown-pdfテーマが選択されている場合、THE Theme_CSS SHALL インラインcode要素に `font-size: 0.85em`、`padding: 0.2em 0.4em`、`background: rgba(27, 31, 35, 0.05)`、`border-radius: 3px` を適用する
4. WHEN markdown-pdfテーマが選択されている場合、THE Preset_Config SHALL markdown-pdfプリセットの `codeBlockStyle.borderRadius` を `"3px"` に設定する

### 要件3: テーブルスタイルの正確な再現

**ユーザーストーリー:** ユーザーとして、テーブルのボーダー・パディング・ヘッダー背景がオリジナル拡張機能と一致することを期待する。これにより、データ表示の見た目が統一される。

#### 受け入れ基準

1. WHEN markdown-pdfテーマが選択されている場合、THE Theme_CSS SHALL table要素に `border-collapse: collapse`、`width: auto`、`display: table` を適用する
2. WHEN markdown-pdfテーマが選択されている場合、THE Theme_CSS SHALL th・td要素に `border: none`、`border-bottom: 1px solid #dfe2e5`、`padding: 6px 13px` を適用する
3. WHEN markdown-pdfテーマが選択されている場合、THE Theme_CSS SHALL th要素に `background: none`、`font-weight: 600` を適用する
4. WHEN markdown-pdfテーマが選択されている場合、THE Theme_CSS SHALL 偶数行の背景色ストライプを適用しない（`background: none`）

### 要件4: ブロック引用スタイルの正確な再現

**ユーザーストーリー:** ユーザーとして、ブロック引用のスタイルがオリジナル拡張機能と一致することを期待する。これにより、引用テキストの視覚的な区別が維持される。

#### 受け入れ基準

1. WHEN markdown-pdfテーマが選択されている場合、THE Theme_CSS SHALL blockquote要素に `padding: 0 1em`、`border-left: 0.25em solid #dfe2e5`、`color: #6a737d` を適用する
2. WHEN markdown-pdfテーマが選択されている場合、THE Theme_CSS SHALL blockquote内のp要素に `margin: 0.5em 0` を適用する

### 要件5: リンクカラーの正確な再現

**ユーザーストーリー:** ユーザーとして、リンクの色がオリジナル拡張機能と一致することを期待する。これにより、リンクの視認性が維持される。

#### 受け入れ基準

1. WHEN markdown-pdfテーマが選択されている場合、THE Theme_CSS SHALL a要素に `color: #0366d6`、`text-decoration: none` を適用する
2. WHEN markdown-pdfテーマが選択されている場合、THE Theme_CSS SHALL a:hover状態に `text-decoration: underline` を適用する

### 要件6: 基本タイポグラフィとスペーシングの正確な再現

**ユーザーストーリー:** ユーザーとして、フォント・行間・余白がオリジナル拡張機能と一致することを期待する。これにより、文書全体のレイアウトが統一される。

#### 受け入れ基準

1. THE Theme_CSS SHALL body要素に `font-family: -apple-system, BlinkMacSystemFont, "Segoe WPC", "Segoe UI", "Ubuntu", "Droid Sans", sans-serif` を適用する
2. THE Theme_CSS SHALL body要素に `font-size: 14px`、`line-height: 1.6`、`color: #333` を適用する
3. WHEN markdown-pdfテーマが選択されている場合、THE Theme_CSS SHALL hr要素に `height: 0.25em`、`background: #e1e4e8`、`margin: 24px 0`、`border: none` を適用する
4. WHEN markdown-pdfテーマが選択されている場合、THE Theme_CSS SHALL リスト要素（ul, ol）に `padding-left: 2em` を適用する

### 要件7: ダークモードスタイルの正確な再現

**ユーザーストーリー:** ユーザーとして、ダークモード時のスタイルがオリジナル拡張機能のダークモードと一致することを期待する。これにより、テーマ切り替え時の体験が統一される。

#### 受け入れ基準

1. WHILE VS Codeがダークモードの場合、THE Theme_CSS SHALL body要素に `color: #d4d4d4`、`background: #1e1e1e` を適用する
2. WHILE VS Codeがダークモードの場合、THE Theme_CSS SHALL h1・h2要素の `border-bottom-color` を `#444` に変更する
3. WHILE VS Codeがダークモードの場合、THE Theme_CSS SHALL pre要素に `background: #161b22`、`border-color: #3d444d` を適用する
4. WHILE VS Codeがダークモードの場合、THE Theme_CSS SHALL blockquote要素に `border-left-color: #444`、`color: #8b949e` を適用する
5. WHILE VS Codeがダークモードの場合、THE Theme_CSS SHALL a要素に `color: #58a6ff` を適用する
6. WHILE VS Codeがダークモードの場合、THE Theme_CSS SHALL hr要素に `background: #3d444d` を適用する

### 要件8: 印刷/PDF出力スタイルの正確な再現

**ユーザーストーリー:** ユーザーとして、PDF出力時のスタイルがオリジナル拡張機能と一致することを期待する。これにより、生成されるPDFの品質が維持される。

#### 受け入れ基準

1. WHEN PDF出力が実行される場合、THE Theme_CSS SHALL body要素に `font-size: 12px`、`color: #000`、`background: #fff` を適用する
2. WHEN PDF出力が実行される場合、THE Theme_CSS SHALL h1・h2要素の `border-bottom-color` を `#ccc` に変更し、`page-break-after: avoid` を適用する
3. WHEN PDF出力が実行される場合、THE Theme_CSS SHALL pre要素に `page-break-inside: avoid` を適用し、pre code要素に `white-space: pre-wrap`、`word-wrap: break-word` を適用する
4. WHEN PDF出力が実行される場合、THE Theme_CSS SHALL テーブルに `display: table`、`page-break-inside: avoid` を適用する
5. WHEN PDF出力が実行される場合、THE Theme_CSS SHALL a要素に `color: #000`、`text-decoration: underline` を適用する
6. WHEN PDF出力が実行される場合、THE Theme_CSS SHALL img要素に `page-break-inside: avoid` を適用する

### 要件9: プリセット設定とテーマCSSの整合性

**ユーザーストーリー:** ユーザーとして、プリセット設定（presets.ts）とテーマCSS（markdown-pdf.css）の値が一致していることを期待する。これにより、buildStyleBlockで生成されるインラインスタイルがテーマCSSと矛盾しない。

#### 受け入れ基準

1. THE Preset_Config SHALL markdown-pdfプリセットの `fontFamily` を `'-apple-system, BlinkMacSystemFont, "Segoe WPC", "Segoe UI", "Ubuntu", "Droid Sans", sans-serif'` に設定する
2. THE Preset_Config SHALL markdown-pdfプリセットの `fontSize` を `14`、`lineHeight` を `1.6` に設定する
3. THE Preset_Config SHALL markdown-pdfプリセットの `codeBlockStyle` を `{ background: "#f6f8fa", border: "1px solid #d0d7de", borderRadius: "3px", padding: "16px" }` に設定する
4. THE Preset_Config SHALL markdown-pdfプリセットの `codeFontFamily` を `'"SFMono-Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace'` に設定する

### 要件10: カスタムスタイル例ファイルの同期

**ユーザーストーリー:** ユーザーとして、`examples/custom-styles/markdown-pdf.css` がテーマCSSと同一の内容であることを期待する。これにより、カスタムスタイルの参考例として正確な情報が提供される。

#### 受け入れ基準

1. THE Example_CSS SHALL Theme_CSSと同一のスタイル定義を含む
2. THE Example_CSS SHALL Theme_CSSの変更に合わせて同期的に更新される
