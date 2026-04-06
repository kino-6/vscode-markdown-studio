# 要件定義書: TOCコマンド生成機能

## はじめに

Markdown Studio VS Code拡張機能に、VS Codeコマンド「Markdown Studio: Insert TOC」を追加する。本コマンドは、Markdownドキュメントの見出し（h1〜h6）から標準的なMarkdownリスト形式の目次（Table of Contents）を生成し、ソースファイルに直接挿入する。

従来のマーカーベースアプローチ（`[[toc]]`/`[TOC]`をレンダリング時にHTMLに展開）とは異なり、本機能はTOCを実際のMarkdownテキスト（例: `- [Heading](#anchor)`）としてソースファイルに書き込む。これにより、GitHub・GitLab等のプラットフォームでもTOCがそのまま表示される。

TOCセクションは特殊なHTMLコメント（`<!-- TOC -->`...`<!-- /TOC -->`）で囲まれ、後から識別・自動更新が可能である。

## 用語集

- **TOC_Command**: VS Codeコマンド「Markdown Studio: Insert TOC」を実行し、カーソル位置にTOCを挿入するモジュール
- **TOC_Updater**: ドキュメント保存時にTOCセクションを自動的に再生成するモジュール
- **TOC_Builder**: 見出しリストからMarkdownリスト形式のTOCテキストを生成するモジュール
- **Anchor_Resolver**: 見出しテキストからHTMLアンカーID（スラッグ）を生成し、重複を解決するモジュール（既存の `anchorResolver.ts`）
- **TOC_Validator**: TOC内のアンカーリンクが対応する見出しIDと一致するかを検証するモジュール（既存の `tocValidator.ts`）
- **Heading_Extractor**: markdown-itトークンストリームから見出しを抽出するモジュール（既存の `extractHeadings.ts`）
- **Preview_Panel**: VS Code Webviewベースのプレビューパネル（既存の `webviewPanel.ts`）
- **PDF_Exporter**: Playwright Chromiumを使用したPDFエクスポートモジュール（既存の `exportPdf.ts`）
- **TOCコメントマーカー**: TOCセクションの開始と終了を示すHTMLコメント（`<!-- TOC -->`と`<!-- /TOC -->`）
- **TOCセクション**: TOCコメントマーカーで囲まれた、Markdownリスト形式の目次テキスト全体

## 要件

### 要件1: TOC挿入コマンド

**ユーザーストーリー:** 開発者として、VS Codeコマンドを実行してカーソル位置にTOCを挿入したい。それにより、ドキュメント内の任意の位置に目次を配置できる。

#### 受け入れ基準

1. THE TOC_Command SHALL VS Codeコマンドパレットに「Markdown Studio: Insert TOC」コマンドを登録する
2. WHEN 「Markdown Studio: Insert TOC」コマンドが実行される場合、THE TOC_Command SHALL アクティブなMarkdownエディタのカーソル位置にTOCセクションを挿入する
3. WHEN TOCが挿入される場合、THE TOC_Command SHALL TOCセクションをTOCコメントマーカー（`<!-- TOC -->`と`<!-- /TOC -->`）で囲む
4. WHEN TOCが挿入される場合、THE TOC_Command SHALL 各見出しエントリを`- [見出しテキスト](#anchor-id)`形式のMarkdownリストとして生成する
5. WHEN ドキュメントに既存のTOCセクション（TOCコメントマーカーで囲まれた領域）が存在する場合、THE TOC_Command SHALL 新規挿入の代わりに既存のTOCセクションの内容を最新の見出し構造で置換する
6. WHEN アクティブなエディタがMarkdownファイルでない場合、THE TOC_Command SHALL コマンドを実行せず、エラーメッセージを表示しない
7. WHEN ドキュメントに見出しが存在しない場合、THE TOC_Command SHALL TOCコメントマーカーのみを含む空のTOCセクションを挿入する

### 要件2: TOCテキスト生成

**ユーザーストーリー:** 開発者として、見出し階層を反映した標準的なMarkdownリスト形式のTOCが生成されることを期待する。それにより、GitHub・GitLab等でもTOCが正しく表示される。

#### 受け入れ基準

