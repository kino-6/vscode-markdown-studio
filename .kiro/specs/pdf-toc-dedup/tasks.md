# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - コメントマーカーToCが識別クラスなしでレンダリングされる
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: Generate markdown inputs containing `<!-- TOC -->` comment markers with ToC list content between them. For each input, render via `renderMarkdownDocument()` and assert the output HTML contains `<div class="ms-toc-comment">` wrapping the comment marker ToC content
  - Bug Condition from design: `isBugCondition(input)` where markdown contains `<!-- TOC -->...<!-- /TOC -->` block AND ToC should be hidden AND rendered HTML has no `.ms-toc-comment` class
  - Expected Behavior: rendered HTML wraps comment marker ToC content in `<div class="ms-toc-comment">`
  - Use fast-check to generate varying ToC list content (1-5 heading links) between `<!-- TOC -->` / `<!-- /TOC -->` markers
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists because `renderMarkdownDocument()` does not wrap comment marker ToC in `.ms-toc-comment`)
  - Document counterexamples found: e.g., `<!-- TOC -->\n- [Heading](#heading)\n<!-- /TOC -->` renders as plain `<ul><li>` without any identifying wrapper class
  - Mark task complete when test is written, run, and failure is documented
  - Create test file: `test/unit/pdfTocDedup.property.test.ts`
  - _Requirements: 1.1, 2.1_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - プレビュー表示・既存[toc]マーカー動作・ToC未使用Markdownの保持
  - **IMPORTANT**: Follow observation-first methodology
  - Observe on UNFIXED code:
    - `renderMarkdownDocument()` with `[toc]` marker produces `<nav class="ms-toc">` wrapping (existing behavior)
    - `renderMarkdownDocument()` with no ToC markers produces HTML without any `.ms-toc` or ToC-hiding CSS
    - `getConfig()` returns `pdfIndex: { enabled: true, title: 'Table of Contents' }` with existing defaults
    - Preview HTML (`buildHtml()`) does NOT inject `.ms-toc { display: none }` CSS (only PDF export does)
  - Write property-based tests capturing observed behavior:
    - For all markdown inputs WITHOUT `<!-- TOC -->` comment markers, `renderMarkdownDocument()` output does NOT contain `ms-toc-comment` class
    - For all markdown inputs with `[toc]` marker, `renderMarkdownDocument()` output contains `<nav class="ms-toc">`
    - For all markdown inputs, `buildHtml()` (preview path) does NOT inject ToC-hiding CSS (`.ms-toc { display: none`)
  - Use fast-check to generate random markdown with headings (no comment markers) and verify preservation
  - Verify tests PASS on UNFIXED code
  - Add tests to: `test/unit/pdfTocDedup.property.test.ts`
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. Fix for PDF ToC/Index deduplication bug

  - [x] 3.1 Add `PdfTocConfig` interface to `src/types/models.ts`
    - Add `PdfTocConfig` interface with `hidden: boolean` field
    - _Requirements: 2.3_

  - [x] 3.2 Add `pdfToc` config to `src/infra/config.ts`
    - Add `pdfToc: PdfTocConfig` to `MarkdownStudioConfig` interface
    - Read `export.pdfToc.hidden` setting in `getConfig()` with default `true`
    - _Bug_Condition: isBugCondition(input) where config lacks independent ToC hide control_
    - _Expected_Behavior: `getConfig()` returns `pdfToc.hidden` boolean from VS Code settings_
    - _Preservation: Existing `pdfIndex` config fields unchanged_
    - _Requirements: 2.3, 3.4_

  - [x] 3.3 Wrap comment marker ToC in `renderMarkdownDocument()` in `src/renderers/renderMarkdown.ts`
    - After markdown-it rendering and ToC marker replacement, detect `<!-- TOC -->` / `<!-- /TOC -->` comment marker content in the original markdown using `findTocCommentMarkers()`
    - Replace the comment markers in the transformed markdown (before rendering) with `<div class="ms-toc-comment">` and `</div>` HTML tags so markdown-it passes them through to output
    - This wraps the rendered ToC list content in an identifiable `<div class="ms-toc-comment">` element
    - _Bug_Condition: isBugCondition(input) where comment marker ToC has no identifying class_
    - _Expected_Behavior: Comment marker ToC content wrapped in `<div class="ms-toc-comment">`_
    - _Preservation: `[toc]` marker behavior via `replaceTocMarker()` unchanged; preview rendering unchanged_
    - _Requirements: 2.1_

  - [x] 3.4 Update ToC hide logic in `src/export/exportPdf.ts`
    - Change the condition from `cfg.pdfIndex.enabled` to `cfg.pdfToc.hidden` for injecting ToC-hiding CSS
    - Extend CSS selector from `.ms-toc { display: none !important; }` to `.ms-toc, .ms-toc-comment { display: none !important; }`
    - Keep `cfg.pdfIndex.enabled` controlling only PDF Index generation (2-pass rendering)
    - _Bug_Condition: isBugCondition(input) where `.ms-toc` only selector misses comment marker ToC_
    - _Expected_Behavior: Both `.ms-toc` and `.ms-toc-comment` hidden when `pdfToc.hidden=true`; 4 config patterns work correctly_
    - _Preservation: PDF Index generation logic unchanged; page format, margins, header/footer unchanged_
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2_

  - [x] 3.5 Add `markdownStudio.export.pdfToc.hidden` setting to `package.json`
    - Add to `contributes.configuration.properties` with type `boolean`, default `true`
    - Add description explaining the setting controls inline ToC visibility in PDF export
    - _Requirements: 2.3_

  - [x] 3.6 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - コメントマーカーToCが`ms-toc-comment`でラップされる
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.1_

  - [x] 3.7 Verify preservation tests still pass
    - **Property 2: Preservation** - 既存動作の保持確認
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)

- [x] 4. Checkpoint - Ensure all tests pass
  - Run full unit test suite: `npx vitest run -c config/vitest.unit.config.ts`
  - Ensure all existing tests pass alongside new property tests
  - Ensure no regressions in existing ToC, PDF export, or config tests
  - Ask the user if questions arise
