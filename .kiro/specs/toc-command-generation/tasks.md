# 実装計画: TOCコマンド生成機能

## 概要

Markdown Studio VS Code拡張機能に「Markdown Studio: Insert TOC」コマンドを追加し、Markdownテキスト形式のTOCをソースファイルに直接挿入・自動更新する機能を実装する。既存の `src/toc/` モジュール群を再利用し、新規モジュール（`buildTocMarkdown.ts`, `tocCommentMarker.ts`, `insertToc.ts`）を段階的に実装する。

## タスク

- [x] 1. TOC Markdownテキスト生成モジュールの実装
  - [x] 1.1 `src/toc/buildTocMarkdown.ts` を作成する
    - `buildTocMarkdown(anchors: AnchorMapping[], config: TocConfig): string` を実装
    - 各エントリを `- [テキスト](#anchor-id)` 形式（順序なし）または `1. [テキスト](#anchor-id)` 形式（順序付き）で生成
    - 見出しレベルに応じた2スペースインデントでネスト構造を表現（最小レベルからの相対深度）
    - `minLevel`〜`maxLevel` 範囲外の見出しをフィルタリング
    - 見出しが空の場合は空文字列を返す
    - `parseTocLinks(tocText: string): Array<{text, anchor}>` をラウンドトリップ検証用に実装
    - _Requirements: 2.1, 2.2, 2.5, 2.6_

  - [x] 1.2 TOC Markdownフォーマットのプロパティテストを作成する (`test/unit/buildTocMarkdown.property.test.ts`)
    - Property 1: TOC Markdownテキストのフォーマット正確性
    - Feature: toc-command-generation, Property 1
    - _Validates: Requirements 1.4, 2.1, 2.2_

  - [x] 1.3 TOCテキストのラウンドトリッププロパティテストを作成する (`test/unit/buildTocMarkdown.property.test.ts`)
    - Property 2: TOCテキストのラウンドトリップ
    - Feature: toc-command-generation, Property 2
    - _Validates: Requirements 2.5_

  - [x] 1.4 順序付き/順序なしリスト切り替えのプロパティテストを作成する (`test/unit/buildTocMarkdown.property.test.ts`)
    - Property 8: 順序付き/順序なしリストの切り替え
    - Feature: toc-command-generation, Property 8
    - _Validates: Requirements 2.1, 8.2_

  - [x] 1.5 `buildTocMarkdown` のユニットテストを作成する (`test/unit/buildTocMarkdown.test.ts`)
    - 空の見出しリスト、単一見出し、深いネスト（h1→h2→h3）、日本語見出し、レベル範囲外フィルタリングのテストケース
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 2. TOCコメントマーカー処理モジュールの実装
  - [x] 2.1 `src/toc/tocCommentMarker.ts` を作成する
    - `findTocCommentMarkers(markdown, fencedRanges?): TocMarkerRange | undefined` を実装
    - `wrapWithMarkers(tocText): string` を実装
    - `replaceTocContent(markdown, markerRange, newTocText): string` を実装
    - 開始マーカー `<!-- TOC -->` と終了マーカー `<!-- /TOC -->` の検出（前後空白許容）
    - コードブロック内マーカーの除外（`scanFencedBlocks()` を再利用）
    - 終了マーカー欠落時は `undefined` を返す
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [x] 2.2 コメントマーカーのラウンドトリッププロパティテストを作成する (`test/unit/tocCommentMarker.property.test.ts`)
    - Property 3: コメントマーカーのラウンドトリップ
    - Feature: toc-command-generation, Property 3
    - _Validates: Requirements 9.5_

  - [x] 2.3 コメントマーカー解析のプロパティテストを作成する (`test/unit/tocCommentMarker.property.test.ts`)
    - Property 4: コメントマーカー解析の正確性
    - Feature: toc-command-generation, Property 4
    - _Validates: Requirements 9.3, 9.4_

  - [x] 2.4 TOC更新時のマーカー位置保持プロパティテストを作成する (`test/unit/tocCommentMarker.property.test.ts`)
    - Property 5: TOC更新時のマーカー位置保持と内容置換
    - Feature: toc-command-generation, Property 5
    - _Validates: Requirements 1.5, 4.2_

  - [x] 2.5 無変更時スキップのプロパティテストを作成する (`test/unit/tocCommentMarker.property.test.ts`)
    - Property 6: 無変更時のTOC更新スキップ
    - Feature: toc-command-generation, Property 6
    - _Validates: Requirements 4.4_

  - [x] 2.6 `tocCommentMarker` のユニットテストを作成する (`test/unit/tocCommentMarker.test.ts`)
    - マーカー不在、コードブロック内マーカー、終了マーカー欠落、空のTOCセクション、前後空白ありマーカーのテストケース
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [x] 3. チェックポイント - コアモジュールの検証
  - すべてのテストが通ることを確認し、不明点があればユーザーに質問する。

