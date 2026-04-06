# 要件定義書: コードブロック行番号表示機能

## はじめに

Markdown Studio VS Code拡張機能のPDFエクスポートおよびプレビューにおいて、コードブロックに行番号を表示する機能を追加する。行番号はユーザー設定で有効/無効を切り替え可能とし、既存のhighlight.jsによるシンタックスハイライトと共存する。行番号はCSSベースのレンダリングで実装し、コードのコピー時に行番号が含まれないようにする。

## 用語集

- **Line_Number_Renderer**: コードブロックのHTML出力に行番号要素を付与するモジュール
- **Highlight_Engine**: highlight.jsベースのシンタックスハイライトモジュール（既存の `highlightCode.ts`）
- **Markdown_Parser**: markdown-itベースのMarkdownパーサー（既存の `parseMarkdown.ts`）
- **HTML_Builder**: プレビュー用HTML生成モジュール（既存の `buildHtml.ts`）
- **PDF_Exporter**: Playwright Chromiumを使用したPDFエクスポートモジュール（既存の `exportPdf.ts`）
- **Preview_Panel**: VS Code Webviewベースのプレビューパネル（既存の `webviewPanel.ts`）
- **Style_Block**: プリセットに基づくインラインCSS生成関数（既存の `buildStyleBlock`）

## 要件

### 要件1: 行番号HTML生成

**ユーザーストーリー:** 開発者として、コードブロックに行番号が付与されたHTMLが生成されることを期待する。それにより、PDFやプレビューでコードの特定行を参照しやすくなる。

#### 受け入れ基準

1. WHEN 行番号表示が有効な状態でコードブロックがレンダリングされる場合、THE Line_Number_Renderer SHALL 各行に対応する連番（1から開始）の行番号要素を生成する
2. WHEN コードブロックが複数行を含む場合、THE Line_Number_Renderer SHALL 行番号の桁数を最大行番号に合わせて右揃えで表示する
3. WHEN コードブロックが空（0行）の場合、THE Line_Number_Renderer SHALL 行番号要素を生成しない
4. WHEN 行番号表示が無効な状態でコードブロックがレンダリングされる場合、THE Line_Number_Renderer SHALL 行番号要素を生成せず、既存のレンダリング結果を変更しない
5. FOR ALL 有効なコードブロック、行番号を付与した後の行番号要素の数は、THE Line_Number_Renderer SHALL コードブロックの行数と一致する（不変条件）

### 要件2: シンタックスハイライトとの共存

**ユーザーストーリー:** 開発者として、行番号がシンタックスハイライトと正しく共存することを期待する。それにより、コードの可読性が損なわれない。

#### 受け入れ基準

1. WHEN 行番号表示が有効な状態でシンタックスハイライトが適用される場合、THE Line_Number_Renderer SHALL highlight.jsの `<span class="hljs-*">` トークンを破壊しない
2. WHEN 行番号表示が有効な状態でコードブロックがレンダリングされる場合、THE Line_Number_Renderer SHALL 行番号領域とコード領域を視覚的に分離する（境界線またはパディング）
3. WHEN 言語指定のないコードブロック（プレーンテキスト）に行番号が表示される場合、THE Line_Number_Renderer SHALL ハイライトなしのコードに対しても正しく行番号を付与する
4. FOR ALL highlight.jsがサポートする言語のコードブロック、行番号付与の前後でハイライトされたHTML内容は、THE Line_Number_Renderer SHALL 同一である（変換不変条件）

### 要件3: コピー時の行番号除外

**ユーザーストーリー:** 開発者として、コードブロックのテキストをコピーした際に行番号が含まれないことを期待する。それにより、コピーしたコードをそのまま使用できる。

#### 受け入れ基準

1. WHEN ユーザーがコードブロックのテキストを選択してコピーする場合、THE Line_Number_Renderer SHALL クリップボードに行番号テキストを含めない
2. THE Line_Number_Renderer SHALL 行番号要素にCSSの `user-select: none` プロパティを適用する

