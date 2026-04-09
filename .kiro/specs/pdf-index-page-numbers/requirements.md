# 要件定義書

## はじめに

Markdown Studio VS Code拡張のPDFエクスポート機能において、ページ番号付きの目次（PDF Index）ページを生成する機能を実装する。現在のPDF Indexモジュールは目次ページの基盤を持つが、見出しに対応するページ番号の表示機能が不足している。本機能は既存の2パスレンダリング（1パス目でページ位置を取得、2パス目でページ番号を注入）を活用し、「Chapter 1 はじめに ...... p.3」形式のエントリを持つ目次ページをPDF先頭に挿入する。

## 用語集

- **PDF_Index**: PDFドキュメントの先頭に挿入される、ページ番号付き見出し一覧ページ
- **Export_Pipeline**: `exportPdf.ts`内のPDFエクスポート処理パイプライン（HTML構築→画像インライン化→Chromium起動→レンダリング→PDF生成）
- **Two_Pass_Renderer**: 1パス目でページ位置を計算し、2パス目でページ番号を注入する2段階レンダリング方式
- **Heading_Extractor**: `extractHeadings.ts`内のMarkdownからの見出し抽出モジュール
- **Anchor_Resolver**: `anchorResolver.ts`内の見出しに対するアンカーID生成モジュール
- **Dot_Leader**: 見出しテキストとページ番号の間を結ぶドットの連続（例: 「..........」）
- **Page_Offset**: 目次ページ自体が占めるページ数分のオフセット値
- **HeadingPageEntry**: 見出しレベル、テキスト、ページ番号、アンカーIDを保持するデータ構造
- **Index_Entry**: PDF_Index内の1行分のエントリ（見出しテキスト + Dot_Leader + ページ番号）
- **Config**: `config.ts`内の設定読み込みモジュール（`PdfIndexConfig`型を提供）

## 要件

### 要件 1: PDF Indexページの生成

**ユーザーストーリー:** Markdownの著者として、PDFエクスポート時にページ番号付きの目次ページを自動生成したい。これにより、読者がドキュメント内の各章・節を素早く参照できるようになる。

#### 受け入れ基準

1. WHEN `markdownStudio.export.pdfIndex.enabled`が`true`に設定されている場合、THE Export_Pipeline SHALL PDFドキュメントの先頭にPDF_Indexページを挿入する
2. WHEN `markdownStudio.export.pdfIndex.enabled`が`false`に設定されている場合、THE Export_Pipeline SHALL PDF_Indexページを生成せずにPDFをエクスポートする
3. THE PDF_Index SHALL 設定された`markdownStudio.export.pdfIndex.title`の値をページタイトルとして表示する
4. THE PDF_Index SHALL 本文コンテンツの前に配置され、目次ページの後に改ページを挿入する

### 要件 2: 2パスレンダリングによるページ番号計算

**ユーザーストーリー:** Markdownの著者として、目次に表示されるページ番号が実際のPDFページと正確に対応していてほしい。これにより、目次の信頼性が確保される。

#### 受け入れ基準

1. THE Two_Pass_Renderer SHALL 1パス目で目次なしのPDFを生成し、各見出しのDOM上の位置（offsetTop）と総ページ数を取得する
2. THE Two_Pass_Renderer SHALL 各見出しの位置比率（offsetTop / scrollHeight）と総ページ数から、各見出しのページ番号を計算する
3. THE Two_Pass_Renderer SHALL 目次ページ自体が占めるページ数（Page_Offset）を計算し、各見出しのページ番号にPage_Offsetを加算する
4. THE Two_Pass_Renderer SHALL 2パス目で計算済みページ番号を含むPDF_IndexのHTMLを本文の前に挿入し、最終PDFを生成する
5. WHEN ドキュメントに見出しが存在しない場合、THE Two_Pass_Renderer SHALL PDF_Indexページを生成せずに単一パスでPDFを出力する

### 要件 3: 見出しレベル範囲の設定

**ユーザーストーリー:** Markdownの著者として、目次に含める見出しレベルの範囲を設定したい。これにより、必要な粒度の目次を生成できる。

#### 受け入れ基準