1. WHEN TOCが生成される場合、THE TOC_Builder SHALL 各見出しエントリを`- [見出しテキスト](#anchor-id)`形式（順序なしリスト）または`1. [見出しテキスト](#anchor-id)`形式（順序付きリスト）で生成する
2. WHEN TOCが生成される場合、THE TOC_Builder SHALL 見出しレベルに応じたインデント（レベルごとに2スペース）でネスト構造を表現する
3. WHEN 見出しテキストにインラインMarkdown書式（太字、イタリック、コード、リンク）が含まれる場合、THE TOC_Builder SHALL 書式を除去したプレーンテキストをTOCエントリとして使用する
4. WHEN ドキュメントにコードブロック内の見出し風テキストが含まれる場合、THE TOC_Builder SHALL コードブロック内のテキストを見出しとして抽出しない
5. FOR ALL 有効なMarkdownドキュメント、TOCテキストを生成してからそのテキスト内のリンクエントリを解析した場合、THE TOC_Builder SHALL 元の見出しリスト（設定範囲内）と同数のエントリを返す（ラウンドトリップ特性）
6. THE TOC_Builder SHALL 生成するTOCテキストを標準的なMarkdown構文のみで構成し、特殊な拡張構文を使用しない

### 要件3: アンカーID生成

**ユーザーストーリー:** 開発者として、各見出しに対して一意で予測可能なアンカーIDが生成されることを期待する。それにより、TOCリンクがGitHub・GitLab・プレビュー・PDFのすべてで正しく機能する。

#### 受け入れ基準

1. WHEN 見出しテキストからアンカーIDが生成される場合、THE Anchor_Resolver SHALL テキストを小文字に変換し、空白をハイフンに置換し、英数字・ハイフン・アンダースコア以外のASCII文字を除去する
2. WHEN 同一テキストの見出しが複数存在する場合、THE Anchor_Resolver SHALL 2番目以降の見出しに連番サフィックス（例: `-1`, `-2`）を付与して一意性を保証する
3. WHEN 見出しテキストが日本語などの非ASCII文字を含む場合、THE Anchor_Resolver SHALL 非ASCII文字をアンカーIDに保持する
4. FOR ALL 有効な見出しテキスト、アンカーIDの生成後に再度同じテキストから生成した場合、THE Anchor_Resolver SHALL 同一のアンカーIDを返す（冪等性）

### 要件4: 保存時の自動更新

**ユーザーストーリー:** 開発者として、ドキュメントを保存した際にTOCが自動的に更新されることを期待する。それにより、見出し変更後に手動でTOCを更新する手間が省ける。

#### 受け入れ基準

1. WHEN TOCセクション（TOCコメントマーカーで囲まれた領域）を含むMarkdownドキュメントが保存される場合、THE TOC_Updater SHALL TOCセクションの内容を最新の見出し構造で自動的に再生成する
2. WHEN TOCが自動更新される場合、THE TOC_Updater SHALL TOCコメントマーカーの位置を維持し、マーカー間の内容のみを置換する
3. WHEN ドキュメントにTOCセクションが存在しない場合、THE TOC_Updater SHALL 保存時にTOCの自動挿入を行わない
4. WHEN 自動更新によりTOCの内容に変更がない場合、THE TOC_Updater SHALL ドキュメントに不要な編集を適用しない（無変更時のスキップ）
5. WHILE TOCの自動更新が実行されている間、THE TOC_Updater SHALL ドキュメントの保存操作をブロックしない

### 要件5: プレビューでのTOC表示

**ユーザーストーリー:** 開発者として、プレビューパネルでTOCが正しく表示され、リンクが機能することを期待する。それにより、ドキュメント内をスムーズにナビゲーションできる。

#### 受け入れ基準

1. WHEN TOCセクションを含むドキュメントがプレビューされる場合、THE Preview_Panel SHALL TOCを標準的なMarkdownリストとしてレンダリングし、各エントリをクリック可能なリンクとして表示する
2. WHEN ユーザーがプレビュー内のTOCリンクをクリックした場合、THE Preview_Panel SHALL 対応する見出しの位置までプレビューをスクロールする
3. WHEN TOCセクションのコメントマーカー（`<!-- TOC -->`/`<!-- /TOC -->`）がプレビューに表示される場合、THE Preview_Panel SHALL コメントマーカーをHTMLコメントとして非表示にする（markdown-itの標準動作）

### 要件6: PDFエクスポートでのTOC表示

**ユーザーストーリー:** 開発者として、PDFエクスポート時にもTOCが正しく含まれることを期待する。それにより、PDF文書でも目次ナビゲーションが利用できる。

#### 受け入れ基準