### 要件4: PDFエクスポートでの行番号表示

**ユーザーストーリー:** 開発者として、PDFエクスポート時にコードブロックの行番号が正しく表示されることを期待する。それにより、印刷されたドキュメントでもコード行を参照できる。

#### 受け入れ基準

1. WHEN 行番号表示が有効な状態でPDFエクスポートが実行される場合、THE PDF_Exporter SHALL コードブロックに行番号を含むPDFを生成する
2. WHEN PDFにコードブロックが含まれる場合、THE PDF_Exporter SHALL 行番号のフォントをコードブロックのフォント（codeFontFamily）と同一にする
3. WHEN PDFのコードブロックがページをまたぐ場合、THE PDF_Exporter SHALL 各ページで行番号の連番を継続する（リセットしない）
4. WHEN 行番号表示が有効な状態でPDFエクスポートが実行される場合、THE PDF_Exporter SHALL `@media print` スタイルに行番号用のスタイルを含める

### 要件5: プレビューでの行番号表示

**ユーザーストーリー:** 開発者として、プレビューパネルでもコードブロックの行番号が表示されることを期待する。それにより、エクスポート前に行番号の表示を確認できる。

#### 受け入れ基準

1. WHEN 行番号表示が有効な状態でプレビューが表示される場合、THE Preview_Panel SHALL コードブロックに行番号を表示する
2. WHEN プレビューでコードブロックが表示される場合、THE Preview_Panel SHALL PDFエクスポートと同一の行番号HTMLを使用する
3. WHEN ダークテーマが適用されている場合、THE Preview_Panel SHALL 行番号の色をテーマに適合させる（ダークテーマではライトグレー、ライトテーマではダークグレー）

### 要件6: スタイルプリセットとの統合

**ユーザーストーリー:** 開発者として、行番号のスタイルが選択中のプリセットと調和することを期待する。それにより、ドキュメント全体の見た目が統一される。

#### 受け入れ基準

1. WHEN 行番号が表示される場合、THE Style_Block SHALL 行番号の色をコードテキストより薄い色（低コントラスト）で表示する
2. WHEN 行番号が表示される場合、THE Style_Block SHALL 行番号領域の右側に視覚的な区切り（ボーダーまたはパディング）を配置する
3. WHEN スタイルプリセットが変更された場合、THE Style_Block SHALL 行番号のスタイルをプリセットのコードブロックスタイル（background、border、padding）と整合させる

### 要件7: 設定オプション

**ユーザーストーリー:** 開発者として、行番号表示の有効/無効を設定で制御したい。それにより、プロジェクトの要件に合わせて行番号の表示を選択できる。

#### 受け入れ基準

1. THE Markdown_Studio SHALL `markdownStudio.codeBlock.lineNumbers` 設定で行番号表示の有効/無効（デフォルト: false）を提供する
2. WHEN `markdownStudio.codeBlock.lineNumbers` が `true` に設定された場合、THE Line_Number_Renderer SHALL すべてのコードブロックに行番号を付与する
3. WHEN `markdownStudio.codeBlock.lineNumbers` が `false` に設定された場合、THE Line_Number_Renderer SHALL 行番号を付与しない
4. WHEN 設定が変更された場合、THE Preview_Panel SHALL プレビューを再レンダリングして変更を即座に反映する

### 要件8: 行番号HTML生成のラウンドトリップ特性

**ユーザーストーリー:** 開発者として、行番号付与処理が元のコード内容を保持することを期待する。それにより、行番号の有無にかかわらずコードの正確性が保証される。

#### 受け入れ基準

1. FOR ALL 有効なコードブロック、行番号を付与したHTMLからコード部分のみを抽出した場合、THE Line_Number_Renderer SHALL 元のハイライト済みHTMLと同一の内容を返す（ラウンドトリップ特性）
2. FOR ALL 有効なコードブロック、行番号付与を2回連続で適用した場合、THE Line_Number_Renderer SHALL 1回適用した結果と同一のHTMLを返す（冪等性）
