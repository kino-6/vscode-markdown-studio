# Requirements Document

## Introduction

This document specifies the requirements for the Preview Source Jump feature in Markdown Studio. The feature enables users to double-click an element in the Markdown preview webview to navigate the editor to the corresponding source line. Because this behavior can be disruptive (it steals editor focus), it is gated behind a VS Code setting that defaults to disabled.

## Glossary

- **Source_Line_Injector**: The markdown-it renderer rule component that adds `data-source-line` attributes to block-level HTML elements during Markdown rendering.
- **DOM_Walker**: The `findSourceLine` function in `preview.js` that traverses the DOM upward from a clicked element to locate the nearest `data-source-line` attribute.
- **Jump_Handler**: The `onDidReceiveMessage` handler in `webviewPanel.ts` that receives `jumpToLine` messages and navigates the editor.
- **Sanitizer**: The `sanitize-html` configuration in `renderMarkdown.ts` that controls which HTML attributes survive sanitization.
- **Preview_Webview**: The VS Code webview panel that renders the Markdown preview.
- **Extension_Host**: The VS Code extension process that manages the webview panel and editor interactions.
- **Source_Map**: The `token.map` property on markdown-it tokens, an array where `map[0]` is the 0-based start line of the token in the source document.

## Requirements

### Requirement 1: Source Line Attribute Injection

**User Story:** As a developer, I want the Markdown parser to embed source line metadata into rendered HTML, so that the preview can map visual elements back to their source positions.

#### Acceptance Criteria

1. WHEN a markdown-it block-level token has a valid `map` property, THE Source_Line_Injector SHALL add a `data-source-line` attribute to the opening HTML tag with the value of `map[0]`
2. WHEN a markdown-it token does not have a `map` property, THE Source_Line_Injector SHALL render the token without a `data-source-line` attribute
3. THE Source_Line_Injector SHALL preserve all existing HTML attributes on tokens when injecting the `data-source-line` attribute
4. THE Source_Line_Injector SHALL inject `data-source-line` on all block-level token types that carry source maps, including paragraph, heading, blockquote, list item, list, table, horizontal rule, code block, fence, and html_block tokens

### Requirement 2: Sanitizer Allowlisting

**User Story:** As a developer, I want the HTML sanitizer to preserve `data-source-line` attributes, so that source line metadata survives sanitization and reaches the webview.

#### Acceptance Criteria

1. THE Sanitizer SHALL allow the `data-source-line` attribute on all block-level HTML elements
2. WHEN HTML passes through sanitization, THE Sanitizer SHALL preserve `data-source-line` attributes that contain non-negative integer values

### Requirement 3: Webview Double-Click Handler

**User Story:** As a user, I want to double-click on an element in the preview to jump to its source line, so that I can quickly navigate between the preview and the editor.

#### Acceptance Criteria

1. WHEN a user double-clicks on an element in the Preview_Webview, THE DOM_Walker SHALL traverse from the clicked element upward through parent elements to find the nearest ancestor with a `data-source-line` attribute
2. WHEN the DOM_Walker finds an ancestor with a `data-source-line` attribute, THE Preview_Webview SHALL post a `jumpToLine` message to the Extension_Host containing the integer value of that attribute
3. WHEN the DOM_Walker reaches the `<body>` element without finding a `data-source-line` attribute, THE Preview_Webview SHALL take no action
4. THE DOM_Walker SHALL terminate for any element in the DOM tree without traversing past the `<body>` element

### Requirement 4: Extension Host Jump Handler

**User Story:** As a user, I want the editor to scroll to the correct source line when I double-click in the preview, so that I can see and edit the corresponding Markdown source.

#### Acceptance Criteria

1. WHEN the Jump_Handler receives a `jumpToLine` message and `markdownStudio.preview.sourceJump.enabled` is `true`, THE Jump_Handler SHALL open the source document and scroll the editor to the specified line
2. WHEN the Jump_Handler receives a `jumpToLine` message and `markdownStudio.preview.sourceJump.enabled` is `false`, THE Jump_Handler SHALL ignore the message and perform no editor navigation
3. WHEN the Jump_Handler navigates to a line, THE Jump_Handler SHALL place the cursor at the beginning of that line and reveal the line centered in the viewport
4. IF the `jumpToLine` message contains a line number greater than or equal to the document line count, THEN THE Jump_Handler SHALL clamp the line to the last line of the document
5. IF the `jumpToLine` message contains a `line` value that is not a finite non-negative integer, THEN THE Jump_Handler SHALL ignore the message
6. IF the `jumpToLine` message has a `type` value other than `'jumpToLine'`, THEN THE Jump_Handler SHALL ignore the message

### Requirement 5: Configuration Setting

**User Story:** As a user, I want a setting to enable or disable preview source jump, so that I can control whether double-clicking in the preview navigates the editor.

#### Acceptance Criteria

1. THE Extension_Host SHALL expose a `markdownStudio.preview.sourceJump.enabled` setting of type boolean with a default value of `false`
2. WHEN `markdownStudio.preview.sourceJump.enabled` is `false`, THE Extension_Host SHALL suppress all editor navigation triggered by preview double-clicks
3. WHEN `markdownStudio.preview.sourceJump.enabled` is changed at runtime, THE Extension_Host SHALL respect the updated value on the next double-click without requiring a preview reload

### Requirement 6: No Visual Impact on Preview

**User Story:** As a user, I want the source jump feature to have no visible effect on the preview rendering, so that my reading experience is unaffected.

#### Acceptance Criteria

1. THE Source_Line_Injector SHALL inject only `data-source-line` attributes that produce no visible change in the rendered preview
2. THE Preview_Webview SHALL not display any additional visual indicators, cursors, or highlights as a result of the source line attributes
