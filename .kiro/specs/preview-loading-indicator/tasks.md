# Implementation Plan: Preview Loading Indicator

## Overview

Add a CSS-animated spinner overlay to the Markdown Studio preview panel that appears during rendering and disappears when content is ready. The Extension Host sends `render-start` before calling `renderBody()` and `render-error` on failure, while the webview shows/hides the overlay accordingly. A generation counter ensures stale messages are discarded.

## Tasks

- [x] 1. Add loading overlay CSS styles to preview.css
  - [x] 1.1 Add `.ms-loading-overlay` base styles
    - `position: fixed`, `top/left: 0`, `width/height: 100%`, `display: none`, `align-items: center`, `justify-content: center`, `z-index: 9999`, `pointer-events: none`
    - Light theme background: `rgba(0, 0, 0, 0.15)`
    - _Requirements: 7.2, 8.1_
  - [x] 1.2 Add dark/high-contrast theme overlay styles
    - `body.vscode-dark .ms-loading-overlay` and `body.vscode-high-contrast .ms-loading-overlay` with `background: rgba(0, 0, 0, 0.3)`
    - _Requirements: 7.1_
  - [x] 1.3 Add `.ms-spinner` styles and keyframe animation
    - 36px circle, 3px border, `border-top-color: var(--vscode-progressBar-background, #0078d4)`, `animation: ms-spin 0.8s linear infinite`
    - Add `@keyframes ms-spin { to { transform: rotate(360deg); } }`
    - _Requirements: 7.3_

- [x] 2. Implement showLoadingOverlay and hideLoadingOverlay in preview.js
  - [x] 2.1 Implement `showLoadingOverlay()` function
    - Check if `#ms-loading-overlay` exists; if not, create it with `.ms-loading-overlay` class and inner `.ms-spinner` div, append to `document.body`
    - Set `overlay.style.display = 'flex'`
    - _Requirements: 3.1, 4.1, 4.3_
  - [x] 2.2 Implement `hideLoadingOverlay()` function
    - Find `#ms-loading-overlay`; if it exists, set `overlay.style.display = 'none'`
    - If it does not exist, return silently
    - _Requirements: 3.2, 3.3, 4.2, 4.3_
  - [x] 2.3 Export `showLoadingOverlay` and `hideLoadingOverlay` for testability
  - [ ]* 2.4 Write property test for Property 3: Overlay idempotence and safety
    - **Property 3: Overlay idempotence and safety**
    - For any number N of consecutive `showLoadingOverlay()` calls, exactly one `#ms-loading-overlay` element exists in the DOM
    - Calling `hideLoadingOverlay()` when no overlay exists completes without error
    - **Validates: Requirements 4.1, 4.2, 4.3**
  - [x] 2.5 Write unit tests for show/hide overlay
    - Test: `showLoadingOverlay()` creates overlay with `display: flex`
    - Test: `hideLoadingOverlay()` sets overlay to `display: none`
    - Test: calling `showLoadingOverlay()` twice does not create duplicate elements
    - Test: calling `hideLoadingOverlay()` with no overlay does not throw
    - Test: after show then hide, overlay element remains in DOM with `display: none`
    - _Requirements: 4.1, 4.2, 4.3_

- [x] 3. Update webview message handler in preview.js to handle render-start and render-error
  - [x] 3.1 Add `render-start` message handling
    - In the message event listener, handle `type: 'render-start'`: if `message.generation > lastAppliedGeneration`, call `showLoadingOverlay()`
    - _Requirements: 3.1, 5.1_
  - [x] 3.2 Add `render-error` message handling
    - Handle `type: 'render-error'`: if `message.generation > lastAppliedGeneration`, call `hideLoadingOverlay()`
    - _Requirements: 3.3, 5.2_
  - [x] 3.3 Update existing `update-body` handler to hide overlay
    - After DOM update and `renderMermaidBlocks()`, call `hideLoadingOverlay()`
    - _Requirements: 3.2_
  - [ ]* 3.4 Write property test for Property 2: Monotonic generation ordering
    - **Property 2: Monotonic generation ordering**
    - For any sequence of messages with random generation numbers, the handler only acts on messages with generation strictly greater than `lastAppliedGeneration`, and `lastAppliedGeneration` only increases
    - **Validates: Requirements 5.1, 5.2**
  - [x] 3.5 Write unit tests for message handler
    - Test: `render-start` with valid generation calls `showLoadingOverlay()`
    - Test: `render-start` with stale generation is discarded
    - Test: `render-error` with valid generation calls `hideLoadingOverlay()`
    - Test: `render-error` with stale generation is discarded
    - Test: `update-body` calls `hideLoadingOverlay()` after DOM update
    - _Requirements: 3.1, 3.2, 3.3, 5.1, 5.2_

