# Requirements Document

## Introduction

Markdown Studio's preview panel currently replaces the entire `webview.html` on every text change, causing full page reloads that destroy scroll position, flicker the display, and lose Mermaid render state. This feature introduces an incremental update path: after the initial full-page load, subsequent edits post only the rendered body HTML to the webview via `postMessage`. The webview script patches the DOM in-place, preserving scroll position and avoiding reloads. A generation counter ensures out-of-order async renders are discarded.

## Glossary

- **Preview_Panel**: The VS Code `WebviewPanel` managed by `webviewPanel.ts` that displays the rendered Markdown preview.
- **Change_Handler**: The `onDidChangeTextDocument` callback registered in `webviewPanel.ts` that triggers preview updates when the source document is edited.
- **Generation_Counter**: An integer counter incremented on each text change event, used to discard stale async render results.
- **Render_Body**: The `renderBody()` function in `buildHtml.ts` that returns only the rendered HTML body content without `<html>`, `<head>`, or `<meta>` wrapper tags.
- **Build_Html**: The existing `buildHtml()` function in `buildHtml.ts` that produces a full HTML document with CSP headers, stylesheets, and scripts for initial panel creation.
- **Update_Message**: A message of type `update-body` sent from the extension host to the webview containing the rendered body HTML and a generation number.
- **Message_Handler**: The `message` event listener in `preview.js` that receives Update_Messages and patches the DOM.
- **Tracked_URI**: The URI of the source document currently associated with the Preview_Panel.

## Requirements

### Requirement 1: Incremental Body Rendering

**User Story:** As a developer, I want the preview to update only the body content on edits, so that the preview does not flicker or lose scroll position.

#### Acceptance Criteria

1. WHEN a text change event occurs for the Tracked_URI, THE Change_Handler SHALL call Render_Body to produce body-only HTML and post an Update_Message to the Preview_Panel webview.
2. THE Render_Body function SHALL return an HTML string that contains no `<!doctype`, `<html>`, `<head>`, or `<meta>` tags.
3. WHEN the Preview_Panel is first created, THE Build_Html function SHALL produce a full HTML document including CSP headers, stylesheets, and scripts for the initial load.
4. WHEN an Update_Message is received by the Message_Handler, THE Message_Handler SHALL replace `document.body.innerHTML` with the received HTML content.

### Requirement 2: Document URI Filtering

**User Story:** As a developer editing multiple files, I want the preview to update only when the tracked document changes, so that edits to unrelated files do not trigger preview updates.

#### Acceptance Criteria

1. WHEN a text change event occurs for a document whose URI does not match the Tracked_URI, THE Change_Handler SHALL not post any message to the Preview_Panel.
2. WHEN the Preview_Panel is reused for a different document, THE Change_Handler SHALL update the Tracked_URI to match the new document and dispose the previous change listener.

### Requirement 3: Generation Counter Ordering

**User Story:** As a developer typing rapidly, I want stale render results to be discarded, so that the preview always reflects the latest edit.

#### Acceptance Criteria

1. WHEN a text change event occurs, THE Change_Handler SHALL increment the Generation_Counter before starting the render.
2. WHEN Render_Body completes, THE Change_Handler SHALL compare the current Generation_Counter to the value captured before rendering and discard the result if the counter has advanced.
3. WHEN the Message_Handler receives an Update_Message with a generation number less than or equal to the last applied generation, THE Message_Handler SHALL discard the message.

### Requirement 4: Mermaid Re-rendering

**User Story:** As a developer using Mermaid diagrams, I want diagrams to re-render after incremental updates, so that diagram changes appear in the preview.

#### Acceptance Criteria

1. WHEN the Message_Handler applies an Update_Message to the DOM, THE Message_Handler SHALL re-run Mermaid block rendering on the updated content.

### Requirement 5: Panel Lifecycle Safety

**User Story:** As a developer, I want the preview to clean up resources when the panel is closed, so that no stale listeners or messages leak.

#### Acceptance Criteria

1. WHEN the Preview_Panel is disposed, THE Change_Handler SHALL dispose the text change listener and cease posting messages.
2. IF Render_Body is in progress when the Preview_Panel is disposed, THEN THE Change_Handler SHALL discard the render result via the Generation_Counter check and not call postMessage on the disposed panel.

### Requirement 6: Error Resilience

**User Story:** As a developer, I want the preview to remain stable when rendering fails, so that a malformed edit does not break the preview.

#### Acceptance Criteria

1. IF Render_Body throws an error during rendering, THEN THE Change_Handler SHALL log the error and leave the current preview content unchanged.
2. WHEN a subsequent successful render completes after a failed render, THE Change_Handler SHALL post the successful result to the Preview_Panel normally.
