# Requirements Document

## Introduction

Markdown Studio's PDF export currently produces pages without headers, footers, or page numbers. This feature adds configurable header and footer templates to the PDF export pipeline, providing a default header with the document title and a default footer with "Page X of Y" pagination. Users can customize or disable these elements independently through VS Code settings. The implementation leverages Playwright's built-in `headerTemplate` and `footerTemplate` options on `page.pdf()`. Additionally, CSS page-break support is introduced so authors can control pagination in their Markdown source.

## Glossary

- **PDF_Options_Builder**: The pure function `buildPdfOptions()` that translates a `PdfHeaderFooterConfig` and document title into Playwright-compatible PDF options including header/footer templates and margins.
- **Header_Template_Generator**: The function `getDefaultHeaderTemplate()` that produces the default header HTML containing the HTML-escaped document title.
- **Footer_Template_Generator**: The function `getDefaultFooterTemplate()` that produces the default footer HTML containing Playwright's `pageNumber` and `totalPages` CSS class spans.
- **Page_Break_Injector**: The function `injectPageBreakCss()` that injects a CSS `<style>` block into the HTML content to enable `page-break-before` and `page-break-after` properties in the PDF renderer.
- **PdfHeaderFooterConfig**: The configuration object containing `headerEnabled`, `headerTemplate`, `footerEnabled`, `footerTemplate`, and `pageBreakEnabled` fields.
- **PdfTemplateOptions**: The output object containing `displayHeaderFooter`, `headerTemplate`, `footerTemplate`, and `margin` fields passed to Playwright's `page.pdf()`.
- **Config_Reader**: The extended `getConfig()` function that reads header/footer settings from VS Code workspace configuration.

## Requirements

### Requirement 1: Configuration Defaults

**User Story:** As a user, I want PDF header and footer to be enabled by default with sensible templates, so that exported PDFs include a title and page numbers without any configuration.

#### Acceptance Criteria

1. THE Config_Reader SHALL return `headerEnabled` as `true` when the `markdownStudio.export.header.enabled` setting is not explicitly set.
2. THE Config_Reader SHALL return `footerEnabled` as `true` when the `markdownStudio.export.footer.enabled` setting is not explicitly set.
3. THE Config_Reader SHALL return `headerTemplate` as `null` when the `markdownStudio.export.header.template` setting is not explicitly set.
4. THE Config_Reader SHALL return `footerTemplate` as `null` when the `markdownStudio.export.footer.template` setting is not explicitly set.
5. THE Config_Reader SHALL return `pageBreakEnabled` as `true` when the `markdownStudio.export.pageBreak.enabled` setting is not explicitly set.

### Requirement 2: Default Header Template Generation

**User Story:** As a user, I want the default header to display my document's title, so that each exported PDF page identifies the source document.

#### Acceptance Criteria

1. WHEN `headerEnabled` is `true` and `headerTemplate` is `null`, THE Header_Template_Generator SHALL produce an HTML string containing the document title text.
2. WHEN the document title contains HTML special characters (`<`, `>`, `&`, `"`, `'`), THE Header_Template_Generator SHALL escape those characters before embedding the title in the HTML template.
3. THE Header_Template_Generator SHALL produce an HTML template that uses inline styles with a `font-size` of 12px or smaller.
4. THE Header_Template_Generator SHALL produce an HTML template that spans the full page width.

### Requirement 3: Default Footer Template Generation

**User Story:** As a user, I want the default footer to show "Page X of Y" on each page, so that I can navigate printed documents easily.

#### Acceptance Criteria

1. WHEN `footerEnabled` is `true` and `footerTemplate` is `null`, THE Footer_Template_Generator SHALL produce an HTML string containing a `<span class="pageNumber"></span>` element.
2. WHEN `footerEnabled` is `true` and `footerTemplate` is `null`, THE Footer_Template_Generator SHALL produce an HTML string containing a `<span class="totalPages"></span>` element.
3. THE Footer_Template_Generator SHALL produce an HTML template that renders in "Page X of Y" format.
4. THE Footer_Template_Generator SHALL produce an HTML template that uses inline styles with a `font-size` of 12px or smaller.