- [x] 4. Insert TOCコマンドの実装
  - [x] 4.1 `src/commands/insertToc.ts` を作成する
    - `insertTocCommand(): Promise<void>` を実装
    - アクティブエディタがMarkdownファイルでなければ何もしない（`document.languageId === 'markdown'`）
    - `extractHeadings()` → `resolveAnchors()` → `buildTocMarkdown()` でTOCテキスト生成
    - 既存TOCマーカーがあれば `replaceTocContent()` で内容を置換
    - マーカーがなければ `wrapWithMarkers()` でマーカー付きTOCをカーソル位置に挿入
    - 見出しが存在しない場合はマーカーのみの空TOCセクションを挿入
    - `editor.edit()` APIでアンドゥ可能な編集として実行
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

  - [x] 4.2 `package.json` に `markdownStudio.insertToc` コマンドを追加する
    - `"command": "markdownStudio.insertToc"`, `"title": "Markdown Studio: Insert TOC"`
    - _Requirements: 1.1_

  - [x] 4.3 `src/extension.ts` にコマンド登録を追加する
    - `vscode.commands.registerCommand('markdownStudio.insertToc', ...)` を `context.subscriptions` に追加
    - _Requirements: 1.1_

  - [x] 4.4 `insertToc` のユニットテストを作成する (`test/unit/insertToc.test.ts`)
    - 非Markdownファイルでのコマンド無視、新規挿入、既存TOC更新、見出しなしドキュメントのテストケース
    - VS Code APIのモックを使用
    - _Requirements: 1.2, 1.5, 1.6, 1.7_

- [x] 5. 保存時自動更新の実装
  - [x] 5.1 `src/extension.ts` に `onWillSaveTextDocument` リスナーを追加する
    - Markdownファイルの保存時にTOCコメントマーカーを検出
    - マーカーが存在する場合、TOCテキストを再生成して `waitUntil()` でテキスト編集を返す
    - マーカーが存在しない場合はスキップ
    - TOC内容に変更がない場合はスキップ（不要な編集を回避）
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 5.2 保存時自動更新のユニットテストを作成する (`test/unit/tocAutoUpdate.test.ts`)
    - マーカーあり・内容変更あり、マーカーあり・内容変更なし、マーカーなしのテストケース
    - `onWillSaveTextDocument` のモックを使用
    - _Requirements: 4.1, 4.3, 4.4_

- [x] 6. チェックポイント - コマンドと自動更新の検証
  - すべてのテストが通ることを確認し、不明点があればユーザーに質問する。

- [x] 7. PDF改ページCSS注入の実装
  - [x] 7.1 `src/export/pdfHeaderFooter.ts` に `injectTocPageBreakCss()` を追加する
    - レンダリング済みHTML内の `<!-- TOC -->` / `<!-- /TOC -->` コメントを検出
    - コメント間のコンテンツを `<div style="page-break-before: always; page-break-after: always;">` で囲む
    - 冪等性を保証（既に注入済みの場合はスキップ）
    - _Requirements: 10.1, 10.2, 10.3_

  - [x] 7.2 `src/export/exportPdf.ts` で `injectTocPageBreakCss()` を呼び出す
    - `toc.pageBreak` 設定が有効な場合のみ呼び出し
    - 既存の `injectPageBreakCss()` の後に実行
    - _Requirements: 6.3, 6.4_

  - [x] 7.3 PDF改ページCSS注入のプロパティテストを作成する (`test/unit/pdfTocPageBreak.property.test.ts`)
    - Property 7: PDF改ページCSS注入のトグル
    - Feature: toc-command-generation, Property 7
    - _Validates: Requirements 6.3, 6.4, 10.1, 10.2_

  - [x] 7.4 `injectTocPageBreakCss` のユニットテストを作成する (`test/unit/pdfTocPageBreak.test.ts`)
    - マーカーあり・pageBreak有効、マーカーあり・pageBreak無効、マーカーなし、冪等性のテストケース
    - _Requirements: 10.1, 10.2, 10.3_

- [x] 8. インテグレーションテスト
  - [x] 8.1 TOCコマンド生成のインテグレーションテストを作成する (`test/integration/tocCommand.integration.test.ts`)
    - Markdownソースに対するInsert TOCコマンド実行→ドキュメント内容の検証
    - 保存時自動更新のエンドツーエンドフロー
    - TOCコメントマーカー付きドキュメントのプレビューレンダリング確認
    - PDFエクスポートでのTOC改ページ確認
    - _Requirements: 1.2, 4.1, 5.1, 6.1, 6.3_

- [x] 9. 最終チェックポイント - 全テスト通過の確認
  - すべてのテストが通ることを確認し、不明点があればユーザーに質問する。

## 備考

- 既存の `extractHeadings`, `anchorResolver`, `tocValidator` モジュールはそのまま再利用
- 既存の `buildToc.ts`（HTML形式）は `[[toc]]` マーカー用として引き続き使用
- 新規の `buildTocMarkdown.ts` は `<!-- TOC -->` マーカー用のMarkdownテキスト形式を生成
- プロパティテストは設計書の正確性プロパティ（Property 1〜8）に対応
- チェックポイントで段階的に検証を実施
