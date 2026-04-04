# Requirements: Markdown Studio 改善 & E2Eテスト整備

## 背景
Codex で生成されたプロジェクトのコードレビューにより、動作に支障のあるバグは修正済み。
残る改善提案を実装し、E2Eテストが通る状態まで品質を引き上げる。

## 要件

### R1: メモリリーク防止
- `ContentCache` にエントリ数上限（LRU eviction）を設ける

### R2: 一時ファイルのクリーンアップ
- PlantUML レンダリングで生成される `.puml` / `.svg` 一時ファイルを追跡し、拡張機能の deactivate 時に削除する

### R3: プレビューパネルの再利用
- `openOrRefreshPreview` で既存パネルがあれば再利用し、パネルが増殖しないようにする

### R4: Mermaid の Node.js 安全性
- `mermaid.parse()` は DOM 依存の可能性がある。Node.js 環境で安全に構文チェックできるよう対策する

### R5: 不要な activationEvents の削除
- `package.json` の `onCommand:*` は VS Code が自動生成するため削除する

### R6: CSP nonce のランダム化
- `buildHtml.ts` の nonce を固定値 `"markdown-studio"` からリクエストごとのランダム値に変更する

### R7: E2Eテスト整備
- 拡張機能のロード → プレビュー表示 → PDF出力の一連フローを検証するE2Eテストを構築する
