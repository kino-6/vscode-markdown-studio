# ローカル画像パス解決 バグ修正設計

## 概要

Markdownファイル内の相対パスで参照されたローカル画像（例: `![Logo](images/logo.svg)`）が、Webviewプレビューおよび PDF エクスポートで表示されないバグを修正する。原因は `localResourceRoots` の制限と、相対パスから Webview 互換 URI への変換が欠如していること。修正アプローチは、ドキュメント URI を `buildHtml` に渡し、`localResourceRoots` にワークスペースフォルダを追加し、markdown-it レンダリング後に `<img src>` パスを変換する。

## 用語集

- **Bug_Condition (C)**: バグが発生する条件 — Markdown内の相対パス画像参照がWebview互換URIに変換されず、かつ `localResourceRoots` がワークスペースを含まない状態
- **Property (P)**: 期待される動作 — 相対パスが `webview.asWebviewUri()` で変換され、画像が正しく表示される
- **Preservation**: 修正によって変更されてはならない既存動作 — 画像なしMarkdown、外部画像ブロック、ダイアグラム描画、data URI画像、CSPポリシー、インクリメンタル更新
- **buildHtml**: `src/preview/buildHtml.ts` 内の関数。Markdownをレンダリングし、CSP・スタイル・スクリプトを含む完全なHTML文書を生成する
- **webviewPanel**: `src/preview/webviewPanel.ts` 内のモジュール。Webviewパネルの作成・管理を行い、`localResourceRoots` を設定する
- **renderMarkdownDocument**: `src/renderers/renderMarkdown.ts` 内の関数。markdown-it を使用してMarkdownをHTMLに変換する
- **exportToPdf**: `src/export/exportPdf.ts` 内の関数。Playwrightを使用してHTMLをPDFに変換する
- **documentUri**: プレビュー対象のMarkdownファイルの `vscode.Uri`

## バグ詳細

### バグ条件

Markdownファイルが相対パスでローカル画像を参照しており、Webviewプレビューまたは PDF エクスポートを実行した場合にバグが発生する。markdown-it は `![Logo](images/logo.svg)` を `<img src="images/logo.svg">` に変換するが、この相対パスは以下の2つの理由で解決できない:

1. `localResourceRoots` がエクステンションの `media/` と `dist/` のみを許可しており、ワークスペースファイルへのアクセスが拒否される
2. 相対パスが `vscode-resource://` URI に変換されないため、Webviewがファイルを特定できない

**形式仕様:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { htmlBody: string, documentUri: Uri | undefined }
  OUTPUT: boolean

  imgTags := extractImgTags(input.htmlBody)
  FOR EACH img IN imgTags DO
    src := img.getAttribute("src")
    IF isRelativePath(src)
       AND NOT src.startsWith("data:")
       AND NOT src.startsWith("http://")
       AND NOT src.startsWith("https://")
    THEN
      RETURN true
    END IF
  END FOR
  RETURN false
END FUNCTION
```

### 具体例

- `![Logo](images/logo.svg)` → Webviewプレビューで壊れた画像アイコンが表示される（期待: 画像が正しく表示される）
- `![Photo](../assets/photo.png)` → 親ディレクトリへの相対パスも解決されず表示されない（期待: 画像が正しく表示される）
- `![Diagram](./diagrams/arch.png)` → カレントディレクトリ相対パスも表示されない（期待: 画像が正しく表示される）
- `![](sub/dir/deep/image.jpg)` → 深いネストの相対パスも表示されない（期待: 画像が正しく表示される）
- PDFエクスポート時: `<img src="images/logo.svg">` → Playwrightが相対パスを解決できずPDF内で画像が欠落する（期待: 絶対 `file://` パスに変換され画像が表示される）

## 期待される動作

### 保全要件

**変更されない動作:**
- 画像を含まないMarkdownのプレビューとPDFエクスポートは従来通り正しく動作する
- `blockExternalLinks` 有効時の外部画像（`https://...`）ブロックは従来通り機能する
- Mermaid、PlantUML、SVGフェンスドブロックのダイアグラム描画は従来通り正しく動作する
- data URI画像（`<img src="data:image/png;base64,...">` ）は従来通り表示される
- CSPヘッダーの `img-src` に `${cspSource}` と `data:` を含む既存ポリシーは維持される
- インクリメンタル更新（`update-body` メッセージ）は従来通り正しく処理される

**スコープ:**
相対パスのローカル画像参照を含まない全ての入力は、この修正によって一切影響を受けない。これには以下が含まれる:
- 画像なしのMarkdown
- 絶対URLの外部画像（`https://...`）
- data URI画像
- ダイアグラムブロック（Mermaid、PlantUML、SVG）
- マウスクリックやキーボード操作によるUI操作

