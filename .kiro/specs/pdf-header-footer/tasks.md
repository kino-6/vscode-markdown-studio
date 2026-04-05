# Implementation Plan: PDF Header/Footer with Page Numbers

## Overview

Add configurable header and footer templates (with page numbers) to the PDF export pipeline, along with CSS page-break support. Implementation extends the existing `getConfig()`, introduces a pure `buildPdfOptions()` builder, default template generators, a page-break CSS injector, and wires everything into `exportToPdf()`. All new logic is in TypeScript, tested with vitest and fast-check.

## Tasks

- [x] 1. Define interfaces and extend configuration
  - [x] 1.1 Add `PdfHeaderFooterConfig` and `PdfTemplateOptions` interfaces to `src/types/models.ts`
    - Define `PdfHeaderFooterConfig` with `headerEnabled`, `headerTemplate`, `footerEnabled`, `footerTemplate`, `pageBreakEnabled`
    - Define `PdfTemplateOptions` with `displayHeaderFooter`, `headerTemplate`, `footerTemplate`, `margin`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [x] 1.2 Register new VS Code settings in `package.json` under `contributes.configuration.properties`
    - Add `markdownStudio.export.header.enabled` (boolean, default `true`)
    - Add `markdownStudio.export.header.template` (string or null, default `null`)
    - Add `markdownStudio.export.footer.enabled` (boolean, default `true`)
    - Add `markdownStudio.export.footer.template` (string or null, default `null`)
    - Add `markdownStudio.export.pageBreak.enabled` (boolean, default `true`)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [x] 1.3 Extend `getConfig()` in `src/infra/config.ts` to read and return `pdfHeaderFooter: PdfHeaderFooterConfig`
    - Read the five new settings from `vscode.workspace.getConfiguration('markdownStudio')`
    - Apply defaults: `headerEnabled=true`, `footerEnabled=true`, `headerTemplate=null`, `footerTemplate=null`, `pageBreakEnabled=true`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 2. Implement PDF options builder and default templates
  - [x] 2.1 Create `src/export/pdfHeaderFooter.ts` with `getDefaultHeaderTemplate(documentTitle: string): string`
    - HTML-escape the document title (`<`, `>`, `&`, `"`, `'`)
    - Return an HTML string with the escaped title, inline styles, `font-size` ≤ 12px, spanning full width
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 8.1, 8.2, 8.3, 8.4, 8.5_

  - [x] 2.2 Add `getDefaultFooterTemplate(): string` to `src/export/pdfHeaderFooter.ts`
    - Return HTML with `<span class="pageNumber"></span>` and `<span class="totalPages"></span>` in "Page X of Y" format
    - Use inline styles with `font-size` ≤ 12px
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 2.3 Add `buildPdfOptions(config: PdfHeaderFooterConfig, documentTitle: string): PdfTemplateOptions` to `src/export/pdfHeaderFooter.ts`
    - Set `displayHeaderFooter` to `config.headerEnabled || config.footerEnabled`
    - Use custom template verbatim when non-null, default template when null, `<span></span>` when disabled
    - Set top margin `20mm` when header enabled, `10mm` otherwise; bottom margin `20mm` when footer enabled, `10mm` otherwise; left/right always `10mm`
    - _Requirements: 4.1, 4.2, 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [x] 2.4 Write property test: Default header contains escaped document title (Property 1)
    - **Property 1: Default header contains escaped document title**
    - For any string title, when `headerEnabled=true` and `headerTemplate=null`, the default header HTML contains the HTML-escaped title
    - **Validates: Requirements 2.1, 2.2, 8.1, 8.2, 8.3, 8.4, 8.5**

  - [x] 2.5 Write property test: Custom template passthrough (Property 2)
    - **Property 2: Custom template passthrough**
    - For any non-null template string, `buildPdfOptions` returns it verbatim
    - **Validates: Requirements 4.1, 4.2**

  - [x] 2.6 Write property test: displayHeaderFooter flag consistency (Property 3)
    - **Property 3: displayHeaderFooter flag consistency**
    - For any `PdfHeaderFooterConfig`, `displayHeaderFooter === (headerEnabled || footerEnabled)`
    - **Validates: Requirements 5.3, 5.4, 5.5**

  - [x] 2.7 Write property test: Margin consistency (Property 4)
    - **Property 4: Margin consistency**
    - For any config, top=`20mm` iff headerEnabled, bottom=`20mm` iff footerEnabled, left/right always `10mm`
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6**

  - [x] 2.8 Write unit tests for `getDefaultHeaderTemplate`, `getDefaultFooterTemplate`, and `buildPdfOptions`
    - Test empty title, normal title, special-character title
    - Test all enable/disable combinations
    - Test custom template passthrough
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 5.1, 5.2, 6.1, 6.2, 6.3, 6.4_

- [x] 3. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement page-break CSS injection
  - [x] 4.1 Add `injectPageBreakCss(html: string): string` to `src/export/pdfHeaderFooter.ts`
    - Inject a `<style>` block before `</head>` with `page-break-before` and `page-break-after` CSS rules
    - Return HTML unchanged if `</head>` is not found
    - Ensure idempotency: do not duplicate the style block if already present
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [x] 4.2 Write property test: Page break CSS injection idempotency (Property 5)
    - **Property 5: Page break CSS injection idempotency**
    - Applying `injectPageBreakCss` twice produces the same result as applying it once
    - **Validates: Requirement 7.4**

  - [x] 4.3 Write property test: Page break injector no-op without head tag (Property 6)
    - **Property 6: Page break injector no-op without head tag**
    - For any HTML without `</head>`, `injectPageBreakCss` returns the original string unchanged
    - **Validates: Requirement 7.3**

  - [x] 4.4 Write unit tests for `injectPageBreakCss`
    - Test injection into valid HTML, missing `</head>`, and double-application
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [x] 5. Wire header/footer and page-break into the PDF export pipeline
  - [x] 5.1 Update `src/export/exportPdf.ts` to import and use `buildPdfOptions` and `injectPageBreakCss`
    - Read `pdfHeaderFooter` config from `getConfig()`
    - Call `injectPageBreakCss(html)` when `pageBreakEnabled` is `true`
    - Derive `documentTitle` from the file basename
    - Call `buildPdfOptions(config.pdfHeaderFooter, documentTitle)` and spread the result into `page.pdf()` options
    - _Requirements: 1.1–1.5, 2.1, 3.1, 5.3, 6.1, 6.3, 7.1_

  - [x] 5.2 Write integration test extending `test/integration/exportPdf.integration.test.ts`
    - Verify PDF export with default header/footer settings produces a valid PDF
    - Verify disabled header/footer settings are respected
    - _Requirements: 2.1, 3.1, 5.5, 6.1, 6.2_

- [x] 6. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