1. THE PDF_Index SHALL 既存の`markdownStudio.toc.levels`設定（例: "1-3"）で指定された範囲の見出しのみをIndex_Entryとして含める
2. WHEN 見出しレベルが設定範囲外の場合、THE PDF_Index SHALL 該当する見出しをIndex_Entryから除外する
3. THE PDF_Index SHALL 見出しレベルに応じたインデント（レベル1は左端、レベル2は1段インデント等）でIndex_Entryを表示する

### 要件 4: Dot Leaderスタイルの目次エントリ

**ユーザーストーリー:** Markdownの著者として、見出しテキストとページ番号の間にドットリーダーが表示される読みやすい目次を生成したい。これにより、プロフェッショナルな外観のPDFが作成できる。

#### 受け入れ基準

1. THE PDF_Index SHALL 各Index_Entryにおいて、見出しテキストとページ番号の間にDot_Leaderを表示する
2. THE PDF_Index SHALL ページ番号を「p.N」形式（Nは数値）で各Index_Entryの右端に表示する
3. THE PDF_Index SHALL CSSのflexboxレイアウトとリーダードット生成を使用して、Dot_Leaderを実装する
4. THE PDF_Index SHALL 見出しテキストが長い場合でも、テキストの切り詰めとDot_Leaderの表示を適切に処理する

### 要件 5: 目次エントリのリンク

**ユーザーストーリー:** PDFの読者として、目次のエントリをクリックして該当セクションにジャンプしたい。これにより、長いドキュメントのナビゲーションが容易になる。

#### 受け入れ基準

1. THE PDF_Index SHALL 各Index_Entryの見出しテキストを、対応する見出しのアンカーIDへのハイパーリンクとして生成する
2. THE Anchor_Resolver SHALL 見出しテキストからGitHub互換のスラッグ形式でアンカーIDを生成する
3. WHEN 同一テキストの見出しが複数存在する場合、THE Anchor_Resolver SHALL 連番サフィックス（-1, -2等）を付与して一意なアンカーIDを生成する

### 要件 6: PDF IndexのHTML生成とスタイリング

**ユーザーストーリー:** Markdownの著者として、目次ページが適切にスタイリングされ、本文と視覚的に区別できるようにしたい。これにより、ドキュメントの構造が明確になる。

#### 受け入れ基準

1. THE PDF_Index SHALL `ms-pdf-index`クラスを持つコンテナ要素内にすべてのIndex_Entryを配置する
2. THE PDF_Index SHALL 各Index_Entryに見出しレベルに対応するCSSクラス（`ms-pdf-index-level-1`〜`ms-pdf-index-level-6`）を付与する
3. THE PDF_Index SHALL 目次ページの後に`page-break-after: always`を適用し、本文との間に改ページを挿入する
4. THE PDF_Index SHALL タイトルを`ms-pdf-index-title`クラスのh1要素として表示する
5. THE PDF_Index SHALL HTMLの特殊文字（`<`, `>`, `&`, `"`）を適切にエスケープする

### 要件 7: 目次ページ数の推定

**ユーザーストーリー:** Markdownの著者として、目次が複数ページにわたる場合でも、本文のページ番号が正確に計算されてほしい。これにより、大規模ドキュメントでも目次の正確性が保たれる。

#### 受け入れ基準

1. THE PDF_Index SHALL 目次エントリ数に基づいて目次ページ数を推定する（1ページあたり約30エントリと仮定）
2. THE PDF_Index SHALL 推定した目次ページ数をPage_Offsetとして各見出しのページ番号に加算する
3. WHEN 目次エントリが0件の場合、THE PDF_Index SHALL Page_Offsetを0として返し、目次ページを生成しない
4. THE `estimateIndexPageCount`関数 SHALL エントリ数0の場合に0を返し、1以上の場合に`ceil(entryCount / 30)`を返す

### 要件 8: PDF Index目次タイトルの除外

**ユーザーストーリー:** Markdownの著者として、目次ページ自体のタイトル（例: "Table of Contents"）が目次エントリに含まれないようにしたい。これにより、目次の自己参照が防止される。

#### 受け入れ基準

1. WHEN DOM上の見出し要素を走査する際、THE Two_Pass_Renderer SHALL `ms-pdf-index-title`クラスを持つ見出し要素を目次エントリから除外する
2. THE PDF_Index SHALL 目次タイトルのh1要素に`ms-pdf-index-title`クラスを付与する
