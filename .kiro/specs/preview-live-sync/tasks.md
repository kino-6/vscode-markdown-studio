# Implementation Plan: Preview Live Sync

## Overview

Replace the full `webview.html` assignment on every keystroke with an incremental update path that posts only the rendered body HTML via `postMessage`. Add a generation counter to discard stale async renders, and update `preview.js` to patch the DOM in-place and re-render Mermaid blocks.

## Tasks

- [x] 1. Add `renderBody()` function to `buildHtml.ts`
  - [x] 1.1 Create the `renderBody()` export in `src/preview/buildHtml.ts`
    - Import `renderMarkdownDocument` (already imported)
    - Implement `renderBody(markdown, context)` that calls `renderMarkdownDocument()` and returns only `htmlBody`
    - _Requirements: 1.2, 1.3_

  - [x] 1.2 Write property test for Property 1: Body-only content
    - **Property 1: Body-only content**
    - For any arbitrary Markdown string, `renderBody()` output contains no `<!doctype`, `<html>`, `<head>`, or `<meta>` tags
    - Use fast-check to generate arbitrary strings including edge cases (empty, whitespace, HTML-like content)
    - **Validates: Requirement 1.2**

  - [x] 1.3 Write unit test for `renderBody()` basic behavior
    - Test that `renderBody('# Hello')` returns HTML containing an `<h1>` tag
    - Test that `renderBody('')` returns a string (may be empty)
    - _Requirements: 1.2_

- [x] 2. Update `webviewPanel.ts` to use incremental updates with generation counter
  - [x] 2.1 Add generation counter and tracked URI state to `webviewPanel.ts`
    - Add module-level `let generation = 0` counter
    - Ensure `trackedUri` is stored and updated when panel is reused
    - _Requirements: 3.1, 2.2_

  - [x] 2.2 Modify the change handler to use `postMessage` instead of `webview.html` assignment
    - On first open: keep `webview.html = await buildHtml(...)` for initial load
    - On subsequent edits: increment generation, call `renderBody()`, check generation still current, then `postMessage({ type: 'update-body', html, generation })`
    - Filter out events where `event.document.uri` does not match tracked URI
    - _Requirements: 1.1, 2.1, 3.1, 3.2_

  - [x] 2.3 Add error handling in the change handler
    - Wrap `renderBody()` call in try/catch
    - On error: log to output channel, do not post message, leave preview unchanged
    - _Requirements: 6.1, 6.2_

  - [x] 2.4 Ensure panel dispose cleans up listener and resets generation
    - On `panel.onDidDispose`: dispose change subscription, reset `currentPanel`, `changeSubscription`, and `generation`
    - The generation counter check naturally prevents posting to a disposed panel
    - _Requirements: 5.1, 5.2_

  - [x] 2.5 Write unit tests for the updated change handler
    - Test: matching URI fires postMessage with `{ type: 'update-body', html, generation }`
    - Test: non-matching URI does not fire postMessage
    - Test: generation counter prevents stale update (simulate two async renders resolving out of order)
    - Test: disposed panel does not receive postMessage
    - Test: renderBody error is caught and logged, no postMessage call
    - _Requirements: 1.1, 2.1, 3.1, 3.2, 5.1, 5.2, 6.1_

- [x] 3. Update `preview.js` to handle `update-body` messages
  - [x] 3.1 Add message listener for `update-body` in `media/preview.js`
    - Add `let lastAppliedGeneration = -1` state
    - Listen for `message` events via `window.addEventListener('message', ...)`
    - On `update-body`: check generation > lastAppliedGeneration, update lastAppliedGeneration, replace `document.body.innerHTML`, call `renderMermaidBlocks()`
    - Discard messages with stale generation
    - _Requirements: 1.4, 3.3, 4.1_

  - [x] 3.2 Write property test for Property 2: Monotonic generation ordering
    - **Property 2: Monotonic generation ordering**
    - For any sequence of generation numbers, the message handler only applies messages with strictly increasing generation numbers
    - Use fast-check to generate arrays of random non-negative integers as generation sequences
    - **Validates: Requirements 3.2, 3.3**

  - [x] 3.3 Write unit tests for the message handler
    - Test: valid update-body message replaces document.body.innerHTML
    - Test: stale generation message is discarded
    - Test: renderMermaidBlocks is called after DOM update
    - Test: non-update-body message types are ignored
    - _Requirements: 1.4, 3.3, 4.1_

- [x] 4. Checkpoint - Verify all tests pass
  - Run `npx vitest --run` and ensure all new and existing tests pass
  - Verify no regressions in existing preview functionality

- [x] 5. Write property test for Property 3: URI filtering
  - **Property 3: URI filtering**
  - For any text change event whose document URI does not match the tracked URI, the change handler does not post any message
  - Use fast-check to generate random URI strings that differ from the tracked URI
  - **Validates: Requirement 2.1**

- [x] 6. Integration smoke test
  - [x] 6.1 Write integration test for end-to-end incremental update
    - Open a Markdown file, call `openOrRefreshPreview`, edit the document, verify the webview receives an `update-body` postMessage with correct body content
    - _Requirements: 1.1, 1.4_

- [x] 7. Final checkpoint - Ensure all tests pass
  - Run `npx vitest --run` and ensure all tests pass
  - Ask the user if questions arise

## Notes

- Each task references specific requirements for traceability
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The initial `buildHtml()` path remains unchanged — only subsequent edits use the incremental path
- The generation counter serves as a natural debounce, eliminating the need for explicit throttling
