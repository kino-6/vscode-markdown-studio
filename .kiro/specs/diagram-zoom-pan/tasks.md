# Implementation Plan: Diagram Zoom & Pan

## Overview

Add interactive zoom (scroll-wheel, cursor-centered), pan (mouse drag), and reset (double-click) controls to all diagram types in the Markdown Studio webview preview. Implementation spans `renderMarkdown.ts` (container wrapping), `preview.js` (ZoomPanController), and `preview.css` (styles). All logic is client-side with no new dependencies.

## Tasks

- [x] 1. Add diagram container wrapping in renderMarkdown.ts
  - [x] 1.1 Wrap PlantUML SVG output in `<div class="diagram-container">...</div>` in `renderMarkdownDocument()`
    - When a PlantUML block renders successfully, wrap `result.svg` in a diagram-container div before assigning to `replacement`
    - _Requirements: 1.2, 1.4_
  - [x] 1.2 Wrap inline SVG output in `<div class="diagram-container">...</div>` in `renderMarkdownDocument()`
    - When an `svg` fenced block is processed, wrap the `sanitizeSvg()` output in a diagram-container div
    - _Requirements: 1.3, 1.4_
  - [x] 1.3 Wrap Mermaid `.mermaid-host` placeholder in `<div class="diagram-container">...</div>` in `renderMarkdownDocument()`
    - When a Mermaid block renders successfully, wrap `result.placeholder` in a diagram-container div
    - _Requirements: 1.1, 1.4_
  - [x] 1.4 Write property test for diagram wrapping preserves content
    - **Property 1: Diagram wrapping preserves content**
    - Generate arbitrary HTML content strings, wrap in diagram-container, verify inner HTML is identical to original
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4**
  - [x] 1.5 Write unit tests for diagram container wrapping
    - Test that renderMarkdownDocument output contains `.diagram-container` divs around each diagram type
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2. Add diagram container and zoom indicator CSS styles in preview.css
  - [x] 2.1 Add `.diagram-container` base styles
    - `position: relative`, `overflow: hidden`, `cursor: grab`, `margin: 1rem 0`
    - Add `will-change: transform` and `transform-origin: 0 0` on `.diagram-container svg` and `.diagram-container .mermaid-host`
    - _Requirements: 10.1, 11.1_
  - [x] 2.2 Add `.zoom-indicator` overlay styles
    - Absolute positioned top-right, semi-transparent background, `pointer-events: none`, `opacity: 0` by default, `opacity: 1` on `.diagram-container:hover`
    - _Requirements: 5.2, 5.3, 5.4, 5.5_
  - [x] 2.3 Add `@media print` rules for diagram containers
    - Reset `overflow: visible`, `cursor: default` on container; `transform: none !important` on inner elements; `display: none` on `.zoom-indicator`
    - _Requirements: 8.1, 8.2, 8.3_

