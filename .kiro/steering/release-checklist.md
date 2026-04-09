---
inclusion: manual
---

# Release Checklist

Before tagging and packaging a release, verify the following:

1. `package.json` の `version` がリリースバージョンと一致していること
2. `CHANGELOG.md` にリリースバージョンのエントリがあること
3. `npm run test:ci` が全パスすること
4. `npm run build` が成功すること
5. Roadmap の実装済み項目が更新されていること
6. demo.md に新機能のサンプルが追加されていること

## Tag & Package

```bash
git checkout main
git merge feature/xxx --no-ff -m "Merge feature/xxx: description"

# version確認（package.jsonとタグが一致すること）
grep '"version"' package.json

git tag -a vX.Y.Z -m "vX.Y.Z: summary"
npm run package
```

## TypeScript型チェック観点（`npm run lint` = `tsc --noEmit`）

v0.6.0 の CI 失敗（15件の型エラー）から得られた知見：

### Playwright コールバック内の DOM 型
- `page.waitForFunction()` や `page.evaluate()` に渡すコールバック内の `document` は、ブラウザコンテキストで実行される
- しかし `tsconfig.json` の `types: ["node", "vscode"]` により、グローバルの `document` が VS Code の `TextDocument` として解決される
- 対策: コールバックは文字列リテラルで渡すか、`// @ts-ignore` ではなく型アサーションを使う

### インライン型とインターフェースの乖離
- `buildHtml` の `assets` パラメータのようにインライン型を使っている場合、元のインターフェース（`PreviewAssetUris`）にプロパティを追加しても反映されない
- 対策: 共通インターフェースを import して使う。インライン型のコピーを避ける

### 外部パッケージの型パス変更
- `markdown-it` v14 で `markdown-it/lib/token` のパスが変わった
- 対策: メジャーバージョンアップ時は型の import パスが変わっていないか確認する

### テストファイルの module 互換性
- `module: "commonjs"` ではトップレベル `await` が使えない
- `media/preview.js` のような `.js` ファイルを import するテストには型宣言（`.d.ts`）が必要
- 対策: 問題のあるテストファイルは `tsconfig.json` の `exclude` に追加するか、テスト用の別 tsconfig を用意する

### 型定義への新プロパティ追加
- `MarkdownStudioConfig` に新プロパティ（例: `pdfToc`）を追加したら、テストのフィクスチャも更新する
- 対策: `grep -r 'MarkdownStudioConfig' test/` で使用箇所を確認してから型を変更する

### リリース前の確認手順
```bash
# 型チェック（CIと同じ）
npm run lint

# 上記が通ったら単体テスト
npm run test:unit

# 統合テスト（モック不整合はここで検出される）
npm run test:integration
```

### Integrationテストのモック管理
- `exportToPdf` のような複雑な関数は Playwright page, fs, config 等多数のモックが必要
- 実装に新しいメソッド呼び出しや config プロパティを追加したら、対応する integration テストのモックも必ず更新する
- 対策: `npm run test:integration` をローカルで実行してからコミットする

## よくあるミス

- package.json の version を更新し忘れてタグを打つ → タグ打ち直しが必要になる
- CHANGELOG にエントリを書き忘れる
- examples/ のPDFサンプルを更新し忘れる
- **型定義を変更したのにテストフィクスチャを更新し忘れる**（v0.6.0 で発生）
- **インライン型を使っている箇所に新プロパティが反映されない**（v0.6.0 で発生）
- **外部パッケージのメジャーバージョンアップ後に型の import パスが壊れる**（v0.6.0 で発生）
- **integrationテストのモックが実装の変更に追従していない**（v0.7.0 で発生）— `exportToPdf` に Playwright の `setViewportSize`/`addScriptTag`/`evaluate` 等を追加したのに、テストの page mock が古いまま。configモックも `outputFilename`/`previewTheme` 等の新プロパティが不足していた
- **行番号カウントのロジック変更がテストの期待値に反映されていない**（v0.7.0 で発生）— `countLines` の trailing newline 処理が変わったのに integration テストの期待値が旧ロジックのまま
