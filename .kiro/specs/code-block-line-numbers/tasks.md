# 実装計画: コードブロック行番号表示機能

## 概要

Markdown Studio VS Code拡張機能のプレビューおよびPDFエクスポートにおいて、コードブロックに行番号を表示する機能を段階的に実装する。新規モジュール `src/parser/lineNumbers.ts` を中心に、既存の `highlightCode.ts`、`parseMarkdown.ts`、`config.ts`、`buildHtml.ts`、`preview.css` を拡張する。各ステップはfast-checkによるプロパティベーステストで検証する。

## タスク

- [ ] 1. データモデル定義と設定基盤の構築
  - [ ] 1.1 `src/types/models.ts` に `CodeBlockConfig` 型を追加する
    - `CodeBlockConfig` インターフェース（`lineNumbers: boolean`）を追加
    - 既存の型定義を壊さないよう末尾に追記
    - _Requirements: 7.1_

  - [ ] 1.2 `package.json` に `markdownStudio.codeBlock.lineNumbers` 設定項目を追加する
    - type: boolean, default: false, description: "コードブロックに行番号を表示する"
    - `contributes.configuration.properties` に追記
    - _Requirements: 7.1_

  - [ ] 1.3 `src/infra/config.ts` に `codeBlock` 設定の読み取りを追加する
    - `MarkdownStudioConfig` に `codeBlock: CodeBlockConfig` プロパティを追加
    - `getConfig()` で `markdownStudio.codeBlock.lineNumbers` を読み取る（デフォルト: `false`）
    - _Requirements: 7.1, 7.2, 7.3_

- [ ] 2. 行番号HTML生成モジュールの実装
  - [ ] 2.1 `src/parser/lineNumbers.ts` を新規作成する
    - `wrapWithLineNumbers(highlightedHtml: string): string` を実装
    - 各行を `<span class="ms-code-line">` で囲み、行番号を `<span class="ms-line-number" data-line="N">` として付与
    - 空文字列の場合は空文字列を返す（空コードブロック対応、要件1.3）
    - 末尾改行による空行には行番号を付与しない
    - `extractCodeContent(lineNumberedHtml: string): string` をテスト用ユーティリティとして実装
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 2.1, 2.3, 3.1_

  - [ ]* 2.2 行番号の連番性と数の一致のプロパティテストを作成する (`test/unit/lineNumbers.property.test.ts`)
    - **Property 1: 行番号の連番性と数の一致**
    - **Validates: Requirements 1.1, 1.5, 2.3**

  - [ ]* 2.3 コード内容のラウンドトリップ保持のプロパティテストを作成する (`test/unit/lineNumbers.property.test.ts`)
    - **Property 3: コード内容のラウンドトリップ保持**
    - **Validates: Requirements 2.1, 2.4, 8.1**

  - [ ]* 2.4 行番号付与の冪等性のプロパティテストを作成する (`test/unit/lineNumbers.property.test.ts`)
    - **Property 4: 行番号付与の冪等性**
    - **Validates: Requirements 8.2**

- [ ] 3. highlightCode と parseMarkdown の変更
  - [ ] 3.1 `src/parser/highlightCode.ts` に `lineNumbers` パラメータを追加する
    - `highlightCode(code: string, lang: string, lineNumbers?: boolean): string` に変更
    - `lineNumbers=true` の場合、highlight.js出力に `wrapWithLineNumbers()` を適用
    - `lineNumbers` 未指定または `false` の場合は既存動作を維持
    - _Requirements: 1.4, 2.1, 2.4, 7.2, 7.3_

  - [ ]* 3.2 無効時の出力不変性のプロパティテストを作成する (`test/unit/highlightCode.lineNumbers.property.test.ts`)
    - **Property 2: 無効時の出力不変性**
    - **Validates: Requirements 1.4, 7.2, 7.3**

  - [ ] 3.3 `src/parser/parseMarkdown.ts` の `createMarkdownParser` にオプションを追加する
    - `createMarkdownParser(options?: { lineNumbers?: boolean }): MarkdownIt` に変更
    - `highlight` コールバック内で `options.lineNumbers` を `highlightCode` に渡す
    - _Requirements: 1.1, 7.2_

  - [ ] 3.4 `src/renderers/renderMarkdown.ts` のパーサー生成を設定対応にする
    - モジュールレベルのシングルトンパーサーを `renderMarkdownDocument()` 内での生成に変更
    - `getConfig().codeBlock.lineNumbers` を `createMarkdownParser()` に渡す
    - _Requirements: 7.2, 7.3, 7.4_