- [x] 3. Checkpoint - Verify wrapping and styles
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement ZoomPanController in preview.js
  - [x] 4.1 Add constants and `clamp` utility function
    - Define `MIN_SCALE = 0.25`, `MAX_SCALE = 4.0`, `ZOOM_SENSITIVITY = 0.001`
    - Implement `clamp(value, min, max)` returning `Math.min(Math.max(value, min), max)`
    - _Requirements: 2.2_
  - [x] 4.2 Implement `applyTransform(container, state)` function
    - Query inner element (`svg` or `.mermaid-host`), return early if not found
    - Set `transform: translate(tx, ty) scale(s)` with `transform-origin: 0 0`
    - Create or update `.zoom-indicator` with `Math.round(state.scale * 100) + '%'`
    - _Requirements: 11.1, 11.2, 5.1_
  - [x] 4.3 Implement `handleWheel(event, container, state)` function
    - Call `preventDefault()`, get container bounding rect, guard against zero-dimension containers
    - Compute cursor position relative to container, calculate new scale with clamping
    - Adjust translateX/Y for cursor-centered zoom using ratio formula from design
    - Call `applyTransform`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_
  - [x] 4.4 Implement `handleMouseDown`, `handleMouseMove`, `handleMouseUp` functions
    - `handleMouseDown`: only activate on `event.button === 0`, set `dragging = true`, record drag start, set `cursor: grabbing`
    - `handleMouseMove`: if dragging, update translateX/Y from mouse displacement, call `applyTransform`
    - `handleMouseUp`: set `dragging = false`, restore `cursor: grab`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 10.1, 10.2, 10.3_
  - [x] 4.5 Implement `handleDblClick(container, state)` function
    - Reset scale to 1.0, translateX/Y to 0, call `applyTransform`
    - Note: must not conflict with existing dblclick-to-jump handler; only handle when target is inside a `.diagram-container`
    - _Requirements: 4.1, 4.2_
  - [x] 4.6 Implement `attachZoomPan(container)` and `initZoomPan()` functions
    - `attachZoomPan`: create fresh state object, store as `container._zoomState`, set `data-zoom-init` attribute, attach all event listeners (wheel with `{ passive: false }`, mousedown, mousemove, mouseup, mouseleave, dblclick)
    - `initZoomPan`: query all `.diagram-container` elements, skip those with `data-zoom-init`, call `attachZoomPan` on each
    - _Requirements: 6.1, 6.2, 6.3_
  - [x] 4.7 Write property test for zoom scale clamping
    - **Property 2: Zoom scale clamping invariant**
    - Use fast-check to generate arbitrary sequences of deltaY values, verify scale stays in [0.25, 4.0] after each
    - **Validates: Requirement 2.2**
  - [x] 4.8 Write property test for cursor-centered zoom stability
    - **Property 3: Cursor-centered zoom stability**
    - For arbitrary initial state, cursor position, and deltaY, verify the content-space point under cursor maps to same screen coordinate (within 1e-9 tolerance)
    - **Validates: Requirement 2.3**
  - [x] 4.9 Write property test for double-click reset
    - **Property 4: Double-click reset from any state**
    - For arbitrary scale/translateX/translateY, verify handleDblClick produces `{ scale: 1.0, translateX: 0, translateY: 0 }`
    - **Validates: Requirements 4.1, 4.2**
  - [x] 4.10 Write property test for pan displacement
    - **Property 5: Pan displacement correctness**
    - For arbitrary initial translate and mouse coordinates, verify resulting translate equals expected displacement
    - **Validates: Requirement 3.3**
  - [x] 4.11 Write property test for non-left-click drag rejection
    - **Property 6: Non-left-click does not initiate drag**
    - For any mousedown event with button !== 0, verify dragging remains false
    - **Validates: Requirement 3.2**
  - [x] 4.12 Write property test for zoom indicator percentage
    - **Property 7: Zoom indicator displays correct percentage**
    - For any scale in [0.25, 4.0], verify indicator text equals `Math.round(scale * 100) + '%'`
    - **Validates: Requirement 5.1**
  - [x] 4.13 Write property test for initialization idempotency
    - **Property 8: Initialization idempotency**
    - For any number of consecutive initZoomPan calls, verify `data-zoom-init` is set exactly once per container
    - **Validates: Requirements 6.1, 6.2**

- [x] 5. Checkpoint - Verify ZoomPanController logic
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Integrate ZoomPanController with existing preview lifecycle
  - [x] 6.1 Call `initZoomPan()` after Mermaid rendering on DOMContentLoaded
    - In the `DOMContentLoaded` handler, call `initZoomPan()` after `renderMermaidBlocks()` resolves
    - _Requirements: 6.3_
  - [x] 6.2 Call `initZoomPan()` after `update-body` message handler re-renders content
    - After `renderMermaidBlocks()` in the message handler, call `initZoomPan()`
    - _Requirements: 6.3_
  - [x] 6.3 Re-initialize zoom/pan after theme-change re-render
    - In the `observeThemeChanges` callback, after `renderMermaidBlocks()` resolves, remove `data-zoom-init` from all `.diagram-container` elements and call `initZoomPan()`
    - _Requirements: 7.1, 7.2_
  - [x] 6.4 Prevent dblclick-to-jump conflict inside diagram containers
    - In the existing `dblclick` handler on `document.body`, check if `event.target` is inside a `.diagram-container` and skip `jumpToLine` if so (zoom reset takes priority)
    - _Requirements: 4.1_
  - [x] 6.5 Export new functions for testability
    - Export `initZoomPan`, `clamp`, `handleWheel`, `handleDblClick`, `handleMouseDown`, `handleMouseMove`, `handleMouseUp`, `applyTransform` from `preview.js`
    - _Requirements: 9.1, 9.3_

- [x] 7. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- All code runs within existing CSP-permitted bundles (Requirements 9.1, 9.2, 9.3)
- No new npm dependencies required
