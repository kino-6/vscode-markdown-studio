# 実装計画: PDF Index ページ番号付き目次

## 概要

既存の `pdfIndex.ts` と `exportPdf.ts` の2パスレンダリング基盤を検証・補完し、プロパティベーステストとユニットテストでカバレッジを強化する。主要な実装は既に完了しているため、正確性の検証とテスト追加が中心となる。

## タスク

- [x] 1. pdfIndex.ts の既存実装を検証・補完する
  - [x] 1.1 escapeHtml 関数のシングルクォートエスケープを確認する
    - 現在の `escapeHtml` は `"` をエスケープしているが、`'`（シングルクォート）のエスケープが欠落していないか確認する
    - `pdfHeaderFooter.ts` の `escapeHtml` は `'` → `&#39;` をエスケープしているが、`pdfIndex.ts` の `escapeHtml` には含まれていない
    - 必要に応じて `'` → `&#39;` のエスケープを追加する
    - _Requirements: 6.5_

  - [x] 1.2 anchorId が空文字列の場合の href 属性省略を確認する
    - `buildPdfIndexHtml` で `anchorId` が空の場合に `href` 属性が省略されることを確認する
    - 現在の実装: `const href = e.anchorId ? \` href="#${e.anchorId}"\` : '';` — 正しく動作している
    - _Requirements: 5.1_

  - [x] 1.3 ページ番号表示形式を確認する
    - 要件4.2では「p.N」形式を要求しているが、現在の実装は数値のみ表示
    - 要件と実装の差異を確認し、必要に応じて `p.${page}` 形式に変更する
    - _Requirements: 4.2_

- [ ] 2. プロパティベーステストを作成する（test/unit/pdfIndex.property.test.ts）
  - [ ]* 2.1 Property 1: HTML特殊文字エスケープの完全性テストを書く
    - **Property 1: HTML特殊文字エスケープの完全性**
    - 任意の文字列に対して `escapeHtml` 適用後にエスケープされていない `<`, `>`, `&`, `"` が含まれないことを検証
    - fast-check の `fc.string()` で任意文字列を生成
    - **Validates: Requirements 6.5**

  - [ ]* 2.2 Property 2: buildPdfIndexHtml の構造的正確性テストを書く
    - **Property 2: buildPdfIndexHtml の構造的正確性**
    - 任意の非空 `HeadingPageEntry[]`、タイトル、`pageOffset` に対して出力HTMLが以下を満たすことを検証:
      - 各エントリの表示ページ番号が `pageNumber + pageOffset`
      - 各エントリに `ms-pdf-index-level-{level}` クラスが含まれる
      - 各エントリの `padding-left` が `(level - 1) * 1.5em`
      - `anchorId` が非空の場合 `href="#{anchorId}"` が含まれる
      - `ms-pdf-index` コンテナと `ms-pdf-index-title` タイトルが存在する
    - **Validates: Requirements 1.3, 2.3, 3.3, 5.1, 6.1, 6.2, 7.2**

  - [ ]* 2.3 Property 3: estimateIndexPageCount の計算式テストを書く
    - **Property 3: estimateIndexPageCount の計算式**
    - 任意の非負整数に対して: 0 → 0、1以上 → `ceil(entryCount / 30)`
    - fast-check の `fc.nat()` で非負整数を生成
    - **Validates: Requirements 7.1, 7.4**

  - [ ]* 2.4 Property 4: ページ番号計算の範囲制約テストを書く
    - **Property 4: ページ番号計算の範囲制約**
    - 任意の有効な `offsetTop`（0以上）、`scrollHeight`（正の数）、`totalPages`（1以上）に対して、計算されたページ番号が `[1, totalPages]` の範囲内であることを検証
    - `exportPdf.ts` のページ番号計算ロジックを純粋関数として抽出またはインラインで再現してテスト
    - **Validates: Requirements 2.2**

- [x] 3. チェックポイント - テスト実行確認
  - すべてのテストが通ることを確認し、不明点があればユーザーに質問する。

- [ ] 4. ユニットテストのカバレッジを拡充する（test/unit/pdfIndex.test.ts）
  - [ ]* 4.1 buildPdfIndexHtml の追加テストケースを書く
    - anchorId が空文字列の場合に href 属性が省略されることをテスト
    - タイトルに HTML 特殊文字が含まれる場合のエスケープをテスト
    - 複数レベル（1〜6）のインデント計算をテスト
    - _Requirements: 5.1, 6.2, 6.4, 6.5_

  - [ ]* 4.2 estimateIndexPageCount の境界値テストを追加する
    - entryCount = 1, 29, 30, 31, 60, 61 の各値でテスト
    - _Requirements: 7.1, 7.4_

  - [ ]* 4.3 exportPdf.ts のページ番号計算ロジックのユニットテストを書く
    - offsetTop=0 → ページ1
    - offsetTop=scrollHeight → ページ totalPages（clamp動作）
    - scrollHeight=0 → ratio=0 でページ1
    - _Requirements: 2.1, 2.2_

- [x] 5. 最終チェックポイント - 全テスト通過確認
  - すべてのテストが通ることを確認し、不明点があればユーザーに質問する。

## 備考

- `*` マーク付きタスクはオプションであり、MVP達成のためにスキップ可能
- 各タスクは対応する要件番号を参照しており、トレーサビリティを確保
- プロパティテストは設計書の正確性プロパティに基づいて作成
- 既存の実装が大部分を占めるため、検証と補完が主な作業
