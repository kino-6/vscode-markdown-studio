# バグ修正要件ドキュメント

## はじめに

Markdownファイル内でローカル画像を相対パスで参照した場合（例: `![Logo](images/logo.svg)`）、Webviewプレビューおよび PDF エクスポートで画像が表示されない。壊れた画像アイコンが表示される。

原因は2つある:
1. `webviewPanel.ts` の `localResourceRoots` がエクステンションの `media/` と `dist/` ディレクトリのみを許可しており、ユーザーのワークスペースファイルにアクセスできない
2. Markdown内の相対画像パス（例: `images/logo.svg`）が、Webviewが読み込める `vscode-resource://` URI に変換されていない

## バグ分析

### 現在の動作（不具合）

1.1 WHEN Markdownファイルが相対パスでローカル画像を参照している場合（例: `![Logo](images/logo.svg)`）THEN Webviewプレビューで壊れた画像アイコンが表示され、画像が描画されない

1.2 WHEN Markdownファイルが相対パスでローカル画像を参照している場合 THEN `localResourceRoots` にワークスペースディレクトリが含まれていないため、Webviewがファイルへのアクセスを拒否する

1.3 WHEN 相対画像パスを含むMarkdownをPDFエクスポートする場合 THEN 相対パスが絶対 `file://` パスに解決されないため、PDF内で画像が表示されない

1.4 WHEN Markdownファイルがサブディレクトリ内の画像を参照している場合（例: `![](../assets/photo.png)`）THEN 親ディレクトリへの相対パスも解決されず、画像が表示されない

### 期待される動作（正しい動作）

2.1 WHEN Markdownファイルが相対パスでローカル画像を参照している場合 THEN システムは相対パスを `webview.asWebviewUri()` を使用してWebview互換URIに変換し、プレビューで画像を正しく表示するものとする（SHALL）

2.2 WHEN Webviewパネルを作成する場合 THEN システムはドキュメントの親ディレクトリおよびワークスペースフォルダを `localResourceRoots` に追加し、ローカルファイルへのアクセスを許可するものとする（SHALL）

2.3 WHEN 相対画像パスを含むMarkdownをPDFエクスポートする場合 THEN システムは相対パスをドキュメントの場所を基準とした絶対 `file://` パスに解決し、PDF内で画像を正しく表示するものとする（SHALL）

2.4 WHEN Markdownファイルがサブディレクトリや親ディレクトリへの相対パスで画像を参照している場合 THEN システムはそれらのパスも正しく解決し、画像を表示するものとする（SHALL）

### 変更されない動作（リグレッション防止）

3.1 WHEN Markdownに画像が含まれていない場合 THEN システムはプレビューとPDFエクスポートを従来通り正しくレンダリングし続けるものとする（SHALL CONTINUE TO）

3.2 WHEN `blockExternalLinks` が有効で外部画像URL（`https://...`）が参照されている場合 THEN システムは従来通り外部画像をブロックし、ポリシー通知を表示し続けるものとする（SHALL CONTINUE TO）

3.3 WHEN Mermaid、PlantUML、SVGのフェンスドブロックが含まれている場合 THEN システムはそれらのダイアグラムを従来通り正しくレンダリングし続けるものとする（SHALL CONTINUE TO）

3.4 WHEN data URI画像（例: `<img src="data:image/png;base64,...">`）が含まれている場合 THEN システムは従来通りインライン画像を正しく表示し続けるものとする（SHALL CONTINUE TO）

3.5 WHEN CSPヘッダーが設定されている場合 THEN システムは `img-src` に `${cspSource}` と `data:` を含む既存のCSPポリシーを維持し続けるものとする（SHALL CONTINUE TO）

3.6 WHEN インクリメンタル更新（`update-body` メッセージ）が発生する場合 THEN システムは従来通り差分更新を正しく処理し続けるものとする（SHALL CONTINUE TO）
