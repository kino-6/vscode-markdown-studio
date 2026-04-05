# Requirements Document

## Introduction

Markdown Studio renders Mermaid, PlantUML, and inline SVG diagrams in the webview preview. Currently these diagrams are static — users cannot zoom in on detail or pan across large diagrams. This feature adds interactive zoom (scroll-wheel, cursor-centered), pan (mouse drag), and reset (double-click) controls to all diagram types. All logic is client-side in `media/preview.js` and `media/preview.css`, with no extension host changes beyond HTML wrapping and no impact on PDF export.

## Glossary

- **Diagram_Container**: A `<div class="diagram-container">` wrapper element that encloses a rendered diagram (Mermaid, PlantUML, or inline SVG) and serves as the event target for zoom/pan interactions.
- **Zoom_Pan_Controller**: The client-side JavaScript module in `preview.js` that discovers Diagram_Container elements and attaches zoom, pan, and reset event listeners with per-container state.
- **Zoom_Pan_State**: A per-container object tracking `scale`, `translateX`, `translateY`, `dragging`, `dragStartX`, and `dragStartY`.
- **Zoom_Indicator**: A `<div class="zoom-indicator">` overlay element inside each Diagram_Container that displays the current zoom percentage.
- **Inner_Element**: The first `<svg>` or `.mermaid-host` child element inside a Diagram_Container to which CSS transforms are applied.
- **Init_Guard**: The `data-zoom-init` HTML attribute set on a Diagram_Container after event listeners are attached, preventing duplicate binding.
- **Render_Markdown**: The `renderMarkdownDocument()` function in `renderMarkdown.ts` that produces the HTML body for the preview.
- **MIN_SCALE**: The minimum allowed zoom level, equal to 0.25 (25%).
- **MAX_SCALE**: The maximum allowed zoom level, equal to 4.0 (400%).
- **ZOOM_SENSITIVITY**: A constant controlling the scale delta per wheel deltaY pixel, equal to 0.001.

## Requirements

### Requirement 1: Diagram Container Wrapping

**User Story:** As a developer previewing Markdown, I want all rendered diagrams wrapped in a consistent container, so that zoom and pan controls can target them uniformly.

#### Acceptance Criteria

1. WHEN Render_Markdown processes a Mermaid block, THE Render_Markdown function SHALL wrap the `.mermaid-host` div inside a Diagram_Container div.
2. WHEN Render_Markdown processes a PlantUML block that renders successfully, THE Render_Markdown function SHALL wrap the PlantUML SVG output inside a Diagram_Container div.
3. WHEN Render_Markdown processes an inline SVG block that renders successfully, THE Render_Markdown function SHALL wrap the inline SVG output inside a Diagram_Container div.
4. THE Diagram_Container div SHALL preserve all existing HTML content and attributes of the wrapped diagram element.

### Requirement 2: Zoom via Scroll Wheel

**User Story:** As a developer viewing a diagram, I want to zoom in and out with the scroll wheel centered on my cursor, so that I can inspect diagram details without losing my point of focus.

#### Acceptance Criteria

1. WHEN a wheel event occurs on a Diagram_Container, THE Zoom_Pan_Controller SHALL adjust the Zoom_Pan_State scale by a factor derived from the wheel deltaY and ZOOM_SENSITIVITY.
2. WHEN the Zoom_Pan_Controller computes a new scale value, THE Zoom_Pan_Controller SHALL clamp the scale to the range [MIN_SCALE, MAX_SCALE].
3. WHEN a zoom operation changes the scale, THE Zoom_Pan_Controller SHALL adjust translateX and translateY so that the content point under the cursor remains at the same screen coordinate.
4. WHEN a wheel event occurs on a Diagram_Container, THE Zoom_Pan_Controller SHALL call preventDefault on the event to suppress default page scrolling.
5. IF the Diagram_Container has zero width or zero height, THEN THE Zoom_Pan_Controller SHALL ignore the wheel event and leave the Zoom_Pan_State unchanged.

### Requirement 3: Pan via Mouse Drag

**User Story:** As a developer viewing a zoomed diagram, I want to click and drag to pan across the diagram, so that I can navigate to different areas.

#### Acceptance Criteria

1. WHEN a left-button mousedown event occurs on a Diagram_Container, THE Zoom_Pan_Controller SHALL set the Zoom_Pan_State dragging flag to true and record the drag start coordinates.
2. WHEN a mousedown event occurs with a button other than the left button, THE Zoom_Pan_Controller SHALL not initiate dragging.
3. WHILE the Zoom_Pan_State dragging flag is true, WHEN a mousemove event occurs, THE Zoom_Pan_Controller SHALL update translateX and translateY based on the mouse displacement from the drag start and apply the transform.
4. WHEN a mouseup event occurs on a Diagram_Container, THE Zoom_Pan_Controller SHALL set the Zoom_Pan_State dragging flag to false.
5. WHEN a mouseleave event occurs on a Diagram_Container, THE Zoom_Pan_Controller SHALL set the Zoom_Pan_State dragging flag to false to prevent a stuck-drag state.

