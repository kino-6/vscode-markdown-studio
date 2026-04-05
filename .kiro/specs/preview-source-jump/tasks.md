# Implementation Plan: Preview Source Jump

## Overview

Implement double-click-to-source-jump in the Markdown preview. The work threads through four layers: markdown-it source line injection, sanitizer allowlisting, webview double-click handler, and extension host message handler, all gated by a new VS Code setting.

## Tasks

- [x] 1. Add configuration setting and config helper
  - [x] 1.1 Register `markdownStudio.preview.sourceJump.enabled` in `package.json` contributes.configuration
    - Add boolean setting with `default: false` and description
    - _Requirements: 5.1_
  - [x] 1.2 Add `sourceJumpEnabled` field to `MarkdownStudioConfig` in `src/infra/config.ts`
    - Read `preview.sourceJump.enabled` from workspace configuration in `getConfig()`
    - _Requirements: 5.1, 5.3_

- [x] 2. Implement source line attribute injection in the markdown-it parser
  - [x] 2.1 Create `addSourceLineAttributes` function in `src/parser/parseMarkdown.ts`
    - Patch renderer rules for block-level token types (`paragraph_open`, `heading_open`, `blockquote_open`, `list_item_open`, `bullet_list_open`, `ordered_list_open`, `table_open`, `thead_open`, `tbody_open`, `tr_open`, `hr`, `code_block`, `fence`, `html_block`)
    - For each token with a valid `map` property, call `token.attrSet('data-source-line', String(token.map[0]))`
    - Preserve existing attributes and fall back to default renderer
    - _Requirements: 1.1, 1.2, 1.3, 1.4_
  - [x] 2.2 Write property test for source line injection correctness
    - **Property 1: Source line injection correctness**
    - **Validates: Requirements 1.1, 1.2, 1.4**
  - [x] 2.3 Write property test for attribute preservation under injection
    - **Property 2: Attribute preservation under injection**
    - **Validates: Requirement 1.3**

- [x] 3. Update sanitizer to allow `data-source-line` attribute
  - [x] 3.1 Add `data-source-line` to the `allowedAttributes` in `sanitizeHtmlOutput` in `src/renderers/renderMarkdown.ts`
    - Add `data-source-line` to the `'*'` key in `allowedAttributes`
    - _Requirements: 2.1, 2.2_
  - [x] 3.2 Write property test for sanitizer preserving data-source-line
    - **Property 3: Sanitizer preserves data-source-line**
    - **Validates: Requirements 2.1, 2.2**

- [x] 4. Checkpoint - Verify source line attributes in rendered HTML
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement webview double-click handler in `media/preview.js`
  - [x] 5.1 Add `findSourceLine` function to `media/preview.js`
    - Walk from element up through `parentElement` until `data-source-line` is found or `<body>` is reached
    - Parse attribute value as integer, return `number | null`
    - _Requirements: 3.1, 3.3, 3.4_
  - [x] 5.2 Register `dblclick` listener on `document.body` in the `DOMContentLoaded` handler
    - Call `findSourceLine(event.target)`, if non-null post `{ type: 'jumpToLine', line }` via `vscode.postMessage()`
    - _Requirements: 3.2_
  - [x] 5.3 Write property test for DOM walker findSourceLine
    - **Property 4: DOM walker finds nearest source line**
    - **Validates: Requirements 3.1, 3.3, 3.4**

- [x] 6. Implement extension host jump handler in `src/preview/webviewPanel.ts`
  - [x] 6.1 Add `onDidReceiveMessage` handler to the webview panel in `openOrRefreshPreview`
    - Check `message.type === 'jumpToLine'` and `typeof message.line === 'number'`
    - Read `markdownStudio.preview.sourceJump.enabled` setting; return early if `false`
    - Validate `message.line` is a finite non-negative integer; ignore otherwise
    - Clamp line to `editor.document.lineCount - 1`
    - Call `vscode.window.showTextDocument(uri)` then set `editor.selection` and `editor.revealRange` with `InCenter`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 5.2, 5.3_
  - [x] 6.2 Write property test for setting gate suppressing navigation
    - **Property 5: Setting gate suppresses navigation**
    - **Validates: Requirements 4.2, 5.2**
  - [x] 6.3 Write property test for line clamping
    - **Property 6: Line clamping for out-of-range values**
    - **Validates: Requirement 4.4**
  - [x] 6.4 Write property test for invalid message rejection
    - **Property 7: Invalid message rejection**
    - **Validates: Requirements 4.5, 4.6**
  - [x] 6.5 Write unit tests for jump handler
    - Test handler calls `showTextDocument` with correct URI and line when enabled
    - Test handler does not call `showTextDocument` when setting is disabled
    - Test line clamping and invalid message scenarios
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

- [x] 7. Wire message handler into both panel creation paths
  - [x] 7.1 Ensure `onDidReceiveMessage` is registered for both new panel creation and panel reuse paths in `openOrRefreshPreview`
    - Dispose and re-register the message listener when the tracked document changes
    - Export `findSourceLine` from `media/preview.js` for testability
    - _Requirements: 4.1, 6.1, 6.2_

- [x] 8. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- The implementation language is TypeScript (matching the existing codebase), with JavaScript for `media/preview.js`