1. WHEN TOCセクションを含むドキュメントがPDFエクスポートされる場合、THE PDF_Exporter SHALL TOCを見出し階層に基づいたリストとしてPDFに含める
2. WHEN PDFにTOCが含まれる場合、THE PDF_Exporter SHALL TOC内のアンカーリンクをPDF内部リンクとして機能させる
3. WHEN PDFにTOCが含まれ、かつ `markdownStudio.toc.pageBreak` 設定が有効な場合、THE PDF_Exporter SHALL TOCセクションの前後に改ページ（page-break-before / page-break-after）を挿入し、TOCを独立したページとして出力する
4. WHEN `markdownStudio.toc.pageBreak` 設定が無効な場合、THE PDF_Exporter SHALL TOCセクションの前後に改ページを挿入しない

### 要件7: アンカーリンク検証と警告

**ユーザーストーリー:** 開発者として、TOC内のアンカーリンクが壊れている場合に警告を受けたい。それにより、リンク切れを早期に発見して修正できる。

#### 受け入れ基準

1. WHEN TOCセクションが存在するドキュメントが編集される場合、THE TOC_Validator SHALL TOC内の各アンカーリンクが対応する見出しIDと一致するかを検証する
2. IF TOC内のアンカーリンクに対応する見出しが存在しない場合、THEN THE TOC_Validator SHALL 該当リンクを無効として検出する
3. WHEN 無効なアンカーリンクが検出された場合、THE TOC_Validator SHALL VS Codeの診断機能（Problems パネル）を通じて警告を表示する
4. WHEN 無効なアンカーリンクが検出された場合、THE TOC_Validator SHALL 警告メッセージに無効なアンカーIDと期待される見出しテキストを含める
5. WHEN ドキュメントが編集されてすべてのアンカーリンクが有効になった場合、THE TOC_Validator SHALL 以前の警告を自動的にクリアする

### 要件8: 設定オプション

**ユーザーストーリー:** 開発者として、TOC生成の動作をカスタマイズしたい。それにより、プロジェクトの要件に合わせた目次を生成できる。

#### 受け入れ基準

1. THE Markdown_Studio SHALL `markdownStudio.toc.levels` 設定で目次に含める見出しレベルの範囲（デフォルト: 1〜3）を提供する
2. THE Markdown_Studio SHALL `markdownStudio.toc.orderedList` 設定で番号付きリスト（`1. [...]`）と番号なしリスト（`- [...]`）の切り替え（デフォルト: false）を提供する
3. THE Markdown_Studio SHALL `markdownStudio.toc.pageBreak` 設定でPDFエクスポート時のTOCセクション前後の改ページ挿入の有効/無効（デフォルト: true）を提供する

### 要件9: TOCコメントマーカーの解析

**ユーザーストーリー:** 開発者として、TOCセクションがコメントマーカーで明確に区切られていることを期待する。それにより、TOCの自動更新やコマンドによる再生成が正確に動作する。

#### 受け入れ基準

1. THE TOC_Command SHALL TOCセクションの開始マーカーとして`<!-- TOC -->`を使用する
2. THE TOC_Command SHALL TOCセクションの終了マーカーとして`<!-- /TOC -->`を使用する
3. WHEN ドキュメント内のTOCセクションが検出される場合、THE TOC_Updater SHALL 開始マーカーと終了マーカーの間の内容のみをTOCセクションとして認識する
4. WHEN TOCコメントマーカーがコードブロック内に記述されている場合、THE TOC_Updater SHALL コードブロック内のマーカーをTOCセクションとして処理しない
5. FOR ALL 有効なTOCセクション、TOCテキストを生成してコメントマーカーで囲んだ後、マーカーを解析してTOCテキストを再抽出した場合、THE TOC_Command SHALL 元のTOCテキストと同一の内容を返す（ラウンドトリップ特性）

### 要件10: PDF改ページのCSS注入

**ユーザーストーリー:** 開発者として、PDFエクスポート時にTOCセクションが独立したページに配置されることを期待する。それにより、印刷物として見やすいドキュメントが生成できる。

#### 受け入れ基準

1. WHEN `markdownStudio.toc.pageBreak` 設定が有効な場合、THE PDF_Exporter SHALL TOCセクションのレンダリング済みHTMLに対して`page-break-before: always`および`page-break-after: always`のCSSを適用する
2. WHEN `markdownStudio.toc.pageBreak` 設定が無効な場合、THE PDF_Exporter SHALL TOCセクションに改ページCSSを適用しない
3. THE PDF_Exporter SHALL TOCセクションの改ページCSS注入をTOCコメントマーカーの検出に基づいて行う