### Requirement 4: Double-Click Reset

**User Story:** As a developer who has zoomed or panned a diagram, I want to double-click to reset to the original view, so that I can quickly return to the default scale and position.

#### Acceptance Criteria

1. WHEN a dblclick event occurs on a Diagram_Container, THE Zoom_Pan_Controller SHALL reset the Zoom_Pan_State scale to 1.0, translateX to 0, and translateY to 0.
2. WHEN the Zoom_Pan_Controller resets the Zoom_Pan_State, THE Zoom_Pan_Controller SHALL apply the reset transform to the Inner_Element and update the Zoom_Indicator to display "100%".

### Requirement 5: Zoom Level Indicator

**User Story:** As a developer interacting with a diagram, I want to see the current zoom level, so that I know how far I have zoomed in or out.

#### Acceptance Criteria

1. WHEN the Zoom_Pan_Controller applies a transform to a Diagram_Container, THE Zoom_Pan_Controller SHALL update the Zoom_Indicator text to show the current scale as a rounded integer percentage.
2. WHILE the user hovers over a Diagram_Container, THE Zoom_Indicator SHALL be visible with opacity 1.
3. WHILE the user is not hovering over a Diagram_Container, THE Zoom_Indicator SHALL be hidden with opacity 0.
4. THE Zoom_Indicator SHALL be positioned at the top-right corner of the Diagram_Container with a semi-transparent background.
5. THE Zoom_Indicator SHALL have pointer-events set to none so that it does not intercept mouse interactions.

### Requirement 6: Initialization and Double-Binding Prevention

**User Story:** As a developer, I want zoom/pan listeners to be attached exactly once per container, so that repeated initialization calls do not cause duplicate event handling.

#### Acceptance Criteria

1. WHEN the Zoom_Pan_Controller initializes a Diagram_Container, THE Zoom_Pan_Controller SHALL set the Init_Guard attribute on the container.
2. WHEN the Zoom_Pan_Controller encounters a Diagram_Container that already has the Init_Guard attribute, THE Zoom_Pan_Controller SHALL skip that container without attaching additional listeners.
3. WHEN the DOM content is loaded, THE Zoom_Pan_Controller SHALL call initZoomPan after Mermaid blocks have been rendered.

### Requirement 7: Re-initialization After Theme Change

**User Story:** As a developer switching VS Code themes, I want zoom/pan to work on re-rendered Mermaid diagrams, so that theme changes do not break diagram interactivity.

#### Acceptance Criteria

1. WHEN a Mermaid theme-change re-render completes, THE Zoom_Pan_Controller SHALL remove the Init_Guard attribute from all Diagram_Container elements.
2. WHEN the Init_Guard attributes have been cleared after a re-render, THE Zoom_Pan_Controller SHALL call initZoomPan to re-attach listeners with fresh Zoom_Pan_State.

### Requirement 8: Print Isolation

**User Story:** As a developer exporting to PDF, I want zoom/pan transforms removed and indicators hidden, so that the exported document shows diagrams at their original scale.

#### Acceptance Criteria

1. WHILE the document is rendered in print media, THE Diagram_Container SHALL have overflow set to visible and cursor set to default.
2. WHILE the document is rendered in print media, THE Inner_Element SHALL have its CSS transform reset to none.
3. WHILE the document is rendered in print media, THE Zoom_Indicator SHALL be hidden with display set to none.

### Requirement 9: CSP Compliance

**User Story:** As a developer, I want the zoom/pan feature to work without Content Security Policy changes, so that the existing security posture is maintained.

#### Acceptance Criteria

1. THE Zoom_Pan_Controller SHALL execute entirely within the existing `preview.js` bundle that is already permitted by the webview script-src CSP directive.
2. THE Diagram_Container styles SHALL be defined entirely within the existing `preview.css` stylesheet that is already permitted by the webview style-src CSP directive.
3. THE Zoom_Pan_Controller SHALL not use eval, inline scripts, or dynamic style injection.

### Requirement 10: Visual Feedback for Drag State

**User Story:** As a developer dragging a diagram, I want the cursor to change to indicate the drag state, so that I have clear visual feedback of the interaction mode.

#### Acceptance Criteria

1. THE Diagram_Container SHALL display a grab cursor by default.
2. WHILE the Zoom_Pan_State dragging flag is true, THE Diagram_Container SHALL display a grabbing cursor.
3. WHEN the Zoom_Pan_State dragging flag transitions to false, THE Diagram_Container SHALL restore the grab cursor.

### Requirement 11: Transform Application

**User Story:** As a developer, I want transforms applied correctly to the diagram content, so that zoom and pan produce the expected visual result.

#### Acceptance Criteria

1. WHEN the Zoom_Pan_Controller applies a transform, THE Zoom_Pan_Controller SHALL set the Inner_Element CSS transform to `translate(translateX, translateY) scale(scale)` with transform-origin at `0 0`.
2. IF a Diagram_Container has no Inner_Element (no svg or .mermaid-host child), THEN THE Zoom_Pan_Controller SHALL skip the transform application without error.
