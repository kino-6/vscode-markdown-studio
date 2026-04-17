# Diagram Scroll Hijack Bugfix Design

## Overview

When a user scrolls through the Markdown preview panel, the scroll wheel event is captured by any `.diagram-container` (Mermaid, PlantUML, SVG) the cursor passes over. The `handleWheel` function in `media/preview.js` unconditionally calls `event.preventDefault()` and zooms the diagram, hijacking the page scroll. This is disorienting and breaks the reading flow.

The fix implements a GitHub-style interaction model: diagram zoom/pan only activates after the user explicitly clicks the diagram container to focus it. Unfocused diagrams pass scroll events through to the page. Clicking outside a focused diagram deactivates zoom/pan mode.

## Glossary

- **Bug_Condition (C)**: A wheel event occurs on a `.diagram-container` that has NOT been explicitly focused/clicked by the user — the event is captured and `preventDefault()` is called, stopping page scroll
- **Property (P)**: When a diagram container is not focused, wheel events SHALL pass through to the page for normal scrolling; when focused, wheel events SHALL zoom the diagram as before
- **Preservation**: All existing zoom, pan, double-click reset, and zoom indicator behaviors on focused diagram containers must remain unchanged
- **`handleWheel`**: Function in `media/preview.js` that processes wheel events on diagram containers — currently calls `event.preventDefault()` unconditionally and applies zoom transform
- **`attachZoomPan`**: Function in `media/preview.js` that attaches wheel, mousedown, mousemove, mouseup, mouseleave, and dblclick event listeners to a `.diagram-container`
- **`initZoomPan`**: Function in `media/preview.js` that finds all `.diagram-container` elements and calls `attachZoomPan` on each one that hasn't been initialized
- **Focus state**: A new per-container boolean tracked in the zoom state object, toggled by click (activate) and outside-click/Escape (deactivate)

## Bug Details

### Bug Condition

The bug manifests when a user scrolls through the preview panel and the cursor passes over a diagram container. The `attachZoomPan` function registers a `wheel` event listener with `{ passive: false }` and the `handleWheel` handler unconditionally calls `event.preventDefault()`, which stops the browser's native page scroll. The diagram then zooms instead of letting the scroll pass through.

**Formal Specification:**

```
FUNCTION isBugCondition(input)
  INPUT: input of type { event: WheelEvent, container: HTMLElement }
  OUTPUT: boolean

  RETURN input.event.type == 'wheel'
         AND input.event.target IS inside input.container
         AND input.container HAS class 'diagram-container'
         AND input.container IS NOT focused (not explicitly clicked by user)
END FUNCTION
```

### Examples

- **Scroll past Mermaid diagram**: User scrolls down through a long document. Cursor passes over a Mermaid flowchart. Expected: page continues scrolling smoothly. Actual: scroll stops, diagram zooms in/out.
- **Scroll past PlantUML diagram**: User scrolls up through a document with a PlantUML sequence diagram. Expected: page continues scrolling. Actual: scroll halts, diagram zooms.
- **Scroll past inline SVG**: User scrolls through a document with an embedded SVG diagram. Expected: page scroll continues. Actual: scroll is captured, SVG zooms.
- **Accidental drag on unfocused diagram**: User's mouse passes over a diagram container while clicking/dragging to select text. Expected: text selection continues. Actual: diagram pans instead.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Zoom via scroll wheel on a focused (clicked) diagram container must continue to work exactly as before
- Pan via mouse drag on a focused diagram container must continue to work exactly as before
- Double-click to reset zoom on a focused diagram container must continue to work exactly as before
- Zoom indicator overlay showing percentage must continue to display on focused containers
- Page scroll in areas outside diagram containers must remain unchanged
- Diagram rendering (Mermaid, PlantUML, SVG) must remain unchanged
- Theme change re-initialization of zoom/pan must continue to work
- Print styles (overflow: visible, cursor: default, transform: none) must remain unchanged