## 仮説的根本原因

バグの分析に基づき、最も可能性の高い原因は以下の通り:

1. **`localResourceRoots` の制限**: `webviewPanel.ts` でパネル作成時に `localResourceRoots` がエクステンションの `media/` と `dist/` のみに設定されている。ワークスペースフォルダやドキュメントの親ディレクトリが含まれていないため、Webviewがユーザーのローカルファイルへのアクセスを拒否する
   - 該当コード: `vscode.Uri.joinPath(context.extensionUri, 'media')` と `vscode.Uri.joinPath(context.extensionUri, 'dist')` のみ

2. **画像パス変換の欠如**: `buildHtml` および `renderMarkdownDocument` がドキュメントの URI を受け取らないため、相対パスを `webview.asWebviewUri()` で Webview 互換 URI に変換する手段がない
   - `buildHtml` のシグネチャに `documentUri` パラメータが存在しない
   - markdown-it は `![Logo](images/logo.svg)` をそのまま `<img src="images/logo.svg">` に変換する

3. **PDFエクスポートでの絶対パス変換の欠如**: `exportToPdf` が `buildHtml` を呼び出す際にドキュメント URI を渡さないため、Playwrightが相対パスを解決できない
   - Playwrightは `file://` プロトコルの絶対パスであれば画像を読み込める

## 正確性プロパティ

Property 1: Bug Condition - 相対パス画像のURI変換

_For any_ Markdownの `<img src>` が相対パス（`http://`、`https://`、`data:` で始まらない）であり、かつドキュメント URI が提供されている場合、修正後の関数は相対パスをドキュメントの場所を基準とした適切な URI（Webviewプレビューでは `vscode-resource://` URI、PDFエクスポートでは絶対 `file://` パス）に変換し、画像を正しく表示するものとする（SHALL）。

**Validates: Requirements 2.1, 2.3, 2.4**

Property 2: Preservation - 非相対パス入力の動作保全

_For any_ 入力が相対パスのローカル画像参照を含まない場合（画像なし、外部URL画像、data URI画像、ダイアグラムブロック）、修正後の関数は修正前の関数と同一の結果を生成し、既存の全動作を保全するものとする（SHALL）。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**

## 修正実装

### 必要な変更

根本原因分析が正しいと仮定した場合:

**ファイル**: `src/preview/webviewPanel.ts`

**関数**: `openOrRefreshPreview`

**具体的な変更**:
1. **`localResourceRoots` の拡張**: パネル作成時に、ドキュメントの親ディレクトリと `vscode.workspace.workspaceFolders` を `localResourceRoots` に追加する
   - `vscode.Uri.joinPath(document.uri, '..')` でドキュメントの親ディレクトリを追加
   - `vscode.workspace.workspaceFolders` の各フォルダの URI を追加
   - 既存の `media/` と `dist/` は維持する

---

**ファイル**: `src/preview/buildHtml.ts`

**関数**: `buildHtml`, `renderBody`

**具体的な変更**:
2. **`documentUri` パラメータの追加**: `buildHtml` と `renderBody` に `documentUri?: vscode.Uri` パラメータを追加する
3. **画像パス変換関数の実装**: `resolveImagePaths(htmlBody: string, documentUri: vscode.Uri, webview?: vscode.Webview): string` 関数を新規作成する
   - 正規表現 `<img([^>]*)\bsrc="([^"]+)"` で `<img>` タグの `src` 属性を抽出
   - `http://`、`https://`、`data:` で始まるパスはスキップ（変換不要）
   - 相対パスを `vscode.Uri.joinPath(documentDirUri, relativePath)` で絶対 URI に解決
   - Webviewコンテキスト: `webview.asWebviewUri()` で `vscode-resource://` URI に変換
   - PDFコンテキスト（webview未指定）: `uri.toString()` で `file://` URI に変換
4. **変換の適用**: `renderMarkdownDocument` の結果に対して `resolveImagePaths` を適用する（markdown-it レンダリング後の後処理）

---

**ファイル**: `src/preview/webviewPanel.ts`

**関数**: `openOrRefreshPreview`（呼び出し側の変更）

**具体的な変更**:
5. **`buildHtml` 呼び出しの更新**: `document.uri` を `buildHtml` に渡す
6. **`renderBody` 呼び出しの更新**: インクリメンタル更新時の `renderBody` 呼び出しにも `document.uri` を渡す

---

**ファイル**: `src/export/exportPdf.ts`

**関数**: `exportToPdf`

**具体的な変更**:
7. **`buildHtml` 呼び出しの更新**: `document.uri` を `buildHtml` に渡し、PDFエクスポート時に相対パスが絶対 `file://` パスに変換されるようにする

