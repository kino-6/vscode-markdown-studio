# Requirements Document: PDF Export Fidelity Improvement

## Introduction

Improve the fidelity of Markdown Studio's PDF export so that the exported PDF closely matches the Webview preview. Two specific issues are addressed: (1) images (SVG/Mermaid diagrams) appear smaller in PDF output than in the preview because Playwright uses the default A4 print width (~640px at 96dpi) while the preview body has `max-width: 980px`, causing `max-width: 100%` images to shrink; (2) long code lines are clipped/truncated in PDF because `overflow-x: auto` produces scrollbars in the webview but PDF has no scroll concept.

The changes touch shared files (`exportPdf.ts`, `preview.css`, `buildHtml.ts`) that are also used by the TOC auto-generation, TOC command generation, and code block line numbers features. Regression prevention for these existing features is a first-class concern.

## Glossary

- **PDF_Exporter**: The Playwright Chromium-based PDF export module (`src/export/exportPdf.ts`)
- **Preview_Panel**: The VS Code Webview-based preview panel (`src/preview/webviewPanel.ts`)
- **HTML_Builder**: The HTML generation module shared by preview and PDF paths (`src/preview/buildHtml.ts`)
- **Preview_CSS**: The shared CSS stylesheet used by both the Webview preview and PDF rendering (`media/preview.css`)
- **Viewport_Width**: The CSS layout width used by Playwright when rendering the HTML page before PDF generation
- **Print_Stylesheet**: CSS rules scoped under `@media print` that apply only during PDF generation (print context)
- **TOC_Generator**: The table-of-contents generation pipeline (`src/toc/` modules)
- **Line_Number_Renderer**: The code block line number rendering module (`src/parser/lineNumbers.ts`)

## Requirements

### Requirement 1: Image Scaling Parity Between Preview and PDF

**User Story:** As a developer, I want images and diagrams in the exported PDF to appear at the same relative size as in the Webview preview, so that the PDF output faithfully represents what I see during editing.

#### Acceptance Criteria

1. WHEN a PDF export is initiated, THE PDF_Exporter SHALL set the Playwright page viewport width to 980 pixels before calling `page.pdf()`
2. WHEN the Playwright viewport width is set to 980 pixels, THE PDF_Exporter SHALL preserve all other existing PDF options (format, margins, header/footer templates, printBackground, preferCSSPageSize)
3. WHEN an image or SVG element has `max-width: 100%` applied, THE PDF_Exporter SHALL render the image at the same proportional width as the Preview_Panel (relative to the 980px body max-width)
4. WHEN a Mermaid diagram is rendered in the PDF, THE PDF_Exporter SHALL display the diagram at the same proportional size as in the Preview_Panel

### Requirement 2: Code Block Line Wrapping in PDF

**User Story:** As a developer, I want long code lines to wrap in the exported PDF instead of being clipped, so that all code content is visible in the printed document.

#### Acceptance Criteria

1. WHEN a PDF is generated, THE Print_Stylesheet SHALL apply `white-space: pre-wrap` to `pre code` elements
2. WHEN a PDF is generated, THE Print_Stylesheet SHALL apply `word-wrap: break-word` to `pre code` elements
3. WHEN a code line exceeds the printable width in PDF, THE PDF_Exporter SHALL wrap the line to the next line instead of clipping or truncating the content
4. WHILE the Webview preview is displayed (screen media), THE Preview_CSS SHALL retain `white-space: pre` and `overflow-x: auto` on `pre code` elements so that horizontal scrolling remains available

### Requirement 3: Preview Webview Behavior Preservation

**User Story:** As a developer, I want the Webview preview to continue working exactly as before, so that the PDF fidelity improvements do not degrade my editing experience.

#### Acceptance Criteria

1. WHILE the Webview preview is displayed, THE Preview_CSS SHALL maintain `max-width: 980px` on the body element
2. WHILE the Webview preview is displayed, THE Preview_CSS SHALL maintain `overflow-x: auto` on `pre` elements for horizontal scrolling of long code lines
3. WHEN the `@media print` rules are modified, THE Preview_CSS SHALL scope all print-specific overrides exclusively within `@media print` blocks so that screen rendering is unaffected
4. FOR ALL existing Webview preview features (image display, code block rendering, table rendering, copy button, loading overlay), THE Preview_Panel SHALL produce identical output before and after the PDF fidelity changes

### Requirement 4: TOC Feature Compatibility

**User Story:** As a developer, I want the TOC auto-generation and TOC command features to continue working correctly after the PDF fidelity changes, so that my table of contents is not broken.

#### Acceptance Criteria

1. WHEN a document with a `[[toc]]` or `[TOC]` marker is exported to PDF, THE PDF_Exporter SHALL render the TOC HTML identically to the current behavior
2. WHEN a document with `<!-- TOC -->` comment markers is exported to PDF, THE PDF_Exporter SHALL apply TOC page-break CSS injection identically to the current behavior
3. WHEN the Playwright viewport width is changed to 980 pixels, THE PDF_Exporter SHALL preserve the TOC anchor link functionality within the generated PDF
4. WHEN the `@media print` CSS is modified, THE Print_Stylesheet SHALL preserve all existing `.ms-toc` print styles (border, background, padding, link color)

### Requirement 5: Code Block Line Numbers Compatibility

**User Story:** As a developer, I want code block line numbers to continue displaying correctly in both preview and PDF after the PDF fidelity changes, so that the line number feature is not broken.

#### Acceptance Criteria

1. WHEN line numbers are enabled and a PDF is exported, THE PDF_Exporter SHALL display line numbers alongside code content with the same visual layout as before the changes
2. WHEN `white-space: pre-wrap` is applied in print context, THE Print_Stylesheet SHALL apply the wrapping rule to the code content column (`.ms-code-content pre code`) without affecting the line number column (`.ms-line-numbers pre`)
3. WHEN the Playwright viewport width is changed to 980 pixels, THE PDF_Exporter SHALL render the line number table layout (`.ms-code-table`) without visual distortion
4. WHILE the Webview preview is displayed, THE Preview_CSS SHALL maintain the existing line number styles (color, border-right, user-select) without modification

### Requirement 6: Viewport Width Configuration Isolation

**User Story:** As a developer, I want the viewport width change to be isolated to the PDF export path, so that it does not affect any other rendering context.

#### Acceptance Criteria

1. THE PDF_Exporter SHALL apply the 980-pixel viewport width only within the `exportToPdf` function scope, using Playwright's `page.setViewportSize()` API
2. THE PDF_Exporter SHALL set the viewport width after `page.setContent()` and before `page.pdf()` to ensure the layout is recalculated at the correct width
3. WHEN the Webview preview renders HTML, THE HTML_Builder SHALL produce identical HTML output regardless of the PDF viewport width change (the viewport change is Playwright-only)

### Requirement 7: Print CSS Scoping

**User Story:** As a developer, I want all print-specific CSS changes to be strictly scoped to `@media print`, so that screen rendering is guaranteed to be unaffected.

#### Acceptance Criteria

1. THE Preview_CSS SHALL place the `white-space: pre-wrap` rule for `pre code` exclusively inside an `@media print` block
2. THE Preview_CSS SHALL place the `word-wrap: break-word` rule for `pre code` exclusively inside an `@media print` block
3. WHEN the Preview_CSS file is loaded in a screen context (Webview), THE Preview_CSS SHALL apply zero print-specific overrides to `pre code` elements
4. FOR ALL `@media print` modifications, THE Preview_CSS SHALL preserve all existing print rules (body max-width removal, table display, heading margins, copy button hiding, code font-family)
