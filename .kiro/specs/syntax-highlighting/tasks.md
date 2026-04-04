# Implementation Plan: Syntax Highlighting for Code Blocks

## Overview

Integrate highlight.js into the markdown-it rendering pipeline so fenced code blocks are syntax-highlighted server-side. This involves installing highlight.js, wiring a highlight callback into the parser, shipping a light/dark theme CSS file, updating the HTML build pipeline to include the theme stylesheet, and verifying sanitize-html compatibility.

## Tasks

- [x] 1. Install highlight.js and set up language registration module
  - [x] 1.1 Install highlight.js as a production dependency
    - Run `npm install highlight.js`
    - Verify `highlight.js` appears in `package.json` dependencies
    - _Requirements: 9.1_

  - [x] 1.2 Create `src/parser/highlightCode.ts` with language registration and highlight function
    - Import `highlight.js/lib/core` and register individual languages: TypeScript, JavaScript, Python, Java, JSON, YAML, Bash, Shell, HTML, XML, CSS, SQL, Go, Rust, C, C++, C#, Ruby, PHP, Swift, Kotlin, Dockerfile, Markdown, Plaintext
    - Export a `highlightCode(code: string, lang: string): string` function
    - If `lang` is known, return `hljs.highlight(code, { language: lang }).value`
    - If `lang` is unknown or empty, return `''`
    - Wrap `hljs.highlight` in try/catch, return `''` on error
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 9.1_

  - [x] 1.3 Write property tests for highlightCode
    - [x] 1.3.1 Property test for Property 1: Supported language produces class-based highlighted output
      - **Property 1: Supported language produces class-based highlighted output**
      - For any code string and any language in the supported set, output contains `<span class="hljs-` and no inline `style` attributes
      - **Validates: Requirements 1.2, 6.1**
    - [x] 1.3.2 Property test for Property 2: Unknown language returns empty string
      - **Property 2: Unknown language returns empty string**
      - For any code string and any language not in the supported set (including empty), output is `''`
      - **Validates: Requirements 1.3, 1.4**
    - [x] 1.3.3 Property test for Property 3: Highlight callback never throws
      - **Property 3: Highlight callback never throws**
      - For any arbitrary string as code and any arbitrary string as language, the function returns a string without throwing
      - **Validates: Requirement 1.5**
    - [x] 1.3.4 Property test for Property 4: Case-insensitive language resolution
      - **Property 4: Case-insensitive language resolution**
      - For any supported language name and any case permutation, the engine resolves and produces highlighted output
      - **Validates: Requirement 2.2**

- [x] 2. Integrate highlight callback into markdown-it parser
  - [x] 2.1 Modify `createMarkdownParser()` in `src/parser/parseMarkdown.ts`
    - Import `highlightCode` from `./highlightCode`
    - Pass `highlight: highlightCode` in the MarkdownIt constructor options
    - _Requirements: 1.1, 8.1_

  - [x] 2.2 Write unit tests for the modified parser
    - Test that rendering a fenced block with a known language (e.g., `typescript`) produces HTML with `hljs-` class spans
    - Test that rendering a fenced block with an unknown language produces plain escaped `<pre><code>` output
    - Test that rendering a fenced block with no language produces plain escaped output
    - _Requirements: 1.2, 1.3, 1.4, 7.1, 7.2_

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Create theme CSS and update preview asset pipeline
  - [x] 4.1 Create `media/hljs-theme.css` with light and dark highlight.js color rules
    - Include light-mode highlight.js styles as default
    - Include dark-mode styles inside `@media (prefers-color-scheme: dark)` block
    - Use GitHub / GitHub Dark theme colors (or similar readable theme)
    - _Requirements: 3.1, 3.2_

  - [x] 4.2 Update `PreviewAssetUris` interface and `getPreviewAssetUris()` in `src/preview/previewAssets.ts`
    - Add `hljsStyleUri: vscode.Uri` to the `PreviewAssetUris` interface
    - Resolve the URI for `media/hljs-theme.css` via `webview.asWebviewUri()`
    - _Requirements: 4.1, 4.2, 6.3_

  - [x] 4.3 Update `buildHtml()` in `src/preview/buildHtml.ts` to include hljs theme CSS
    - Accept `hljsStyleUri` from the assets parameter
    - Add a `<link rel="stylesheet" href="...">` for the hljs theme CSS in the HTML `<head>`
    - Do not modify the existing CSP directives
    - _Requirements: 3.3, 3.4, 6.2, 8.3_

  - [x] 4.4 Write unit tests for buildHtml hljs CSS inclusion
    - Test that output HTML contains a `<link>` tag referencing the hljs theme CSS
    - Test that CSP header is unchanged
    - _Requirements: 3.3, 6.2_

- [x] 5. Verify sanitize-html compatibility and end-to-end rendering
  - [x] 5.1 Verify `sanitizeHtmlOutput` preserves hljs class attributes
    - Confirm the existing sanitize-html config in `src/renderers/renderMarkdown.ts` allows `class` on `span` elements (already configured — add a test to lock this in)
    - _Requirements: 5.1, 5.2_

  - [x] 5.2 Write property test for Property 5: Sanitizer preserves hljs class attributes
    - **Property 5: Sanitizer preserves hljs class attributes**
    - For any HTML string with `<span>` elements having `hljs-*` classes, the sanitizer preserves those spans and classes
    - **Validates: Requirement 5.1**

  - [x] 5.3 Write property test for Property 6: Unknown language renders as plain escaped text end-to-end
    - **Property 6: Unknown language renders as plain escaped text end-to-end**
    - For any markdown with a fenced code block using an unsupported language, the parser renders it as escaped plain text with no `hljs-*` spans
    - **Validates: Requirements 7.1, 7.2**

  - [x] 5.4 Write property test for Property 7: Preview and PDF share identical highlighted tokens
    - **Property 7: Preview and PDF share identical highlighted tokens**
    - For any markdown with fenced code blocks, the highlighted HTML tokens from preview rendering are identical to those from PDF export rendering
    - **Validates: Requirement 8.2**

- [x] 6. Update callers to pass new asset URI
  - [x] 6.1 Update `openOrRefreshPreview()` in `src/preview/webviewPanel.ts`
    - The `getPreviewAssetUris()` return type now includes `hljsStyleUri` — ensure `buildHtml` receives it via the assets object
    - Update the assets type passed to `buildHtml` to include `hljsStyleUri`
    - _Requirements: 3.3, 4.1_

  - [x] 6.2 Update `exportPdf` pipeline if it calls `buildHtml` directly
    - Ensure the PDF export path also passes the hljs theme CSS (or inlines it) so PDF code blocks are colorized
    - _Requirements: 3.4, 8.2_

- [x] 7. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The design uses TypeScript throughout — all implementation tasks use TypeScript
