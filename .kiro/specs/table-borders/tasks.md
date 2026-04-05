# Implementation Plan: Table Borders

## Overview

Add CSS table border styling to `media/preview.css` so that markdown tables display visible borders, proper cell padding, theme-aware colors, and print-friendly layout. This is a pure CSS change — no TypeScript modifications are needed. The same stylesheet is loaded by both the webview preview and the PDF export pipeline, so a single CSS update covers both rendering targets.

## Tasks

- [x] 1. Add CSS custom properties for table theming
  - [x] 1.1 Define light-theme table variables in `:root`
    - Add `--table-border: #d0d7de`, `--table-header-bg: #f6f8fa`, `--table-stripe-bg: #f6f8fa80` to the existing `:root` block in `media/preview.css`
    - _Requirements: 2.1_

  - [x] 1.2 Define dark-theme table variable overrides
    - Add `--table-border: #3d444d`, `--table-header-bg: #2d333b`, `--table-stripe-bg: #2d333b80` to the existing `body.vscode-dark, body.vscode-high-contrast` block in `media/preview.css`
    - _Requirements: 2.2_

- [x] 2. Add table element styles
  - [x] 2.1 Add base table, th, and td border and padding rules
    - Add `table` rule with `border-collapse: collapse`, `width: 100%`, `margin: 1rem 0`, `display: block`, `overflow-x: auto`
    - Add `th, td` rule with `border: 1px solid var(--table-border, #d0d7de)`, `padding: 0.5rem 0.75rem`, `text-align: left`
    - All `var()` calls must include fallback values
    - _Requirements: 1.1, 1.2, 1.3, 5.1, 5.2, 7.1_

  - [x] 2.2 Add header and stripe styling
    - Add `th` rule with `background: var(--table-header-bg, #f6f8fa)`, `font-weight: 600`
    - Add `tbody tr:nth-child(even)` rule with `background: var(--table-stripe-bg, #f6f8fa80)`
    - All `var()` calls must include fallback values
    - _Requirements: 2.3, 3.1, 3.2, 7.1_

  - [x] 2.3 Add print media rules for tables
    - Inside the existing `@media print` block, add `table { display: table; width: 100%; }` and `th, td { border: 1px solid #999; }`
    - This restores standard table layout for PDF and uses a fixed print-safe border color
    - _Requirements: 4.3, 5.3_

- [x] 3. Checkpoint — Verify CSS changes
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Validate correctness properties
  - [x] 4.1 Write property test: pipe tables produce styled HTML elements
    - **Property 1: Pipe tables produce styled HTML elements**
    - For any markdown string containing a valid pipe table, `renderMarkdownDocument()` produces HTML containing `<table>`, `<th>`, and `<td>` elements that match the CSS selectors in preview.css
    - Use fast-check to generate markdown strings with pipe tables
    - **Validates: Requirements 1.1, 4.1**

  - [x] 4.2 Write property test: theme variables have consistent light and dark definitions
    - **Property 2: Theme variables have consistent light and dark definitions**
    - Read `media/preview.css` and verify that each of `--table-border`, `--table-header-bg`, `--table-stripe-bg` is defined in both `:root` and `body.vscode-dark, body.vscode-high-contrast`, and that light and dark values differ
    - **Validates: Requirements 2.1, 2.2**

  - [x] 4.3 Write property test: all var() references include fallback values
    - **Property 3: All var() references include fallback values**
    - Parse all `var()` calls in table-related CSS rules and verify each includes a second (fallback) argument
    - **Validates: Requirement 7.1**

- [x] 5. Non-regression verification
  - [x] 5.1 Write unit test for non-regression on existing elements
    - Verify that the existing CSS rules for `body`, `pre`, `img`, `svg`, `.ms-error`, `.mermaid-host`, and `@media print` body rules are preserved unchanged in `media/preview.css`
    - Verify that new table styles only target `table`, `th`, `td`, `thead`, `tbody`, `tr` elements
    - _Requirements: 6.1, 6.2_

- [x] 6. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- The core implementation is tasks 1 and 2 — pure CSS additions to `media/preview.css`
- No TypeScript changes are needed; `buildHtml.ts` and `exportPdf.ts` already load `preview.css`
- Property tests use fast-check (already in devDependencies)
- Each property test maps to a correctness property from the design document