**Scope:**
All inputs that do NOT involve wheel/mouse events on an unfocused diagram container should be completely unaffected by this fix. This includes:
- All keyboard interactions
- Mouse clicks and scrolling outside diagram containers
- Zoom/pan interactions on focused diagram containers
- Diagram rendering and re-rendering
- Copy button functionality on code blocks
- TOC link navigation
- Source line double-click jump

## Hypothesized Root Cause

Based on the bug description and code analysis, the root cause is:

1. **Unconditional `event.preventDefault()` in `handleWheel`**: The `handleWheel` function in `media/preview.js` (line ~165) calls `event.preventDefault()` as its first statement, before any focus check. This blocks the browser's native scroll behavior for ALL wheel events on diagram containers, regardless of user intent.

2. **No focus/activation gate on event handlers**: The `attachZoomPan` function registers all event listeners (wheel, mousedown, mousemove, mouseup, mouseleave, dblclick) unconditionally. There is no concept of an "active" or "focused" state that gates whether zoom/pan should respond to events.

3. **`{ passive: false }` on wheel listener**: The wheel event listener is explicitly registered with `{ passive: false }` to allow `preventDefault()`. This is correct for focused diagrams but harmful for unfocused ones where scroll should pass through.

4. **Cursor style suggests interactivity**: The CSS sets `cursor: grab` on `.diagram-container` unconditionally, visually suggesting the container is always interactive, which compounds the UX confusion.

## Correctness Properties

Property 1: Bug Condition - Scroll Pass-Through on Unfocused Diagrams

_For any_ wheel event on a `.diagram-container` that has NOT been explicitly clicked/focused by the user, the fixed `handleWheel` function SHALL NOT call `event.preventDefault()` and SHALL NOT modify the diagram's zoom scale, allowing the browser's native page scroll to continue uninterrupted.

**Validates: Requirements 2.1**

Property 2: Preservation - Zoom/Pan on Focused Diagrams

_For any_ wheel event on a `.diagram-container` that HAS been explicitly clicked/focused by the user, the fixed code SHALL produce exactly the same zoom behavior as the original code — calling `event.preventDefault()`, computing the new scale, and applying the transform — preserving all existing zoom, pan, double-click reset, and zoom indicator functionality.

**Validates: Requirements 3.1, 3.2, 3.3, 3.5**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `media/preview.js`

**Function**: `attachZoomPan`, `handleWheel`, `handleMouseDown`

**Specific Changes**:

1. **Add `focused` state to zoom state object**: In `attachZoomPan`, add `focused: false` to the `state` object. This tracks whether the user has explicitly clicked the container to activate zoom/pan.

2. **Gate `handleWheel` on focus state**: At the top of `handleWheel`, check `state.focused`. If `false`, return immediately without calling `event.preventDefault()` — this lets the wheel event bubble up for normal page scroll.

3. **Activate focus on click**: In the `mousedown` handler, set `state.focused = true` and add a CSS class (e.g., `diagram-focused`) to the container for visual feedback. Only then proceed with pan logic.

4. **Deactivate focus on outside click**: Add a document-level `mousedown` listener (in `attachZoomPan` or `initZoomPan`) that checks if the click target is outside all focused diagram containers. If so, set `state.focused = false` and remove the `diagram-focused` CSS class.

5. **Deactivate focus on Escape key**: Add a `keydown` listener that deactivates the focused diagram when Escape is pressed.

6. **Gate drag handlers on focus state**: In `handleMouseDown`, only initiate drag if `state.focused` is true. This prevents accidental panning when the user's mouse passes over an unfocused diagram.

7. **Update cursor style**: Change the default CSS for `.diagram-container` from `cursor: grab` to `cursor: default`. Apply `cursor: grab` only when the container has the `diagram-focused` class.

**File**: `media/preview.css`

**Specific Changes**:

8. **Conditional cursor style**: Change `.diagram-container { cursor: grab; }` to `.diagram-container { cursor: default; }` and add `.diagram-container.diagram-focused { cursor: grab; }`.

9. **Visual focus indicator**: Add a subtle border or outline style for `.diagram-container.diagram-focused` to indicate the container is in interactive mode (e.g., `outline: 2px solid var(--vscode-focusBorder, #007fd4); outline-offset: -2px;`).

