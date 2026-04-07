# 要件定義書: PDF Index with Page Numbers

## はじめに

PDF出力時に、見出しベースの目次ページをページ番号付きで自動生成する機能を追加する。書籍や論文のような「Chapter 1 ... p.3」形式の目次を、Markdownの見出し構造から自動的に構築し、PDFの先頭（または指定位置）に挿入する。

## 用語集

- **PDF_Index**: ページ番号付きの目次ページ。PDFの先頭に挿入される
- **Page_Number_Resolver**: Playwright上でレンダリング後に各見出しの実際のページ番号を取得するコンポーネント
- **TOC_Builder**: 既存のTOC生成モジュール（`src/toc/`）。見出し抽出・アンカー解決を担当
- **PDF_Exporter**: Playwright Chromiumを使用してPDFを生成するモジュール（`src/export/exportPdf.ts`）

## 要件

### 要件1: PDF目次ページの自動生成

**ユーザーストーリー:** 技術文書の著者として、PDF出力時に見出しベースの目次ページがページ番号付きで自動生成されることを期待する。読者がPDF内の特定セクションを素早く見つけられるようにするためである。

#### 受け入れ基準

1. WHEN PDF出力が実行され、`markdownStudio.export.pdfIndex.enabled` が `true` の場合, THE PDF_Exporter SHALL 見出しベースの目次ページをPDFの先頭に挿入する
2. THE PDF_Index SHALL 各見出しのテキストと対応するページ番号を「見出し ... p.N」形式で表示する
3. THE PDF_Index SHALL 既存のTOC設定（`toc.levels`）に従い、指定されたレベル範囲の見出しのみを含む
4. THE PDF_Index SHALL 見出しの階層構造をインデントで視覚的に表現する
5. WHEN 文書に見出しが存在しない場合, THE PDF_Exporter SHALL 目次ページの挿入をスキップする

### 要件2: ページ番号の正確な解決

**ユーザーストーリー:** 技術文書の著者として、目次のページ番号が実際のPDFページと正確に対応していることを期待する。目次を信頼して文書内を移動するためである。

#### 受け入れ基準

1. THE Page_Number_Resolver SHALL Playwrightでレンダリング後、各見出し要素の実際のページ位置を取得する
2. THE Page_Number_Resolver SHALL 目次ページ自体が追加されることによるページ番号のオフセットを正しく計算する
3. WHEN ダイアグラムや画像によりページ分割が変わる場合, THE Page_Number_Resolver SHALL レンダリング後の実際のページ位置を反映する

### 要件3: 設定とカスタマイズ

**ユーザーストーリー:** 技術文書の著者として、PDF目次の有効/無効を切り替え、表示形式をカスタマイズしたい。文書の種類に応じて目次の有無を選択するためである。

#### 受け入れ基準

1. THE Configuration SHALL `markdownStudio.export.pdfIndex.enabled` 設定キーをboolean型（デフォルト: `false`）として提供する
2. THE Configuration SHALL `markdownStudio.export.pdfIndex.title` 設定キーをstring型（デフォルト: `"Table of Contents"`）として提供する
3. WHEN `markdownStudio.export.pdfIndex.enabled` が `false` の場合, THE PDF_Exporter SHALL 目次ページを挿入しない

### 要件4: スタイルとレイアウト

**ユーザーストーリー:** 技術文書の著者として、PDF目次が文書全体のスタイルと調和した見た目であることを期待する。プロフェッショナルな印象を与えるためである。

#### 受け入れ基準

1. THE PDF_Index SHALL 目次タイトルを見出しとして表示し、各エントリを見出しレベルに応じたインデントで表示する
2. THE PDF_Index SHALL 見出しテキストとページ番号の間をドットリーダー（点線）で接続する
3. THE PDF_Index SHALL 目次ページの後にページブレークを挿入し、本文が新しいページから始まるようにする
4. THE PDF_Index SHALL カスタムCSSテーマの影響を受け、文書全体のスタイルと一貫性を保つ
