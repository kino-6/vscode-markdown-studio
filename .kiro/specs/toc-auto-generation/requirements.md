# 要件定義書: TOC自動生成機能

## はじめに

Markdown Studio VS Code拡張機能に、Markdownドキュメントの見出し（h1〜h6）から目次（Table of Contents）を自動生成する機能を追加する。生成されたTOCはプレビューWebviewおよびPDFエクスポートの両方で表示され、ドキュメント編集時に自動更新される。また、TOC内のアンカーリンクが無効な場合は警告を表示する。

## 用語集

- **TOC_Generator**: Markdownドキュメントの見出しトークンを解析し、目次HTMLを生成するモジュール
- **Anchor_Resolver**: 見出しテキストからHTMLアンカーID（スラッグ）を生成し、重複を解決するモジュール
- **TOC_Validator**: TOC内のアンカーリンクが対応する見出しIDと一致するかを検証するモジュール
- **Preview_Panel**: VS Code Webviewベースのプレビューパネル（既存の `webviewPanel.ts`）
- **PDF_Exporter**: Playwright Chromiumを使用したPDFエクスポートモジュール（既存の `exportPdf.ts`）
- **Markdown_Parser**: markdown-itベースのMarkdownパーサー（既存の `parseMarkdown.ts`）
- **TOCマーカー**: ユーザーがMarkdownドキュメント内にTOCの挿入位置を指定するための特殊記法（例: `[[toc]]` または `[TOC]`）

## 要件

### 要件1: 見出し抽出

**ユーザーストーリー:** 開発者として、Markdownドキュメント内のすべての見出しを正確に抽出したい。それにより、正しい目次を生成できる。

#### 受け入れ基準

1. WHEN Markdownドキュメントが解析される場合、THE TOC_Generator SHALL h1からh6までのすべての見出しトークンを抽出する
2. WHEN 見出しが抽出される場合、THE TOC_Generator SHALL 各見出しのレベル（1〜6）、テキスト内容、およびソース行番号を保持する
3. WHEN 見出しテキストにインラインMarkdown書式（太字、イタリック、コード、リンク）が含まれる場合、THE TOC_Generator SHALL 書式を除去したプレーンテキストを目次エントリとして使用する
4. WHEN ドキュメントにコードブロック（フェンスブロック）内の見出し風テキストが含まれる場合、THE TOC_Generator SHALL コードブロック内のテキストを見出しとして抽出しない

### 要件2: アンカーID生成

**ユーザーストーリー:** 開発者として、各見出しに対して一意で予測可能なアンカーIDが生成されることを期待する。それにより、TOCリンクが正しく機能する。

#### 受け入れ基準

1. WHEN 見出しテキストからアンカーIDが生成される場合、THE Anchor_Resolver SHALL テキストを小文字に変換し、空白をハイフンに置換し、英数字・ハイフン・アンダースコア以外の文字を除去する
2. WHEN 同一テキストの見出しが複数存在する場合、THE Anchor_Resolver SHALL 2番目以降の見出しに連番サフィックス（例: `-1`, `-2`）を付与して一意性を保証する
3. WHEN 見出しテキストが日本語などの非ASCII文字を含む場合、THE Anchor_Resolver SHALL 非ASCII文字をアンカーIDに保持する
4. FOR ALL 有効な見出しテキスト、アンカーIDの生成後に再度同じテキストから生成した場合、THE Anchor_Resolver SHALL 同一のアンカーIDを返す（冪等性）

### 要件3: TOC HTML生成

**ユーザーストーリー:** 開発者として、見出し階層を反映した目次HTMLが生成されることを期待する。それにより、ドキュメントの構造を視覚的に把握できる。

#### 受け入れ基準

1. WHEN TOCが生成される場合、THE TOC_Generator SHALL 見出しレベルに応じたネストされたHTMLリスト（`<ul>`/`<li>`）を生成する
2. WHEN TOCが生成される場合、THE TOC_Generator SHALL 各エントリに対応する見出しへのアンカーリンク（`<a href="#anchor-id">`）を含める
3. WHEN TOCが生成される場合、THE TOC_Generator SHALL TOC全体を識別可能なコンテナ要素（`<nav class="ms-toc">`）で囲む
4. WHEN ドキュメントに見出しが存在しない場合、THE TOC_Generator SHALL 空のTOCコンテナを生成する
5. FOR ALL 有効なMarkdownドキュメント、TOCを生成してからHTMLを解析し見出しリストを再抽出した場合、THE TOC_Generator SHALL 元の見出しリストと同等のエントリ数を返す（ラウンドトリップ特性）

### 要件4: TOCマーカーによる挿入位置指定

**ユーザーストーリー:** 開発者として、Markdownドキュメント内の任意の位置にTOCを挿入したい。それにより、ドキュメントレイアウトを自由に制御できる。

#### 受け入れ基準