10. **Conditional zoom indicator visibility**: Change `.diagram-container:hover .zoom-indicator` to `.diagram-container.diagram-focused .zoom-indicator` so the zoom percentage only shows when the diagram is focused.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write tests that simulate wheel events on diagram containers without any prior click/focus and assert that `event.preventDefault()` is called and the zoom scale changes. Run these tests on the UNFIXED code to observe the scroll hijacking behavior.

**Test Cases**:
1. **Wheel on unfocused Mermaid container**: Simulate a wheel event on a `.diagram-container` without clicking it first — observe that `preventDefault()` is called and scale changes (will fail on unfixed code)
2. **Wheel on unfocused PlantUML container**: Same test with a PlantUML-rendered SVG container (will fail on unfixed code)
3. **Mouse drag on unfocused container**: Simulate mousedown + mousemove on an unfocused container — observe that panning occurs (will fail on unfixed code)
4. **Multiple containers**: Simulate scrolling past multiple diagram containers — observe that each one captures the scroll (will fail on unfixed code)

**Expected Counterexamples**:
- `event.preventDefault()` is called on every wheel event regardless of focus state
- Diagram scale changes from 1.0 on unfocused containers
- Possible causes: no focus gate in `handleWheel`, unconditional `preventDefault()`

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**

```
FOR ALL input WHERE isBugCondition(input) DO
  result := handleWheel_fixed(input.event, input.container, state)
  ASSERT event.preventDefault WAS NOT called
  ASSERT state.scale == previousScale  // unchanged
  ASSERT page scroll continues
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**

```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT handleWheel_original(input) == handleWheel_fixed(input)
  // Focused containers zoom exactly as before
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain (various deltaY values, cursor positions, scale levels)
- It catches edge cases that manual unit tests might miss (e.g., boundary scales at MIN_SCALE/MAX_SCALE)
- It provides strong guarantees that zoom math is unchanged for focused containers

**Test Plan**: Observe behavior on UNFIXED code first for wheel events on containers (which are always "focused" in the current code), then write property-based tests capturing that zoom behavior and verify it's preserved for explicitly-focused containers after the fix.

**Test Cases**:
1. **Zoom math preservation**: Verify that for a focused container, `handleWheel` produces the same scale and translate values as the original code for any deltaY and cursor position
2. **Pan preservation**: Verify that mousedown + mousemove on a focused container produces the same translate values as the original code
3. **Double-click reset preservation**: Verify that double-click on a focused container resets scale to 1.0 and translate to (0, 0)
4. **Zoom indicator preservation**: Verify that the zoom indicator shows the correct percentage on focused containers

### Unit Tests

- Test that `handleWheel` returns early (no `preventDefault`, no scale change) when `state.focused` is false
- Test that `handleWheel` calls `preventDefault` and updates scale when `state.focused` is true
- Test that clicking a container sets `state.focused` to true and adds `diagram-focused` class
- Test that clicking outside a focused container sets `state.focused` to false and removes `diagram-focused` class
- Test that pressing Escape deactivates a focused container
- Test that `handleMouseDown` does not initiate drag when `state.focused` is false
- Test that `handleMouseDown` initiates drag when `state.focused` is true
- Test edge case: clicking one diagram then clicking another — first should deactivate, second should activate

### Property-Based Tests

- Generate random wheel events (varying deltaY, clientX, clientY) on focused containers and verify zoom math matches original `handleWheel` output
- Generate random sequences of focus/unfocus/wheel events and verify that unfocused containers never have their scale modified
- Generate random drag sequences on focused containers and verify pan math matches original `handleMouseMove` output

### Integration Tests

- Test full flow: render Mermaid diagram → scroll past it (no zoom) → click it → scroll (zoom) → click outside → scroll past (no zoom)
- Test theme change re-initialization preserves focus state behavior
- Test `update-body` message handler re-initializes zoom/pan with focus gate intact
- Test multiple diagram containers: focus one, scroll on another (unfocused one should not zoom)
