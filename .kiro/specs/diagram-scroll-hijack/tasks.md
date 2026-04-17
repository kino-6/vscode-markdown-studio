# Implementation Tasks

## Task 1: Add focus state gating to zoom/pan handlers in preview.js

- [x] 1.1 Add `focused: false` property to the `state` object in `attachZoomPan` function in `media/preview.js`
- [x] 1.2 Modify `handleWheel` to check `state.focused` at the top — if `false`, return immediately without calling `event.preventDefault()` or modifying scale/translate
- [x] 1.3 Modify `handleMouseDown` to check `state.focused` — if `false`, set `state.focused = true`, add `diagram-focused` CSS class to the container, but do NOT initiate drag on this first click (activation click only)
- [x] 1.4 If `state.focused` is already `true` in `handleMouseDown`, proceed with existing drag logic (set `state.dragging = true`, record drag start coordinates, change cursor to `grabbing`)
- [x] 1.5 Add a document-level `mousedown` listener in `attachZoomPan` that deactivates focus: when a click occurs outside the focused container, set `state.focused = false` and remove the `diagram-focused` CSS class
- [x] 1.6 Add a `keydown` listener for the Escape key that deactivates the currently focused diagram container (set `state.focused = false`, remove `diagram-focused` class)
- [x] 1.7 Write unit tests verifying: `handleWheel` returns early when `state.focused` is false; `handleWheel` calls `preventDefault` and updates scale when `state.focused` is true; clicking a container activates focus; clicking outside deactivates focus; Escape deactivates focus

## Task 2: Update CSS for conditional cursor and focus indicator

- [x] 2.1 Change `.diagram-container` CSS rule in `media/preview.css` from `cursor: grab` to `cursor: default`
- [x] 2.2 Add `.diagram-container.diagram-focused { cursor: grab; }` rule to `media/preview.css`
- [x] 2.3 Add a visual focus indicator for `.diagram-container.diagram-focused` (e.g., `outline: 2px solid var(--vscode-focusBorder, #007fd4); outline-offset: -2px;`)
- [x] 2.4 Change `.diagram-container:hover .zoom-indicator { opacity: 1; }` to `.diagram-container.diagram-focused .zoom-indicator { opacity: 1; }` so zoom percentage only shows on focused containers
- [x] 2.5 Verify print styles remain unchanged (`.diagram-container` in `@media print` should still have `cursor: default` and `overflow: visible`)

## Task 3: Write exploratory property-based tests (bug condition)

- [x] 3.1 (**PBT - Exploration**) Write a property test that generates random wheel events (varying `deltaY`, `clientX`, `clientY`) on an unfocused `.diagram-container` and asserts that `event.preventDefault()` is called and scale changes — run on UNFIXED code to confirm the scroll hijack bug exists
- [x] 3.2 (**PBT - Exploration**) Write a property test that generates random mousedown+mousemove sequences on an unfocused `.diagram-container` and asserts that panning occurs — run on UNFIXED code to confirm the drag hijack bug exists

## Task 4: Write fix-verification property-based tests

- [x] 4.1 (**PBT - Fix**) Write a property test: for any wheel event (random `deltaY`, `clientX`, `clientY`) on an unfocused diagram container, `handleWheel` SHALL NOT call `event.preventDefault()` and SHALL NOT modify `state.scale`
- [x] 4.2 (**PBT - Fix**) Write a property test: for any wheel event on a focused diagram container, `handleWheel` SHALL call `event.preventDefault()` and SHALL update `state.scale` according to the zoom formula `clamp(scale * (1 + (-deltaY * ZOOM_SENSITIVITY)), MIN_SCALE, MAX_SCALE)`

## Task 5: Write preservation property-based tests

- [x] 5.1 (**PBT - Preservation**) Write a property test: for any wheel event (random `deltaY` in [-1000, 1000], random cursor position within container bounds) on a focused container, the fixed `handleWheel` SHALL produce the same `state.scale`, `state.translateX`, and `state.translateY` values as the original `handleWheel`
- [x] 5.2 (**PBT - Preservation**) Write a property test: for any mousedown+mousemove sequence on a focused container, the fixed drag handlers SHALL produce the same `state.translateX` and `state.translateY` values as the original handlers

## Task 6: Handle edge cases and multi-container interactions

- [x] 6.1 Ensure that when one diagram container is focused and the user clicks a different diagram container, the first container is deactivated (remove `diagram-focused` class, set `focused = false`) and the second is activated
- [x] 6.2 Ensure that `initZoomPan` re-initialization (called after `update-body` message or theme change) properly sets up focus gating on newly created containers without breaking existing focused state
- [x] 6.3 Ensure the `dblclick` handler on diagram containers only resets zoom when the container is focused — unfocused containers should not respond to double-click for zoom reset (but should still allow the source-line jump `dblclick` handler on `document.body` to fire)
- [x] 6.4 Write unit tests for: multi-container focus switching, re-initialization after content update, dblclick behavior on unfocused vs focused containers

## Task 7: Verify and finalize

- [x] 7.1 Run full unit test suite and verify all tests pass
- [x] 7.2 Run integration test suite and verify no regressions
- [x] 7.3 Run TypeScript type check / lint and verify no errors
- [x] 7.4 Manually verify in preview panel: scroll past diagrams without hijack, click to activate zoom, click outside to deactivate, Escape to deactivate
