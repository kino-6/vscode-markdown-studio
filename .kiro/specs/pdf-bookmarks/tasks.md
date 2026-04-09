# Implementation Plan: PDFブックマーク（しおり）生成

## Overview

PDFエクスポート後に `pdf-lib` でブックマークアウトラインを埋め込む機能を実装する。依存関係・型定義・設定から始め、コアロジック（ツリー構築＋PDF埋め込み）を実装し、最後に `exportPdf.ts` に統合する。

## Tasks

- [x] 1. Add pdf-lib dependency and type definitions
  - [x] 1.1 Add `pdf-lib` to `package.json` dependencies and run `npm install`
    - Add `"pdf-lib": "^1.17.1"` to `dependencies` in `package.json`
    - _Requirements: 6.1_

  - [x] 1.2 Add `PdfBookmarksConfig` and `BookmarkEntry` types to `src/types/models.ts`
    - Add `PdfBookmarksConfig` interface with `enabled: boolean`
    - Add `BookmarkEntry` interface with `level: number`, `text: string`, `pageNumber: number`
    - _Requirements: 3.2, 3.3_

  - [x] 1.3 Add `pdfBookmarks` config to `src/infra/config.ts`
    - Import `PdfBookmarksConfig` from models
    - Add `pdfBookmarks: PdfBookmarksConfig` to `MarkdownStudioConfig` interface
    - Add `pdfBookmarks: { enabled: cfg.get<boolean>('export.pdfBookmarks.enabled', true) }` to `getConfig()`
    - _Requirements: 3.2, 3.3_

  - [x] 1.4 Add `markdownStudio.export.pdfBookmarks.enabled` setting to `package.json` contributes
    - Add boolean setting with `default: true` and Japanese markdownDescription
    - _Requirements: 3.2, 3.3_

- [x] 2. Implement core bookmark module `src/export/pdfBookmarks.ts`
  - [x] 2.1 Implement `buildBookmarkTree()` function
    - Create `src/export/pdfBookmarks.ts`
    - Define `BookmarkNode` interface (`title`, `pageIndex`, `level`, `children`)
    - Implement stack-based algorithm to convert flat `BookmarkEntry[]` to tree
    - Filter entries by `minLevel`/`maxLevel` range
    - Convert 1-based `pageNumber` to 0-based `pageIndex`
    - Handle level skips (e.g. H1→H3 with no H2)
    - Return empty array for empty input
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 1.3_

  - [x] 2.2 Implement `addBookmarks()` function
    - Read PDF file with `pdf-lib` `PDFDocument.load()`
    - Call `buildBookmarkTree()` to get tree structure
    - Build PDF `/Outlines` dictionary with proper `/First`, `/Last`, `/Next`, `/Prev`, `/Parent` links
    - Set each outline item's `/Dest` to target page with `/Fit` display mode
    - Clamp `pageIndex` to `pages.length - 1` for out-of-range values
    - Set catalog `/PageMode` to `/UseOutlines`
    - Save modified PDF back to same path
    - Early return (no-op) when entries are empty or tree is empty
    - _Requirements: 4.3, 4.4, 5.1, 5.3, 1.1, 1.3_

  - [x] 2.3 Write unit tests for `buildBookmarkTree` in `test/unit/pdfBookmarks.test.ts`
    - Test basic flat-to-tree conversion (H1, H2, H3 hierarchy)
    - Test minLevel/maxLevel filtering (AC 3.1)
    - Test empty input returns empty array (AC 1.3)
    - Test single-level input (all roots)
    - Test deep nesting (H1→H2→H3→H4)
    - Test level skip (H1→H3, no H2) (AC 2.5)
    - Test pageIndex = pageNumber - 1 conversion (AC 2.4)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 1.3_

  - [x] 2.4 Write property test: node count preservation (`test/unit/pdfBookmarks.property.test.ts`)
    - **Property 1: ブックマークツリーのノード数保存**
    - Generate arbitrary `BookmarkEntry[]` with valid `minLevel`/`maxLevel`
    - Assert total tree node count equals filtered input entry count
    - **Validates: Requirements 2.2**

  - [x] 2.5 Write property test: DFS traversal order preservation
    - **Property 2: ブックマークツリーの深さ優先走査順序**
    - Generate arbitrary `BookmarkEntry[]`
    - Assert DFS traversal order matches filtered input order
    - **Validates: Requirements 2.3**

  - [x] 2.6 Write property test: page index range constraint
    - **Property 3: ページインデックスの範囲制約**
    - Generate arbitrary `BookmarkEntry[]`
    - Assert all nodes have `pageIndex >= 0` and `pageIndex === pageNumber - 1`
    - **Validates: Requirements 2.4**

  - [x] 2.7 Write property test: root node level constraint
    - **Property 4: ルートノードのレベル制約**
    - Generate arbitrary `BookmarkEntry[]` with valid `minLevel`/`maxLevel`
    - Assert all root nodes have level equal to the minimum level found in filtered entries
    - **Validates: Requirements 2.1**

  - [x] 2.8 Write property test: empty input safety
    - **Property 5: 空入力に対する安全性**
    - Assert `buildBookmarkTree([], minLevel, maxLevel)` returns `[]`
    - **Validates: Requirements 1.3**

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Integrate bookmark generation into `exportPdf.ts`
  - [x] 4.1 Add bookmark generation to the 2-pass path (`pdfIndex.enabled=true`)
    - Import `addBookmarks` from `pdfBookmarks.ts` and `BookmarkEntry` from models
    - After final `page.pdf()` call, convert `headingEntries` (HeadingPageEntry[]) to `BookmarkEntry[]`
    - Call `addBookmarks(outputPath, bookmarkEntries, cfg.toc.minLevel, cfg.toc.maxLevel)` when `cfg.pdfBookmarks.enabled` and entries exist
    - Add progress report `'Adding bookmarks...'` before the call
    - _Requirements: 4.1, 4.3, 6.2_

  - [x] 4.2 Add bookmark generation to the single-pass path (`pdfIndex.enabled=false`)
    - When `cfg.pdfBookmarks.enabled=true` and `cfg.pdfIndex.enabled=false`, collect heading positions from DOM after PDF generation
    - Read the generated PDF to count pages, compute heading page numbers using offsetTop/scrollHeight ratio
    - Build `BookmarkEntry[]` and call `addBookmarks()`
    - Add progress report `'Adding bookmarks...'`
    - _Requirements: 4.2, 4.3, 6.2_

  - [x] 4.3 Write integration tests for bookmark generation in `test/integration/exportPdf.integration.test.ts`
    - Test `pdfBookmarks.enabled=true` produces PDF with `/Outlines`
    - Test `pdfBookmarks.enabled=false` produces PDF without `/Outlines`
    - Test `pdfIndex.enabled=false` + `pdfBookmarks.enabled=true` still generates bookmarks
    - _Requirements: 1.1, 1.2, 4.1, 4.2_

- [x] 5. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The project already uses `fast-check` and has many `.property.test.ts` files as precedent
