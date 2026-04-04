# Design: Markdown Studio 改善 & E2Eテスト整備

## D1: ContentCache LRU (R1)
- `Map` の挿入順を利用した簡易 LRU を実装
- デフォルト上限 128 エントリ、`get` 時に末尾へ移動、`set` 時に先頭を evict
- コンストラクタで `maxEntries` を受け取れるようにする

## D2: 一時ファイルクリーンアップ (R2)
- `tempFiles.ts` にモジュールレベルの追跡配列を追加
- `cleanupTempFiles()` を export し、各ファイルと対応する `.svg` を削除
- `extension.ts` の `deactivate()` から呼び出す

## D3: パネル再利用 (R3)
- `webviewPanel.ts` にモジュールレベルで現在のパネル参照を保持
- パネルが生存中なら `reveal()` + コンテンツ更新のみ行う
- `onDidDispose` で参照をクリア

## D4: Mermaid Node.js 安全性 (R4)
- `mermaid.parse()` を try-catch で囲み、DOM 関連エラー時は構文チェックをスキップして placeholder を返す
- エラーメッセージに「Node.js 環境では構文検証が制限される」旨を含める

## D5: activationEvents 整理 (R5)
- `package.json` の `activationEvents` から `onCommand:*` の3行を削除
- `onLanguage:markdown` のみ残す

## D6: CSP nonce ランダム化 (R6)
- `buildHtml.ts` で `crypto.randomUUID()` を使い、呼び出しごとにユニークな nonce を生成
- CSP ヘッダーと `<script>` タグの両方に同じ nonce を適用

## D7: E2Eテスト (R7)
- `@vscode/test-electron` を使った VS Code 拡張機能の E2E テスト環境を構築
- テストシナリオ:
  1. 拡張機能が正常にアクティベートされること
  2. Markdown ファイルを開いてプレビューコマンドが実行できること
  3. PDF エクスポートコマンドが実行でき、ファイルが生成されること
  4. 環境バリデーションコマンドが実行できること