## テスト戦略

### 検証アプローチ

テスト戦略は2段階のアプローチに従う: まず、未修正コードでバグを実証する反例を表面化させ、次に修正が正しく機能し既存動作を保全することを検証する。

### 探索的バグ条件チェック

**目標**: 修正実装前にバグを実証する反例を表面化させる。根本原因分析を確認または反証する。反証した場合は再仮説が必要。

**テスト計画**: 相対パス画像を含むMarkdownを `buildHtml` に渡し、生成されたHTMLの `<img src>` が未変換の相対パスのままであることを確認する。未修正コードでテストを実行し、失敗パターンを観察する。

**テストケース**:
1. **同一ディレクトリ画像テスト**: `![](image.png)` を含むMarkdownで `buildHtml` を呼び出し、`src` が相対パスのままであることを確認（未修正コードで失敗）
2. **サブディレクトリ画像テスト**: `![](images/logo.svg)` を含むMarkdownで `buildHtml` を呼び出し、`src` が未変換であることを確認（未修正コードで失敗）
3. **親ディレクトリ画像テスト**: `![](../assets/photo.png)` を含むMarkdownで `buildHtml` を呼び出し、`src` が未変換であることを確認（未修正コードで失敗）
4. **localResourceRootsテスト**: `openOrRefreshPreview` で作成されたパネルの `localResourceRoots` にワークスペースフォルダが含まれていないことを確認（未修正コードで失敗）

**期待される反例**:
- `<img src="images/logo.svg">` がそのまま出力され、`vscode-resource://` URI に変換されない
- 原因: `buildHtml` が `documentUri` を受け取らず、パス変換ロジックが存在しない

### 修正チェック

**目標**: バグ条件が成立する全ての入力に対して、修正後の関数が期待される動作を生成することを検証する。

**擬似コード:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := buildHtml_fixed(input.markdown, context, webview, assets, documentUri)
  ASSERT allImgSrcAreAbsoluteOrWebviewUri(result)
  ASSERT noRelativeImgSrcRemaining(result)
END FOR
```

### 保全チェック

**目標**: バグ条件が成立しない全ての入力に対して、修正後の関数が修正前の関数と同一の結果を生成することを検証する。

**擬似コード:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT buildHtml_original(input) = buildHtml_fixed(input)
END FOR
```

**テストアプローチ**: 保全チェックにはプロパティベーステストが推奨される。理由:
- 入力ドメイン全体にわたって多数のテストケースを自動生成する
- 手動ユニットテストでは見逃しがちなエッジケースを検出する
- 非バグ入力に対する動作の不変性を強力に保証する

**テスト計画**: まず未修正コードで画像なしMarkdown、外部画像、data URI画像、ダイアグラムブロックの動作を観察し、その動作を捕捉するプロパティベーステストを作成する。

**テストケース**:
1. **画像なしMarkdown保全**: 画像を含まないMarkdownが未修正コードと同一のHTMLを生成することを検証
2. **外部画像ブロック保全**: `blockExternalLinks` 有効時に外部画像が従来通りブロックされることを検証
3. **data URI画像保全**: `<img src="data:image/png;base64,...">` が変換されずそのまま出力されることを検証
4. **ダイアグラムブロック保全**: Mermaid、PlantUML、SVGブロックが従来通りレンダリングされることを検証

### ユニットテスト

- `resolveImagePaths` 関数の単体テスト: 相対パス、絶対パス、data URI、外部URL、各種相対パスパターン（`./`、`../`、ネスト）
- `buildHtml` に `documentUri` を渡した場合と渡さない場合の動作テスト
- `localResourceRoots` にワークスペースフォルダが含まれることのテスト
- エッジケース: `src` 属性なしの `<img>` タグ、空の `src`、クエリパラメータ付きパス

### プロパティベーステスト

- ランダムな相対パスを生成し、`resolveImagePaths` が全て絶対URIに変換されることを検証
- ランダムな非相対パス（`https://`、`data:`）を生成し、`resolveImagePaths` がそれらを変更しないことを検証
- ランダムなMarkdownコンテンツ（画像なし）を生成し、修正前後で同一のHTML出力を検証

### 統合テスト

- `buildHtml` + `resolveImagePaths` のエンドツーエンドフロー: 相対パス画像を含むMarkdownから完全なHTMLを生成し、画像URIが正しく変換されていることを検証
- `exportToPdf` パスでの画像パス解決: PDFエクスポート時に `file://` パスが正しく生成されることを検証
- インクリメンタル更新時の画像パス解決: `renderBody` 経由の更新でも画像パスが正しく変換されることを検証
