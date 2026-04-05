# 実装計画: スタイルプリセット

## 概要

プリセット定義・解決ロジックを純粋関数として実装し、既存の `buildStyleBlock` と `getConfig` を拡張してプリセット対応にする。package.json に設定スキーマを追加し、プレビューと PDF エクスポートの両方にプリセット CSS を反映する。

## タスク

- [x] 1. 型定義とプリセット定数の追加
  - [x] 1.1 `src/types/models.ts` に `PresetName`, `HeadingStyle`, `CodeBlockStyle`, `PresetStyleDefaults`, `ResolvedStyleConfig`, `StyleConfigOverrides` 型を追加する
    - 設計書のデータモデルセクションに従って型を定義する
    - 既存の `StyleConfig` は `ResolvedStyleConfig` に置き換えるか拡張する
    - _要件: 1.1, 2.5, 2.6, 7.1_

  - [x] 1.2 `src/infra/presets.ts` を新規作成し、`PRESET_DEFAULTS` 定数マップと `resolvePreset()` 関数を実装する
    - 5種類のプリセット（`markdown-pdf`, `github`, `minimal`, `academic`, `custom`）のデフォルト値を定義する
    - `resolvePreset(presetName, overrides)` を純粋関数として実装する
    - 無効なプリセット名は `markdown-pdf` にフォールバックする
    - `custom` プリセットはオーバーライド値とシステムデフォルトのみ使用する
    - _要件: 1.3, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.1, 3.2, 3.3, 3.4, 3.5, 7.1, 7.2, 7.3_

  - [ ]* 1.3 `resolvePreset` のプロパティベーステストを作成する（`test/unit/stylePresets.property.test.ts`）
    - **Property 1: 無効なプリセット名のフォールバック**
    - **Validates: 要件 1.3**

  - [ ]* 1.4 `resolvePreset` のプロパティベーステストを作成する
    - **Property 2: プリセットデフォルトの完全性**
    - **Validates: 要件 2.5, 2.6, 7.3**

  - [ ]* 1.5 `resolvePreset` のプロパティベーステストを作成する
    - **Property 3: オーバーライドの優先**
    - **Validates: 要件 3.1, 3.2, 3.3, 3.4**

  - [ ]* 1.6 `resolvePreset` のプロパティベーステストを作成する
    - **Property 4: custom プリセットはプリセットデフォルトを無視**
    - **Validates: 要件 3.5**

  - [ ]* 1.7 `resolvePreset` のプロパティベーステストを作成する
    - **Property 5: 参照透過性**
    - **Validates: 要件 7.1, 7.2**

- [x] 2. チェックポイント - プリセット解決ロジックの検証
  - すべてのテストが通ることを確認し、不明点があればユーザーに質問する。

- [x] 3. `buildStyleBlock` の拡張
  - [x] 3.1 `src/preview/buildHtml.ts` の `buildStyleBlock` を `ResolvedStyleConfig` を受け取るように拡張する
    - プリセット固有のコードブロックスタイル（背景色、ボーダー、パディング）を CSS に含める
    - プリセット固有の見出しスタイルを CSS に含める
    - `@media print` セクションにプリセットのスタイルを反映する
    - `github` プリセット: GitHub Flavored Markdown 準拠のコードブロックスタイル
    - `minimal` プリセット: 余白の広い簡潔なコードブロックスタイル
    - `academic` プリセット: センタリングされた h1、論文スタイルの見出し
    - _要件: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [ ]* 3.2 `buildStyleBlock` のプロパティベーステストを作成する（`test/unit/stylePresets.property.test.ts` に追加）
    - **Property 6: CSS 出力の正当性**
    - **Validates: 要件 4.1, 4.5**

  - [ ]* 3.3 `buildStyleBlock` のユニットテストを作成する（`test/unit/stylePresets.test.ts`）
    - 各プリセットの具体的なデフォルト値の検証
    - `github` プリセットの CSS にコードブロックスタイルが含まれることの検証
    - `minimal` プリセットの CSS に余白の広いコードブロックスタイルが含まれることの検証
    - `academic` プリセットの CSS にセンタリングされた h1 が含まれることの検証
    - _要件: 2.1, 2.2, 2.3, 2.4, 4.2, 4.3, 4.4_

- [x] 4. `getConfig` の拡張と package.json 設定スキーマの追加
  - [x] 4.1 `package.json` に `markdownStudio.style.preset` 設定を追加する
    - enum 型: `markdown-pdf`, `github`, `minimal`, `academic`, `custom`
    - デフォルト値: `markdown-pdf`
    - _要件: 1.1, 1.2_

  - [x] 4.2 `src/infra/config.ts` の `getConfig()` を拡張し、プリセット設定を読み取って `resolvePreset()` を呼び出すようにする
    - `markdownStudio.style.preset` 設定の読み取り
    - ユーザーが明示的に設定した個別スタイル値をオーバーライドとして渡す
    - `MarkdownStudioConfig.style` の型を `ResolvedStyleConfig` に変更する
    - _要件: 1.1, 1.2, 1.3, 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 5. プレビューと PDF エクスポートの統合
  - [x] 5.1 `src/preview/buildHtml.ts` の `buildHtml` が `ResolvedStyleConfig` を使って `buildStyleBlock` を呼び出すように更新する
    - 既存の `onDidChangeConfiguration` リスナーによりプリセット変更時にプレビューが自動更新されることを確認する
    - _要件: 5.1, 5.2, 5.3_

  - [x] 5.2 `src/export/exportPdf.ts` がプリセットの余白値を Playwright の PDF マージンとして使用することを確認する
    - `ResolvedStyleConfig.margin` が PDF エクスポートに正しく渡されることを確認する
    - _要件: 6.1, 6.2, 6.3_

  - [ ]* 5.3 プレビューと PDF の統合テストを作成する
    - プリセット変更時にプレビューが更新されることの検証
    - PDF エクスポートがプリセットの余白値を使用することの検証
    - _要件: 5.1, 5.2, 6.2, 6.3_

- [x] 6. 最終チェックポイント - 全テスト通過の確認
  - すべてのテストが通ることを確認し、不明点があればユーザーに質問する。

## 備考

- `*` 付きのタスクはオプションであり、MVP では省略可能
- 各タスクは具体的な要件を参照しており、トレーサビリティを確保している
- チェックポイントで段階的に検証を行う
- プロパティベーステストは fast-check を使用して正当性プロパティを検証する
- ユニットテストは具体的な値とエッジケースを検証する
