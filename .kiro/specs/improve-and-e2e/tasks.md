# Tasks: Markdown Studio 改善 & E2Eテスト整備

- [x] 1. `ContentCache` に LRU 上限を実装する (R1/D1)
  - [x] 1.1 `src/infra/cache.ts` を修正: コンストラクタに `maxEntries`、`get` で末尾移動、`set` で eviction
  - [x] 1.2 既存のユニットテストが引き続きパスすることを確認

- [x] 2. 一時ファイルのクリーンアップを実装する (R2/D2)
  - [x] 2.1 `src/infra/tempFiles.ts` に追跡配列と `cleanupTempFiles()` を追加
  - [x] 2.2 `src/extension.ts` の `deactivate()` から `cleanupTempFiles()` を呼び出す

- [x] 3. プレビューパネルの再利用ロジックを実装する (R3/D3)
  - [x] 3.1 `src/preview/webviewPanel.ts` にパネル参照の保持・再利用・クリアを実装

- [x] 4. Mermaid の Node.js 環境安全性を強化する (R4/D4)
  - [x] 4.1 `src/renderers/renderMermaid.ts` の `renderMermaidBlock` で DOM 関連エラーをハンドリング

- [x] 5. 不要な `activationEvents` を削除する (R5/D5)
  - [x] 5.1 `package.json` から `onCommand:*` の3エントリを削除

- [x] 6. CSP nonce をランダム生成に変更する (R6/D6)
  - [x] 6.1 `src/preview/buildHtml.ts` で `crypto.randomUUID()` を使用し、CSP ヘッダーと script タグに適用

- [x] 7. E2Eテスト環境を構築する (R7/D7)
  - [x] 7.1 `@vscode/test-electron` と `@vscode/test-cli` をインストール
  - [x] 7.2 E2Eテスト用の設定ファイルとランナーを作成
  - [x] 7.3 拡張機能アクティベーション、プレビュー、環境バリデーションのテストを実装
  - [x] 7.4 `package.json` に `test:e2e` スクリプトを追加

- [x] 8. 全テスト・型チェック・ビルドの最終確認
  - [x] 8.1 `npm run lint` / `npm run test:unit` / `npm run test:integration` / `npm run build` が全てパスすることを確認
