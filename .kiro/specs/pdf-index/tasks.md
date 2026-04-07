# 実装計画: PDF Index with Page Numbers

## タスク

- [ ] 1. 設定と型定義の追加
  - [ ] 1.1 `src/types/models.ts` に `PdfIndexConfig` インターフェースを追加
  - [ ] 1.2 `package.json` に `pdfIndex.enabled` と `pdfIndex.title` 設定キーを追加
  - [ ] 1.3 `src/infra/config.ts` に `pdfIndex` フィールドを追加し `getConfig()` で読み取る

- [ ] 2. PDF目次生成モジュールの実装
  - [ ] 2.1 `src/export/pdfIndex.ts` を新規作成
    - `HeadingPageEntry` インターフェース
    - `buildPdfIndexHtml()` — ページ番号付き目次HTML生成
    - `estimateIndexPageCount()` — 目次ページ数の推定
  - [ ] 2.2 目次用CSSを `media/preview.css` に追加（ドットリーダー、インデント、print対応）
  - [ ] 2.3 ユニットテスト `test/unit/pdfIndex.test.ts`

- [ ] 3. exportToPdfへの2パスレンダリング統合
  - [ ] 3.1 `src/export/exportPdf.ts` に `resolveHeadingPages()` を追加（Playwright page.evaluate）
  - [ ] 3.2 `exportToPdf()` に2パスレンダリングロジックを統合
    - Pass 1: 通常レンダリング → 見出しページ番号取得
    - 目次HTML生成 → body先頭に挿入
    - Pass 2: 最終PDF生成

- [ ] 4. テスト確認とdemo更新
  - [ ] 4.1 全テスト通過確認
  - [ ] 4.2 `examples/demo.md` にPDF Index使用方法のセクション追加
