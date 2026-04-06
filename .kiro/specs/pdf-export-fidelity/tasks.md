# Implementation Plan: PDF Export Fidelity Improvement

## Overview

Two surgical changes to improve PDF export fidelity: (1) set Playwright viewport width to 980px in `exportPdf.ts` to match the preview body `max-width`, and (2) add `pre-wrap` CSS rules inside `@media print` in `preview.css` to prevent code line clipping. No changes to `buildHtml.ts`.

## Tasks

- [x] 1. Add viewport width to Playwright page in exportPdf.ts
  - [x] 1.1 Add `await page.setViewportSize({ width: 980, height: 1400 })` after `page.setContent()` and before `page.pdf()` in `src/export/exportPdf.ts`
    - Insert the single line between the existing `await page.setContent(html, { waitUntil: 'networkidle' })` call and the `const outputPath = ...` line
    - _Requirements: 1.1, 1.2, 6.1, 6.2_
  - [ ]* 1.2 Add integration test verifying `setViewportSize` call ordering
    - Extend `test/integration/exportPdf.integration.test.ts` with a test that verifies `page.setViewportSize({ width: 980, height: 1400 })` is called after `page.setContent()` and before `page.pdf()`
    - Add `setViewportSize` to the mock page object returned by `newPageMock`
    - Verify existing PDF options (format, margins, header/footer, printBackground, preferCSSPageSize) are still passed unchanged to `page.pdf()`
    - _Requirements: 1.1, 1.2, 6.1, 6.2_

- [x] 2. Add print CSS rules for code line wrapping in preview.css
  - [x] 2.1 Add `pre code { white-space: pre-wrap; word-wrap: break-word; }` inside the first `@media print` block in `media/preview.css`
    - Place the rule after the existing `pre` print rules (after `page-break-inside: avoid;`)
    - _Requirements: 2.1, 2.2, 7.1, 7.2_
  - [ ]* 2.2 Add unit tests verifying CSS content
    - Create `test/unit/pdfExportFidelity.test.ts` that reads `media/preview.css` and verifies:
    - The `@media print` block contains `white-space: pre-wrap` for `pre code`
    - The `@media print` block contains `word-wrap: break-word` for `pre code`
    - The screen context retains `white-space: pre` on `pre code`
    - Body retains `max-width: 980px`
    - Existing `@media print` rules are preserved (body max-width removal, table display, heading margins, `.ms-toc` styles, `.ms-line-numbers pre` styles)
    - The `pre-wrap` rule uses `pre code` selector (not just `pre`), ensuring `.ms-line-numbers pre` is unaffected
    - _Requirements: 2.1, 2.2, 2.4, 3.1, 3.2, 3.3, 4.4, 5.2, 5.4, 7.1, 7.2, 7.4_

- [x] 3. Checkpoint - Verify all changes and run tests
  - Ensure all tests pass, ask the user if questions arise.
  - Run existing test suites to confirm no regressions: `test/integration/buildHtml.integration.test.ts`, `test/integration/toc.integration.test.ts`, `test/integration/lineNumbers.integration.test.ts`, `test/unit/lineNumbers.property.test.ts`, `test/unit/buildToc.property.test.ts`
  - _Requirements: 3.4, 4.1, 4.2, 4.3, 5.1, 5.3_

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Only two files are modified: `src/export/exportPdf.ts` (one line) and `media/preview.css` (two CSS properties)
- `src/preview/buildHtml.ts` is intentionally NOT modified
- Regression safety is verified by running the existing test suite at the checkpoint
