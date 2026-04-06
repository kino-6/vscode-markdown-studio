# 実装計画: TOC自動生成機能

## 概要

Markdown Studio VS Code拡張機能にTOC（目次）自動生成機能を追加する。5つの新規モジュール（`src/toc/`配下）を段階的に実装し、既存のレンダリングパイプラインに統合する。各モジュールはfast-checkによるプロパティベーステストで検証する。

## タスク

- [x] 1. データモデル定義と設定基盤の構築
  - [x] 1.1 `src/types/models.ts` にTOC関連の型定義を追加する
    - `HeadingEntry`, `AnchorMapping`, `TocConfig`, `TocDiagnostic`, `TocResult` インターフェースを追加
    - 既存の型定義を壊さないよう末尾に追記
    - _Requirements: 1.2, 2.1, 3.1, 8.1_

  - [x] 1.2 `src/infra/config.ts` にTOC設定の読み取りを追加する
    - `MarkdownStudioConfig` に `toc` プロパティ（`TocConfig`型）を追加
    - `getConfig()` で `markdownStudio.toc.levels`, `markdownStudio.toc.orderedList`, `markdownStudio.toc.pageBreak` を読み取る
    - `levels` 文字列（例: "1-3"）を `minLevel`/`maxLevel` にパースするヘルパー関数を実装
    - 不正な値の場合はデフォルト値（1〜3）にフォールバック
    - _Requirements: 9.1, 9.2, 9.3_

  - [x] 1.3 `package.json` にTOC設定項目を追加する
    - `markdownStudio.toc.levels` (string, default: "1-3")
    - `markdownStudio.toc.orderedList` (boolean, default: false)
    - `markdownStudio.toc.pageBreak` (boolean, default: true)
    - _Requirements: 9.1, 9.2, 9.3_

- [x] 2. 見出し抽出モジュールの実装
  - [x] 2.1 `src/toc/extractHeadings.ts` を作成する
    - `extractHeadings(markdown: string, md: MarkdownIt): HeadingEntry[]` を実装
    - markdown-itの `parse()` でトークン列を取得し、`heading_open`/`inline`/`heading_close` シーケンスを走査
    - インライン書式の除去: `inline` トークンの `children` を再帰走査し `text` タイプのみ結合
    - コードブロック除外: `scanFencedBlocks()` の結果と行番号を照合
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 2.2 見出し抽出のプロパティテストを作成する (`test/unit/extractHeadings.property.test.ts`)
    - **Property 1: 見出し抽出の完全性とメタデータ保持**
    - **Validates: Requirements 1.1, 1.2**

  - [x] 2.3 インライン書式除去のプロパティテストを作成する (`test/unit/extractHeadings.property.test.ts`)
    - **Property 2: インライン書式の除去**
    - **Validates: Requirements 1.3**

  - [x] 2.4 コードブロック除外のプロパティテストを作成する (`test/unit/extractHeadings.property.test.ts`)
    - **Property 3: コードブロック内見出しの除外**
    - **Validates: Requirements 1.4**

- [x] 3. アンカーID生成モジュールの実装
  - [x] 3.1 `src/toc/anchorResolver.ts` を作成する
    - `slugify(text: string): string` を実装（小文字変換、空白→ハイフン、非許可文字除去、非ASCII保持）
    - `resolveAnchors(headings: HeadingEntry[]): AnchorMapping[]` を実装（重複時に連番サフィックス付与）
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.2 スラッグ形式のプロパティテストを作成する (`test/unit/anchorResolver.property.test.ts`)
    - **Property 4: スラッグ形式の準拠と非ASCII文字の保持**
    - **Validates: Requirements 2.1, 2.3**

  - [x] 3.3 重複アンカーIDの一意性プロパティテストを作成する (`test/unit/anchorResolver.property.test.ts`)
    - **Property 5: 重複アンカーIDの一意性**
    - **Validates: Requirements 2.2**

  - [x] 3.4 アンカーID冪等性のプロパティテストを作成する (`test/unit/anchorResolver.property.test.ts`)
    - **Property 6: アンカーID生成の冪等性**
    - **Validates: Requirements 2.4**

- [x] 4. チェックポイント - 基盤モジュールの検証
  - すべてのテストが通ることを確認し、不明点があればユーザーに質問する。

