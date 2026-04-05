# Requirements Document

## Introduction

This document defines the requirements for adding CSS table border styling to the Markdown Studio preview and PDF export. Markdown tables rendered by markdown-it currently appear as unstyled text with no visible gridlines. These requirements ensure tables display with visible borders, proper cell padding, and theme-aware colors in both the webview preview and exported PDFs, using a pure CSS approach in `media/preview.css`.

## Glossary

- **Preview_CSS**: The `media/preview.css` stylesheet loaded by both the webview preview and the PDF export HTML pipeline
- **Table_Styles**: The CSS rules targeting `table`, `th`, `td`, `thead`, `tbody`, and `tr` elements produced by markdown-it
- **Theme_Variables**: CSS custom properties (`--table-border`, `--table-header-bg`, `--table-stripe-bg`) that adapt table colors to the active VS Code theme
- **Webview_Preview**: The VS Code webview panel that renders the live markdown preview
- **PDF_Export**: The Playwright-based export path that renders the same HTML to a PDF file
- **Light_Theme**: The VS Code theme where the body element does not have `vscode-dark` or `vscode-high-contrast` classes
- **Dark_Theme**: The VS Code theme where the body element has the `vscode-dark` or `vscode-high-contrast` class

## Requirements

### Requirement 1: Table Cell Borders

**User Story:** As a user, I want markdown tables to display visible cell borders, so that I can clearly distinguish rows and columns in the preview.

#### Acceptance Criteria

1. WHEN a markdown document containing a pipe table is rendered, THE Table_Styles SHALL apply a 1px solid border to every `<th>` and `<td>` element
2. THE Table_Styles SHALL use `border-collapse: collapse` on the `<table>` element so that adjacent cells share a single border line
3. THE Table_Styles SHALL apply padding of `0.5rem 0.75rem` to every `<th>` and `<td>` element for readable cell spacing

### Requirement 2: Theme-Aware Table Colors

**User Story:** As a user, I want table borders and backgrounds to adapt to my VS Code theme, so that tables remain readable in both light and dark modes.

#### Acceptance Criteria

1. THE Preview_CSS SHALL define CSS custom properties `--table-border`, `--table-header-bg`, and `--table-stripe-bg` in the `:root` selector with light-theme values
2. WHILE the Dark_Theme is active, THE Preview_CSS SHALL override `--table-border`, `--table-header-bg`, and `--table-stripe-bg` with dark-theme values using the `body.vscode-dark` and `body.vscode-high-contrast` selectors
3. THE Table_Styles SHALL reference Theme_Variables for border color, header background, and stripe background instead of hard-coded color values

### Requirement 3: Header and Stripe Styling

**User Story:** As a user, I want table headers and alternating rows to be visually distinct, so that I can scan table data quickly.

#### Acceptance Criteria

1. THE Table_Styles SHALL apply the `--table-header-bg` background color and `font-weight: 600` to all `<th>` elements
2. THE Table_Styles SHALL apply the `--table-stripe-bg` background color to even-numbered `<tbody>` rows using `tbody tr:nth-child(even)`

### Requirement 4: Preview and PDF Parity

**User Story:** As a user, I want table borders to appear in both the webview preview and the exported PDF, so that the output is consistent across formats.

#### Acceptance Criteria

1. WHEN a markdown document with tables is rendered in the Webview_Preview, THE Table_Styles SHALL produce visible borders on all table cells
2. WHEN a markdown document with tables is exported via PDF_Export, THE Table_Styles SHALL produce visible borders on all table cells in the PDF output
3. THE Preview_CSS SHALL include a `@media print` rule that sets `display: table` on the `<table>` element and applies a fixed border color suitable for print rendering

### Requirement 5: Wide Table Overflow Handling

**User Story:** As a user, I want wide tables to be scrollable in the preview rather than breaking the layout, so that I can view all columns without distortion.

#### Acceptance Criteria

1. THE Table_Styles SHALL set `display: block` and `overflow-x: auto` on the `<table>` element in the webview context to enable horizontal scrolling for wide tables
2. THE Table_Styles SHALL set `width: 100%` on the `<table>` element so that tables fill the available content width
3. WHILE the document is being rendered for print, THE Table_Styles SHALL set `display: table` on the `<table>` element to restore standard table layout for PDF output

### Requirement 6: Non-Regression on Existing Elements

**User Story:** As a user, I want the addition of table styles to not affect the rendering of other markdown elements, so that my existing documents look the same.

#### Acceptance Criteria

1. THE Table_Styles SHALL only target `table`, `th`, `td`, `thead`, `tbody`, and `tr` HTML elements and SHALL NOT modify styles of any other elements
2. THE Preview_CSS SHALL preserve all existing CSS rules for `body`, `pre`, `img`, `svg`, `.ms-error`, `.mermaid-host`, and `@media print` without modification

### Requirement 7: CSS Variable Fallback

**User Story:** As a developer, I want CSS custom properties to include fallback values, so that tables degrade gracefully if variables are not resolved.

#### Acceptance Criteria

1. IF a Theme_Variable is not resolved by the rendering engine, THEN THE Table_Styles SHALL use an inline fallback value in each `var()` call to ensure borders remain visible
