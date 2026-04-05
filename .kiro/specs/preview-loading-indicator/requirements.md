# Requirements Document

## Introduction

Markdown Studio's preview panel currently provides no visual feedback while rendering Markdown content, especially when processing time-consuming Mermaid or PlantUML diagrams. This feature adds a loading indicator (spinner overlay) that appears during rendering and disappears when the content is ready. The Extension Host sends `render-start` and `render-error` messages alongside the existing `update-body` message, and the webview displays or hides a CSS-animated spinner overlay accordingly.

## Glossary

- **Preview_Panel**: The VS Code `WebviewPanel` managed by `webviewPanel.ts` that displays the rendered Markdown preview.
- **Change_Handler**: The `onDidChangeTextDocument` callback registered in `webviewPanel.ts` that triggers preview updates when the source document is edited.
- **Generation_Counter**: An integer counter incremented on each text change event, used to discard stale async render results and coordinate spinner state.
- **Render_Body**: The `renderBody()` function in `buildHtml.ts` that returns only the rendered HTML body content.
- **Loading_Overlay**: A fixed-position semi-transparent overlay element (`.ms-loading-overlay`) containing a CSS-animated spinner, displayed over the preview content during rendering.
- **Show_Loading**: The `showLoadingOverlay()` function in `preview.js` that creates (if needed) and displays the Loading_Overlay.
- **Hide_Loading**: The `hideLoadingOverlay()` function in `preview.js` that hides the Loading_Overlay without removing it from the DOM.
- **Message_Handler**: The `message` event listener in `preview.js` that receives messages from the Extension Host and controls the Loading_Overlay and DOM updates.

## Requirements

### Requirement 1: Render Start Notification

**User Story:** As a developer, I want the extension host to notify the webview when rendering begins, so that the webview can show a loading indicator.

#### Acceptance Criteria

1. WHEN a text change event occurs for the tracked document, THE Change_Handler SHALL send a `render-start` message with the current generation number to the Preview_Panel webview before calling Render_Body.
2. THE `render-start` message SHALL contain a `type` field with value `"render-start"` and a `generation` field with a positive integer.

### Requirement 2: Render Error Notification

**User Story:** As a developer, I want the loading indicator to disappear when rendering fails, so that the spinner does not remain visible indefinitely.

#### Acceptance Criteria

1. IF Render_Body throws an error during rendering, THEN THE Change_Handler SHALL send a `render-error` message with the current generation number to the Preview_Panel webview.
2. THE Change_Handler SHALL send the `render-error` message only when the Generation_Counter has not advanced past the failed render's generation.
3. THE `render-error` message SHALL contain a `type` field with value `"render-error"` and a `generation` field matching the failed render's generation.

### Requirement 3: Loading Overlay Display

**User Story:** As a developer, I want to see a spinner overlay while the preview is rendering, so that I know the preview is processing my changes.

#### Acceptance Criteria

1. WHEN the Message_Handler receives a `render-start` message with a generation greater than the last applied generation, THE Message_Handler SHALL call Show_Loading to display the Loading_Overlay.
2. WHEN the Message_Handler receives an `update-body` message with a valid generation, THE Message_Handler SHALL call Hide_Loading after updating the DOM and re-rendering Mermaid blocks.
3. WHEN the Message_Handler receives a `render-error` message with a generation greater than the last applied generation, THE Message_Handler SHALL call Hide_Loading.

### Requirement 4: Overlay Idempotence and Safety

**User Story:** As a developer, I want the loading overlay to behave correctly regardless of how many times it is shown or hidden, so that no duplicate overlays appear and no errors occur.

#### Acceptance Criteria

1. WHEN Show_Loading is called multiple times without an intervening Hide_Loading call, THE Show_Loading function SHALL ensure only one Loading_Overlay element exists in the DOM.
2. WHEN Hide_Loading is called and no Loading_Overlay element exists in the DOM, THE Hide_Loading function SHALL complete without error.
3. THE Loading_Overlay element SHALL be hidden via `display: none` rather than removed from the DOM, so that the element is reused on subsequent Show_Loading calls.

### Requirement 5: Generation-Based Message Ordering

**User Story:** As a developer typing rapidly, I want stale loading messages to be ignored, so that the spinner state always reflects the latest render cycle.

#### Acceptance Criteria

1. WHEN the Message_Handler receives a `render-start` message with a generation less than or equal to the last applied generation, THE Message_Handler SHALL discard the message.
2. WHEN the Message_Handler receives a `render-error` message with a generation less than or equal to the last applied generation, THE Message_Handler SHALL discard the message.

### Requirement 6: Initial Load Spinner

**User Story:** As a developer, I want to see a loading indicator during the initial preview load, so that I know the preview is being prepared.

#### Acceptance Criteria

1. WHEN the Preview_Panel is first created, THE Loading_Overlay SHALL be visible in the initial HTML until Mermaid block rendering completes.
2. WHEN DOMContentLoaded fires and Mermaid block rendering completes, THE Message_Handler SHALL call Hide_Loading to remove the spinner.

### Requirement 7: Theme-Aware Overlay Styling

**User Story:** As a developer using dark or light themes, I want the loading overlay to match my current theme, so that the spinner does not look out of place.

#### Acceptance Criteria

1. WHILE the VS Code theme is a dark or high-contrast theme, THE Loading_Overlay SHALL use a darker semi-transparent background.
2. WHILE the VS Code theme is a light theme, THE Loading_Overlay SHALL use a lighter semi-transparent background.
3. THE spinner element SHALL use the VS Code progress bar color variable (`--vscode-progressBar-background`) for the active border color.

### Requirement 8: Non-Blocking Overlay

**User Story:** As a developer, I want to scroll the preview while the spinner is visible, so that the loading indicator does not block interaction.

#### Acceptance Criteria

1. WHILE the Loading_Overlay is visible, THE Loading_Overlay SHALL have `pointer-events: none` so that scroll and click events pass through to the content beneath.
