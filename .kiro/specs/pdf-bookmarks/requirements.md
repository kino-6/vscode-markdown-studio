# 要件: PDFブックマーク（しおり）生成

## 要件 1: PDFブックマーク生成の基本動作

### 説明
PDFエクスポート時に、Markdownの見出し構造に基づくネイティブPDFブックマーク（アウトライン/しおり）を生成する。PDFビューアのサイドバーにツリー型ナビゲーションとして表示される。

### 受け入れ基準

#### AC 1.1: ブックマーク生成の有効化
GIVEN `markdownStudio.export.pdfBookmarks.enabled` が `true`（デフォルト）
WHEN 見出しを含むMarkdownドキュメントをPDFエクスポートする
THEN 生成されたPDFに `/Outlines` ディクショナリが含まれ、PDFビューアでブックマークが表示される

#### AC 1.2: ブックマーク生成の無効化
GIVEN `markdownStudio.export.pdfBookmarks.enabled` が `false`
WHEN MarkdownドキュメントをPDFエクスポートする
THEN 生成されたPDFに `/Outlines` ディクショナリが含まれない

#### AC 1.3: 見出しなしドキュメント
GIVEN 見出しが1つも含まれないMarkdownドキュメント
WHEN PDFエクスポートする（`pdfBookmarks.enabled=true`）
THEN ブックマークは生成されず、PDFは正常に出力される（エラーなし）

---

## 要件 2: ブックマークツリー構築アルゴリズム

### 説明
フラットな見出しエントリ配列から、見出しレベルの階層関係に基づくブックマークツリーを構築する。H1がトップレベル、H2がH1の子、H3がH2の子となる。

### 受け入れ基準

#### AC 2.1: 階層構造の正確性
GIVEN 複数レベルの見出しを含むエントリ配列（例: H1, H2, H3）
WHEN `buildBookmarkTree` を実行する
THEN H2はその直前のH1の子として、H3はその直前のH2の子として配置される

#### AC 2.2: ノード数の保存
GIVEN 任意の `BookmarkEntry[]` 配列と有効な `minLevel`/`maxLevel`
WHEN `buildBookmarkTree` を実行する
THEN ツリーの全ノード数（再帰的カウント）は、`minLevel`〜`maxLevel` 範囲内のエントリ数と一致する

#### AC 2.3: 深さ優先走査順序の保存
GIVEN 任意の `BookmarkEntry[]` 配列
WHEN `buildBookmarkTree` が返すツリーを深さ優先で走査する
THEN ノード順序はフィルタリング後の入力配列の順序と一致する

#### AC 2.4: ページインデックス変換
GIVEN 任意の `BookmarkEntry[]` 配列
WHEN `buildBookmarkTree` を実行する
THEN 全ノードの `pageIndex` は 0 以上で、`pageIndex = pageNumber - 1` の関係が成立する

#### AC 2.5: レベルスキップの処理
GIVEN レベルが飛んでいる見出し配列（例: H1→H3、H2なし）
WHEN `buildBookmarkTree` を実行する
THEN H3はH1の子として正しく配置され、ツリーが破綻しない

---

## 要件 3: 設定管理

### 説明
`markdownStudio.export.pdfBookmarks.enabled` 設定を追加し、ブックマーク生成の有効/無効を制御する。

### 受け入れ基準

#### AC 3.1: 見出しレベルフィルタリング
GIVEN `toc.minLevel=2`, `toc.maxLevel=4` の設定
WHEN ブックマークツリーを構築する
THEN H1とH5, H6の見出しはブックマークから除外され、H2〜H4のみが含まれる

#### AC 3.2: 設定の登録
GIVEN `package.json` の `contributes.configuration.properties`
WHEN 拡張機能が読み込まれる
THEN `markdownStudio.export.pdfBookmarks.enabled` 設定が利用可能で、型は `boolean`

#### AC 3.3: デフォルト値
GIVEN ユーザーが `pdfBookmarks.enabled` を明示的に設定していない
WHEN `getConfig()` を呼び出す
THEN `pdfBookmarks.enabled` は `true` を返す

---

## 要件 4: エクスポートパイプライン統合

### 説明
既存のPDFエクスポートパイプライン（`exportPdf.ts`）にブックマーク生成ステップを追加する。`pdfIndex.enabled` の状態に応じて、見出しデータの取得方法を切り替える。

### 受け入れ基準

#### AC 4.1: pdfIndex有効時の見出しデータ再利用
GIVEN `pdfIndex.enabled=true` かつ `pdfBookmarks.enabled=true`
WHEN PDFエクスポートを実行する
THEN 2パスレンダリングで収集済みの見出しデータを再利用してブックマークを生成する（追加のDOM評価なし）

#### AC 4.2: pdfIndex無効時の単一パス処理
GIVEN `pdfIndex.enabled=false` かつ `pdfBookmarks.enabled=true`
WHEN PDFエクスポートを実行する
THEN 単一パスでPDF生成後、DOM評価で見出し位置を取得し、ページ番号を推定してブックマークを埋め込む

#### AC 4.3: PDFアウトラインの埋め込み
GIVEN ブックマーク生成が有効で見出しが存在する
WHEN `addBookmarks` を実行する
THEN `pdf-lib` を使用してPDFファイルに `/Outlines` ディクショナリが埋め込まれ、ファイルが上書き保存される

#### AC 4.4: PageMode設定
GIVEN ブックマークが埋め込まれたPDF
WHEN PDFビューアで開く
THEN PDFカタログの `/PageMode` が `/UseOutlines` に設定されており、ブックマークパネルが自動表示される

---

## 要件 5: エラーハンドリングと堅牢性

### 説明
ブックマーク生成中のエラーに対してグレースフルデグラデーションを実現し、PDFエクスポート全体が失敗しないようにする。

### 受け入れ基準

#### AC 5.1: ページ番号超過のクランプ
GIVEN 見出しの `pageNumber` がPDFの実際のページ数を超過している
WHEN ブックマークを埋め込む
THEN `pageIndex` が最終ページにクランプされ（`Math.min(pageIndex, pages.length - 1)`）、ブックマークは最終ページを指す

#### AC 5.2: pdf-lib エラー時のフォールバック
GIVEN `pdf-lib` の処理中にエラーが発生する（ディスク容量不足等）
WHEN ブックマーク埋め込みが失敗する
THEN 例外が上位にバブルアップし、Playwrightが生成した元のPDF（ブックマークなし）がディスク上に残る

#### AC 5.3: コンテンツ非破壊性
GIVEN ブックマーク埋め込み前のPDFファイル
WHEN `addBookmarks` を実行する
THEN 元のPDFコンテンツ（ページ数、テキスト、画像等）は変更されず、ブックマーク情報のみが追加される

---

## 要件 6: 依存関係とUX

### 説明
`pdf-lib` ライブラリを依存関係に追加し、エクスポート中のプログレス表示を更新する。

### 受け入れ基準

#### AC 6.1: pdf-lib 依存関係
GIVEN `package.json`
WHEN 依存関係を確認する
THEN `pdf-lib` (`^1.17.1`) が `dependencies` に含まれている

#### AC 6.2: プログレス表示
GIVEN ブックマーク生成が有効
WHEN PDFエクスポート中にブックマーク埋め込みステップに到達する
THEN プログレスレポーターに `'Adding bookmarks...'` メッセージが報告される