- [x] 5. TOC HTML生成モジュールの実装
  - [x] 5.1 `src/toc/buildToc.ts` を作成する
    - `buildTocHtml(anchors: AnchorMapping[], config: TocConfig): string` を実装
    - `<nav class="ms-toc">` コンテナで囲む
    - スタックベースのアルゴリズムで見出しレベルに応じたネスト構造（`<ul>`/`<ol>` + `<li>`）を構築
    - 各エントリに `<a href="#anchor-id">` リンクを生成
    - `pageBreak=true` の場合、`<nav>` に `style="page-break-before: always; page-break-after: always;"` を付与
    - `minLevel`〜`maxLevel` 範囲外の見出しをフィルタリング
    - 見出しが空の場合は空の `<nav class="ms-toc"></nav>` を生成
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 6.4, 9.1, 9.2, 9.3_

  - [x] 5.2 TOC HTML構造のプロパティテストを作成する (`test/unit/buildToc.property.test.ts`)
    - **Property 7: TOC HTML構造の正確性**
    - **Validates: Requirements 3.1, 3.2, 3.3**

  - [x] 5.3 TOCラウンドトリップのプロパティテストを作成する (`test/unit/buildToc.property.test.ts`)
    - **Property 8: TOCラウンドトリップ**
    - **Validates: Requirements 3.5**

  - [x] 5.4 見出しレベルフィルタリングのプロパティテストを作成する (`test/unit/buildToc.property.test.ts`)
    - **Property 15: 見出しレベルフィルタリング**
    - **Validates: Requirements 9.1**

  - [x] 5.5 リスト種別切り替えのプロパティテストを作成する (`test/unit/buildToc.property.test.ts`)
    - **Property 16: 順序付き/順序なしリストの切り替え**
    - **Validates: Requirements 9.2**

  - [x] 5.6 改ページCSS注入のプロパティテストを作成する (`test/unit/buildToc.property.test.ts`)
    - **Property 13: 改ページCSS注入のトグル**
    - **Validates: Requirements 6.4, 9.3**

- [x] 6. TOCマーカー処理モジュールの実装
  - [x] 6.1 `src/toc/tocMarker.ts` を作成する
    - `findTocMarker(markdown: string, fencedRanges: Array<{startLine: number; endLine: number}>): number` を実装
    - `replaceTocMarker(html: string, tocHtml: string): string` を実装
    - 正規表現 `/\[\[toc\]\]|\[toc\]/gi` でマーカー検出（大文字小文字非区別）
    - コードブロック内マーカーの除外（`scanFencedBlocks` の行範囲を利用）
    - 最初のマーカーのみTOC HTMLに置換、残りは除去
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 6.2 TOCマーカー置換のプロパティテストを作成する (`test/unit/tocMarker.property.test.ts`)
    - **Property 9: TOCマーカー置換（大文字小文字非区別）**
    - **Validates: Requirements 4.1, 4.2**

  - [x] 6.3 複数マーカー処理のプロパティテストを作成する (`test/unit/tocMarker.property.test.ts`)
    - **Property 10: 複数マーカーの最初のみ置換**
    - **Validates: Requirements 4.3**

  - [x] 6.4 マーカー不在・コードブロック内マーカーのプロパティテストを作成する (`test/unit/tocMarker.property.test.ts`)
    - **Property 11: マーカー不在・コードブロック内マーカーの除外**
    - **Validates: Requirements 4.4, 4.5**

- [x] 7. チェックポイント - コアモジュールの検証
  - すべてのテストが通ることを確認し、不明点があればユーザーに質問する。

- [x] 8. アンカーリンク検証モジュールの実装
  - [x] 8.1 `src/toc/tocValidator.ts` を作成する
    - `validateAnchors(anchors: AnchorMapping[], headingIds: Set<string>): TocDiagnostic[]` を実装（純粋関数）
    - `publishDiagnostics(diagnostics: TocDiagnostic[], documentUri: vscode.Uri, collection: vscode.DiagnosticCollection): void` を実装
    - 対応する見出しIDが存在しないアンカーリンクを無効として検出
    - 診断メッセージに無効なアンカーIDと期待される見出しテキストを含める
    - すべてのアンカーが有効な場合は既存の診断をクリア
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [x] 8.2 アンカー検証のプロパティテストを作成する (`test/unit/tocValidator.property.test.ts`)
    - **Property 14: アンカー検証の正確性**
    - **Validates: Requirements 8.1, 8.2, 8.4**