### Requirement 4: Custom Template Support

**User Story:** As a user, I want to provide my own header and footer HTML templates via VS Code settings, so that I can brand or customize the PDF output.

#### Acceptance Criteria

1. WHEN `headerEnabled` is `true` and `headerTemplate` is a non-null string, THE PDF_Options_Builder SHALL use the provided `headerTemplate` string verbatim as the Playwright header template.
2. WHEN `footerEnabled` is `true` and `footerTemplate` is a non-null string, THE PDF_Options_Builder SHALL use the provided `footerTemplate` string verbatim as the Playwright footer template.

### Requirement 5: Enable/Disable Header and Footer Independently

**User Story:** As a user, I want to enable or disable the header and footer independently, so that I can have page numbers without a title header or vice versa.

#### Acceptance Criteria

1. WHEN `headerEnabled` is `false`, THE PDF_Options_Builder SHALL set the header template to an empty element (`<span></span>`).
2. WHEN `footerEnabled` is `false`, THE PDF_Options_Builder SHALL set the footer template to an empty element (`<span></span>`).
3. WHEN both `headerEnabled` and `footerEnabled` are `true`, THE PDF_Options_Builder SHALL set `displayHeaderFooter` to `true`.
4. WHEN either `headerEnabled` or `footerEnabled` is `true`, THE PDF_Options_Builder SHALL set `displayHeaderFooter` to `true`.
5. WHEN both `headerEnabled` and `footerEnabled` are `false`, THE PDF_Options_Builder SHALL set `displayHeaderFooter` to `false`.

### Requirement 6: Margin Adjustment Based on Header/Footer State

**User Story:** As a user, I want page margins to adjust automatically based on whether headers and footers are active, so that content is not overlapped by headers/footers and margins are not wasted when they are disabled.

#### Acceptance Criteria

1. WHEN `headerEnabled` is `true`, THE PDF_Options_Builder SHALL set the top margin to `20mm`.
2. WHEN `headerEnabled` is `false`, THE PDF_Options_Builder SHALL set the top margin to `10mm`.
3. WHEN `footerEnabled` is `true`, THE PDF_Options_Builder SHALL set the bottom margin to `20mm`.
4. WHEN `footerEnabled` is `false`, THE PDF_Options_Builder SHALL set the bottom margin to `10mm`.
5. THE PDF_Options_Builder SHALL set the left margin to `10mm` regardless of header or footer state.
6. THE PDF_Options_Builder SHALL set the right margin to `10mm` regardless of header or footer state.

### Requirement 7: Page Break CSS Injection

**User Story:** As a user, I want to use CSS page-break properties in my Markdown to control where page breaks occur in the PDF, so that I can manage document layout.

#### Acceptance Criteria

1. WHEN `pageBreakEnabled` is `true`, THE Page_Break_Injector SHALL inject a `<style>` block before the `</head>` tag in the HTML content.
2. THE Page_Break_Injector SHALL include CSS rules that enable `page-break-before` and `page-break-after` properties.
3. WHEN the HTML content does not contain a `</head>` tag, THE Page_Break_Injector SHALL return the original HTML unchanged.
4. WHEN the Page_Break_Injector is applied to HTML that already contains the page-break style block, THE Page_Break_Injector SHALL not duplicate the style block.

### Requirement 8: HTML Escaping for Document Titles

**User Story:** As a user, I want document titles containing special characters to render safely in the PDF header, so that no HTML injection occurs from filenames.

#### Acceptance Criteria

1. WHEN the document title contains the character `<`, THE Header_Template_Generator SHALL replace it with `&lt;` in the generated HTML.
2. WHEN the document title contains the character `>`, THE Header_Template_Generator SHALL replace it with `&gt;` in the generated HTML.
3. WHEN the document title contains the character `&`, THE Header_Template_Generator SHALL replace it with `&amp;` in the generated HTML.
4. WHEN the document title contains the character `"`, THE Header_Template_Generator SHALL replace it with `&quot;` in the generated HTML.
5. WHEN the document title contains the character `'`, THE Header_Template_Generator SHALL replace it with `&#39;` in the generated HTML.