1. WHEN ドキュメントに `[[toc]]` マーカーが含まれる場合、THE TOC_Generator SHALL マーカーの位置に生成されたTOC HTMLを挿入する
2. WHEN ドキュメントに `[TOC]` マーカーが含まれる場合、THE TOC_Generator SHALL `[[toc]]` と同様にTOC HTMLを挿入する（大文字小文字を区別しない）
3. WHEN ドキュメントにTOCマーカーが複数含まれる場合、THE TOC_Generator SHALL 最初のマーカーのみをTOCに置換し、残りのマーカーを除去する
4. WHEN ドキュメントにTOCマーカーが含まれない場合、THE TOC_Generator SHALL TOCを挿入しない
5. WHEN TOCマーカーがコードブロック内に記述されている場合、THE TOC_Generator SHALL コードブロック内のマーカーをTOCとして処理しない

### 要件5: プレビューでのTOC表示

**ユーザーストーリー:** 開発者として、プレビューパネルでTOCが正しく表示され、リンクが機能することを期待する。それにより、ドキュメント内をスムーズにナビゲーションできる。

#### 受け入れ基準

1. WHEN TOCマーカーを含むドキュメントがプレビューされる場合、THE Preview_Panel SHALL TOCを見出し階層に基づいたクリック可能なリンクリストとして表示する
2. WHEN ユーザーがTOC内のリンクをクリックした場合、THE Preview_Panel SHALL 対応する見出しの位置までプレビューをスクロールする
3. WHEN TOCが表示される場合、THE Preview_Panel SHALL 選択中のスタイルプリセット（markdown-pdf、github、minimal、academic、custom）に適合したスタイルを適用する

### 要件6: PDFエクスポートでのTOC表示

**ユーザーストーリー:** 開発者として、PDFエクスポート時にもTOCが正しく含まれることを期待する。それにより、PDF文書でも目次ナビゲーションが利用できる。

#### 受け入れ基準

1. WHEN TOCマーカーを含むドキュメントがPDFエクスポートされる場合、THE PDF_Exporter SHALL TOCを見出し階層に基づいたリストとしてPDFに含める
2. WHEN PDFにTOCが含まれる場合、THE PDF_Exporter SHALL TOC内のアンカーリンクをPDF内部リンクとして機能させる
3. WHEN PDFにTOCが含まれる場合、THE PDF_Exporter SHALL プレビューと同一のTOC HTMLを使用する
4. WHEN PDFにTOCが含まれ、かつ `markdownStudio.toc.pageBreak` 設定が有効な場合、THE PDF_Exporter SHALL TOCの前後に改ページ（page-break-before / page-break-after）を挿入し、TOCを独立したページとして出力する

### 要件7: ドキュメント編集時の自動更新

**ユーザーストーリー:** 開発者として、ドキュメントを編集した際にTOCが自動的に更新されることを期待する。それにより、手動でTOCを更新する手間が省ける。

#### 受け入れ基準

1. WHEN ドキュメントのテキストが変更された場合、THE TOC_Generator SHALL 既存のインクリメンタル更新パイプラインの一部としてTOCを再生成する
2. WHEN 見出しが追加、削除、または変更された場合、THE TOC_Generator SHALL 変更を反映した新しいTOCをプレビューに送信する
3. WHILE プレビューパネルが表示されている間、THE TOC_Generator SHALL ドキュメント変更イベントごとにTOCを再計算する

### 要件8: アンカーリンク検証と警告

**ユーザーストーリー:** 開発者として、TOC内のアンカーリンクが壊れている場合に警告を受けたい。それにより、リンク切れを早期に発見して修正できる。

#### 受け入れ基準

1. WHEN TOCが生成された後、THE TOC_Validator SHALL TOC内の各アンカーリンクが対応する見出しIDと一致するかを検証する
2. IF TOC内のアンカーリンクに対応する見出しが存在しない場合、THEN THE TOC_Validator SHALL 該当リンクを無効として検出する
3. WHEN 無効なアンカーリンクが検出された場合、THE TOC_Validator SHALL VS Codeの診断機能（Problems パネル）を通じて警告を表示する
4. WHEN 無効なアンカーリンクが検出された場合、THE TOC_Validator SHALL 警告メッセージに無効なアンカーIDと期待される見出しテキストを含める
5. WHEN ドキュメントが編集されてすべてのアンカーリンクが有効になった場合、THE TOC_Validator SHALL 以前の警告を自動的にクリアする

### 要件9: 設定オプション

**ユーザーストーリー:** 開発者として、TOC生成の動作をカスタマイズしたい。それにより、プロジェクトの要件に合わせた目次を生成できる。

#### 受け入れ基準

1. THE Markdown_Studio SHALL `markdownStudio.toc.levels` 設定で目次に含める見出しレベルの範囲（デフォルト: 1〜3）を提供する
2. THE Markdown_Studio SHALL `markdownStudio.toc.orderedList` 設定で番号付きリスト（`<ol>`）と番号なしリスト（`<ul>`）の切り替え（デフォルト: false）を提供する
3. THE Markdown_Studio SHALL `markdownStudio.toc.pageBreak` 設定でPDFエクスポート時のTOC前後の改ページ挿入の有効/無効（デフォルト: true）を提供する