- [x] 9. レンダリングパイプラインへの統合
  - [x] 9.1 `src/renderers/renderMarkdown.ts` にTOCマーカー置換を統合する
    - `renderMarkdownDocument()` 内で、markdown-itレンダリング後にTOC生成パイプラインを実行
    - `extractHeadings` → `resolveAnchors` → `buildTocHtml` → `replaceTocMarker` の順で呼び出し
    - `getConfig().toc` から設定を取得
    - 見出しにアンカーID属性（`id="anchor-id"`）を付与するためのmarkdown-itレンダラールール追加
    - _Requirements: 1.1, 3.1, 4.1, 6.3_

  - [x] 9.2 プレビューとPDFで同一TOC HTMLのプロパティテストを作成する (`test/unit/renderMarkdown.toc.property.test.ts`)
    - **Property 12: プレビューとPDFで同一のTOC HTML**
    - **Validates: Requirements 6.3**

- [x] 10. プレビューとPDFエクスポートの統合
  - [x] 10.1 `media/preview.css` にTOCスタイルを追加する
    - `.ms-toc` コンテナのスタイル（マージン、パディング、ボーダー）
    - `.ms-toc a` リンクスタイル
    - `.ms-toc ul`, `.ms-toc ol`, `.ms-toc li` のリストスタイル
    - ダークテーマ対応（`body.vscode-dark .ms-toc`）
    - `@media print` でのTOCスタイル
    - _Requirements: 5.1, 5.3_

  - [x] 10.2 `media/preview.js` にTOCリンクのスクロール処理を追加する
    - `.ms-toc a` のクリックイベントハンドラを追加
    - `href` のアンカーIDに対応する要素へスムーズスクロール
    - `update-body` メッセージ受信時にもイベントハンドラを再登録
    - _Requirements: 5.1, 5.2_

  - [x] 10.3 `src/preview/webviewPanel.ts` にTOC診断の統合を追加する
    - `vscode.languages.createDiagnosticCollection('markdownStudio.toc')` で診断コレクションを作成
    - `onDidChangeTextDocument` ハンドラ内でTOC検証を実行し診断を発行
    - パネル破棄時に診断コレクションをdispose
    - _Requirements: 7.1, 7.2, 7.3, 8.3, 8.5_

  - [x] 10.4 `src/export/exportPdf.ts` にTOC改ページCSS注入を追加する
    - `toc.pageBreak` 設定が有効な場合、TOCコンテナの改ページCSSが正しく適用されることを確認
    - 既存の `injectPageBreakCss` との整合性を確認
    - _Requirements: 6.1, 6.2, 6.4_

- [x] 11. チェックポイント - 統合の検証
  - すべてのテストが通ることを確認し、不明点があればユーザーに質問する。

- [x] 12. ユニットテストとインテグレーションテスト
  - [x] 12.1 見出し抽出のユニットテストを作成する (`test/unit/extractHeadings.test.ts`)
    - 空ドキュメント、h1〜h6混在、インライン書式付き見出し、コードブロック内見出しのテストケース
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 12.2 TOC生成のユニットテストを作成する (`test/unit/buildToc.test.ts`)
    - 空の見出しリストでの空TOCコンテナ生成、ネスト構造の正確性
    - _Requirements: 3.1, 3.4_

  - [x] 12.3 TOCマーカーのユニットテストを作成する (`test/unit/tocMarker.test.ts`)
    - マーカー不在、コードブロック内マーカー、複数マーカーのテストケース
    - _Requirements: 4.3, 4.4, 4.5_

  - [x] 12.4 TOCパイプラインのインテグレーションテストを作成する (`test/integration/toc.integration.test.ts`)
    - Markdownソースからプレビュー用HTML生成までのエンドツーエンドフロー
    - TOCマーカー置換、アンカーリンク生成、見出しID付与の統合確認
    - _Requirements: 5.1, 6.1, 6.3, 7.1_

- [x] 13. 最終チェックポイント - 全テスト通過の確認
  - すべてのテストが通ることを確認し、不明点があればユーザーに質問する。

## 備考

- `*` マーク付きのタスクはオプションであり、MVP優先の場合はスキップ可能
- 各タスクは特定の要件を参照しており、トレーサビリティを確保
- チェックポイントで段階的に検証を実施
- プロパティテストは設計書の正確性プロパティ（Property 1〜16）に対応
- ユニットテストは特定のエッジケースと例示ベースの検証を担当