- [x] 4. Checkpoint - Verify webview-side changes
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Update webviewPanel.ts to send render-start and render-error messages
  - [x] 5.1 Send `render-start` message before `renderBody()` in the change handler
    - After incrementing generation, call `panel.webview.postMessage({ type: 'render-start', generation: thisGeneration })` before the `renderBody()` call
    - _Requirements: 1.1, 1.2_
  - [x] 5.2 Send `render-error` message on `renderBody()` failure
    - In the catch block, if `thisGeneration === generation`, call `panel.webview.postMessage({ type: 'render-error', generation: thisGeneration })`
    - _Requirements: 2.1, 2.2, 2.3_
  - [x] 5.3 Apply same changes to the reuse path (when panel already exists)
    - Ensure both the new-panel and reuse-panel code paths send `render-start` and `render-error`
    - _Requirements: 1.1, 2.1_
  - [ ]* 5.4 Write property test for Property 1: Spinner consistency
    - **Property 1: Spinner consistency**
    - For any text change event, the Change_Handler sends `render-start` followed by either `update-body` or `render-error` with the same generation (never leaves spinner hanging)
    - **Validates: Requirements 1.1, 2.1, 2.2, 3.2, 3.3**
  - [ ]* 5.5 Write property test for Property 4: Message ordering invariant
    - **Property 4: Message ordering invariant**
    - For any text change event, `render-start` is always sent before `update-body` or `render-error` for the same generation
    - **Validates: Requirements 1.1, 2.1**
  - [x] 5.6 Write unit tests for render-start and render-error messages
    - Test: change handler sends `render-start` before calling `renderBody()`
    - Test: on `renderBody()` error with current generation, `render-error` is sent
    - Test: on `renderBody()` error with stale generation, `render-error` is not sent
    - Test: successful render sends `render-start` then `update-body` in order
    - _Requirements: 1.1, 1.2, 2.1, 2.2, 2.3_

- [x] 6. Add initial load spinner support
  - [x] 6.1 Include loading overlay in initial HTML from `buildHtml()`
    - Add the `.ms-loading-overlay` div with `display: flex` in the `<body>` of the initial HTML output so the spinner is visible on first load
    - _Requirements: 6.1_
  - [x] 6.2 Hide spinner after initial Mermaid rendering in `DOMContentLoaded` handler
    - After `renderMermaidBlocks()` resolves in the `DOMContentLoaded` handler, call `hideLoadingOverlay()`
    - _Requirements: 6.2_
  - [x] 6.3 Write unit test for initial load spinner
    - Test: initial HTML contains `.ms-loading-overlay` with `display: flex`
    - Test: after DOMContentLoaded and Mermaid rendering, overlay is hidden
    - _Requirements: 6.1, 6.2_

- [x] 7. Final checkpoint - Ensure all tests pass
  - Run `npx vitest --run` and ensure all new and existing tests pass
  - Verify no regressions in existing preview functionality
  - Ask the user if questions arise

## Notes

- Tasks marked with `*` are optional property tests that can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests use fast-check and validate universal correctness properties from the design document
- No new external dependencies required — CSS-only animation, existing VS Code Webview API
- The loading overlay DOM element is reused (hidden/shown) rather than created/destroyed each time
