# 実装計画

- [x] 1. バグ条件の探索テストを作成する
  - **Property 1: Bug Condition** - 相対パス画像のURI未変換
  - **重要**: このプロパティベーステストは修正を実装する前に作成すること
  - **目的**: バグの存在を実証する反例を表面化させる
  - **スコープ付きPBTアプローチ**: 相対パス画像（`images/logo.svg`、`../assets/photo.png`、`./diagrams/arch.png`）を含むMarkdownを `buildHtml` に渡し、生成HTMLの `<img src>` が未変換の相対パスのままであることを確認する
  - テスト: ランダムな相対パス文字列を生成し、`buildHtml` の出力HTMLに `vscode-resource://` や `file://` URI ではなく元の相対パスが残っていることをアサートする（設計書のバグ条件 `isBugCondition` に基づく）
  - テストのアサーションは設計書の期待される動作プロパティに一致させる: 全ての相対パス `<img src>` が適切なURIに変換されること
  - 未修正コードでテストを実行する
  - **期待される結果**: テストが失敗する（これはバグの存在を証明するため正しい）
  - **テスト失敗時にコードやテストを修正しないこと**
  - 発見された反例を文書化する（例: `<img src="images/logo.svg">` がそのまま出力され `vscode-resource://` URI に変換されない）
  - テストの作成・実行・失敗の文書化が完了したらタスクを完了とする
  - _Requirements: 1.1, 2.1, 2.3, 2.4_

- [x] 2. 保全プロパティテストを作成する（修正実装前）
  - **Property 2: Preservation** - 非相対パス入力の動作保全
  - **重要**: 観察優先の方法論に従うこと
  - 観察: 画像なしMarkdownを未修正コードの `buildHtml` に渡し、出力HTMLを記録する
  - 観察: 外部画像URL（`https://example.com/img.png`）を含むMarkdownで `blockExternalLinks` 有効時の出力を記録する
  - 観察: data URI画像（`<img src="data:image/png;base64,...">`）を含むMarkdownの出力を記録する
  - 観察: Mermaid・PlantUML・SVGフェンスドブロックを含むMarkdownの出力を記録する
  - プロパティベーステスト作成: 相対パスのローカル画像を含まない全ての入力に対して、`buildHtml` が修正前と同一の結果を生成することを検証する（設計書の保全要件に基づく）
  - プロパティベーステストにより多数のテストケースを自動生成し、手動テストでは見逃しがちなエッジケースを検出する
  - 未修正コードでテストを実行する
  - **期待される結果**: テストが成功する（ベースライン動作の確認）
  - テストの作成・実行・成功の確認が完了したらタスクを完了とする
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 3. ローカル画像パス解決のバグ修正

  - [x] 3.1 `buildHtml` と `renderBody` に `documentUri` パラメータを追加する
    - `src/preview/buildHtml.ts` の `buildHtml` 関数に `documentUri?: vscode.Uri` パラメータを追加する
    - `src/preview/buildHtml.ts` の `renderBody` 関数に `documentUri?: vscode.Uri` パラメータを追加する
    - _Bug_Condition: isBugCondition(input) — htmlBody内の `<img src>` が相対パスかつ documentUri が未提供_
    - _Expected_Behavior: documentUri が提供された場合、相対パスを適切なURIに変換する_
    - _Preservation: documentUri が未提供の場合、既存動作を維持する_
    - _Requirements: 2.1, 2.3_

  - [x] 3.2 画像パス変換関数 `resolveImagePaths` を実装する
    - `src/preview/buildHtml.ts` に `resolveImagePaths(htmlBody: string, documentUri: vscode.Uri, webview?: vscode.Webview): string` 関数を新規作成する
    - 正規表現で `<img>` タグの `src` 属性を抽出する
    - `http://`、`https://`、`data:` で始まるパスはスキップする（変換不要）
    - 相対パスを `vscode.Uri.joinPath(documentDirUri, relativePath)` で絶対URIに解決する
    - Webviewコンテキスト: `webview.asWebviewUri()` で `vscode-resource://` URI に変換する
    - PDFコンテキスト（webview未指定）: `uri.fsPath` を使用して絶対 `file://` パスに変換する
    - `buildHtml` と `renderBody` 内で `renderMarkdownDocument` の結果に対して `resolveImagePaths` を適用する
    - _Bug_Condition: isBugCondition(input) — 相対パスの `<img src>` が存在する_
    - _Expected_Behavior: 全ての相対パスが適切なURIに変換される_
    - _Preservation: 非相対パス（外部URL、data URI）は変更されない_
    - _Requirements: 2.1, 2.3, 2.4_

  - [x] 3.3 `localResourceRoots` にワークスペースフォルダを追加する
    - `src/preview/webviewPanel.ts` の `openOrRefreshPreview` でパネル作成時に `localResourceRoots` を拡張する
    - `vscode.Uri.joinPath(document.uri, '..')` でドキュメントの親ディレクトリを追加する
    - `vscode.workspace.workspaceFolders` の各フォルダのURIを追加する
    - 既存の `media/` と `dist/` は維持する
    - _Bug_Condition: localResourceRoots がワークスペースを含まないためアクセス拒否_
    - _Expected_Behavior: ワークスペースフォルダがルートに含まれ、ローカルファイルにアクセス可能_
    - _Preservation: 既存の media/ と dist/ のルートは維持される_
    - _Requirements: 1.2, 2.2_

  - [x] 3.4 `webviewPanel.ts` の `buildHtml` / `renderBody` 呼び出しを更新する
    - `openOrRefreshPreview` 内の `buildHtml` 呼び出しに `document.uri` を渡す
    - インクリメンタル更新時の `renderBody` 呼び出しにも `document.uri` を渡す
    - _Requirements: 2.1, 3.6_

  - [x] 3.5 `exportToPdf` の `buildHtml` 呼び出しを更新する
    - `src/export/exportPdf.ts` の `buildHtml` 呼び出しに `document.uri` を渡す
    - PDFエクスポート時に相対パスが絶対 `file://` パスに変換されることを確認する
    - _Requirements: 1.3, 2.3_

  - [x] 3.6 バグ条件探索テストが成功することを確認する
    - **Property 1: Expected Behavior** - 相対パス画像のURI変換
    - **重要**: タスク1と同じテストを再実行する（新しいテストを作成しない）
    - タスク1のテストは期待される動作をエンコードしている
    - テストが成功すれば、期待される動作が満たされたことを確認できる
    - バグ条件探索テストを再実行する
    - **期待される結果**: テストが成功する（バグが修正されたことを確認）
    - _Requirements: 2.1, 2.3, 2.4_

  - [x] 3.7 保全テストが引き続き成功することを確認する
    - **Property 2: Preservation** - 非相対パス入力の動作保全
    - **重要**: タスク2と同じテストを再実行する（新しいテストを作成しない）
    - 保全プロパティテストを再実行する
    - **期待される結果**: テストが成功する（リグレッションなしを確認）
    - 修正後も全てのテストが成功することを確認する

- [x] 4. チェックポイント - 全テストの成功を確認する
  - 全てのテストが成功することを確認する。疑問が生じた場合はユーザーに確認する。