- [ ] 4. チェックポイント - コアモジュールの検証
  - すべてのテストが通ることを確認し、不明点があればユーザーに質問する。

- [ ] 5. CSSスタイルの実装
  - [ ] 5.1 `media/preview.css` に行番号用CSSクラスを追加する
    - `.ms-code-line` のブロック表示スタイル
    - `.ms-line-number` の行番号スタイル（`min-width`, `text-align: right`, `color: #999`, `border-right`, `user-select: none`）
    - ダークテーマ対応（`body.vscode-dark .ms-line-number`）
    - `@media print` での行番号スタイル
    - _Requirements: 2.2, 3.1, 3.2, 5.3, 6.1, 6.2_

  - [ ] 5.2 `src/preview/buildHtml.ts` の `buildStyleBlock()` に行番号用 `@media print` スタイルを追加する
    - 行番号の色、ボーダー、`user-select: none` を `@media print` ブロックに追加
    - _Requirements: 4.2, 4.4, 6.3_

- [ ] 6. チェックポイント - スタイル統合の検証
  - すべてのテストが通ることを確認し、不明点があればユーザーに質問する。

- [ ] 7. ユニットテストとインテグレーションテスト
  - [ ]* 7.1 行番号モジュールのユニットテストを作成する (`test/unit/lineNumbers.test.ts`)
    - 空コードブロックで行番号要素が生成されないこと（要件1.3）
    - 複数行コードで行番号が正しく連番になること（要件1.1）
    - 言語指定なしのプレーンテキストでも行番号が付与されること（要件2.3）
    - _Requirements: 1.1, 1.3, 2.3_

  - [ ]* 7.2 スタイル関連のユニットテストを作成する (`test/unit/lineNumbersStyle.test.ts`)
    - `buildStyleBlock()` の出力に `@media print` 用の行番号スタイルが含まれること（要件4.4）
    - `preview.css` に `user-select: none` が含まれること（要件3.2）
    - ダークテーマ用CSSクラスが存在すること（要件5.3）
    - `package.json` に `markdownStudio.codeBlock.lineNumbers` 設定が定義されていること（要件7.1）
    - _Requirements: 3.2, 4.4, 5.3, 7.1_

  - [ ]* 7.3 行番号パイプラインのインテグレーションテストを作成する (`test/integration/lineNumbers.integration.test.ts`)
    - Markdownソースからプレビュー用HTML生成までのエンドツーエンドフロー
    - 行番号有効時にコードブロックに `ms-line-number` クラスが含まれること（要件5.1, 5.2）
    - 行番号無効時にコードブロックに `ms-line-number` クラスが含まれないこと（要件1.4）
    - PDFエクスポートとプレビューで同一の行番号HTMLが使用されること（要件5.2）
    - _Requirements: 1.4, 4.1, 5.1, 5.2_

- [ ] 8. 最終チェックポイント - 全テスト通過の確認
  - すべてのテストが通ることを確認し、不明点があればユーザーに質問する。

## 備考

- `*` マーク付きのタスクはオプションであり、MVP優先の場合はスキップ可能
- 各タスクは特定の要件を参照しており、トレーサビリティを確保
- チェックポイントで段階的に検証を実施
- プロパティテストは設計書の正確性プロパティ（Property 1〜4）に対応
- ユニットテストは特定のエッジケースと例示ベースの検証を担当
