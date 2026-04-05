# Requirements Document

## Introduction

This document captures the requirements for the Loading Screen Enhancement feature of Markdown Studio. The feature adds environment validation status lines to the preview loading screen and removes the non-functional timer element. Users gain immediate visibility into environment health (Java, PlantUML, Chromium, temp directory) while waiting for the full preview to render.

## Glossary

- **Loading_Screen**: The lightweight HTML page displayed in the webview panel while the full Markdown preview is being rendered.
- **Loading_Overlay**: The overlay element (`ms-loading-overlay`) used during incremental re-renders in `preview.js` to indicate rendering is in progress.
- **Status_Line**: A single string from the `validateEnvironment()` result describing one environment check, prefixed with ✅ or ❌.
- **Environment_Validator**: The `validateEnvironment()` function in `validateEnvironmentCore.ts` that checks Java, PlantUML jar, temp directory, and Chromium availability.
- **Loading_HTML_Builder**: The `buildLoadingHtml()` function in `buildHtml.ts` that generates the static loading page HTML.
- **Preview_Script**: The `preview.js` module that runs inside the webview and manages overlay show/hide, Mermaid rendering, and message handling.
- **Full_Preview_Builder**: The `buildHtml()` function in `buildHtml.ts` that generates the complete preview HTML with rendered Markdown content.
- **CSP**: Content Security Policy — the HTTP header embedded in the loading page that restricts resource loading.

## Requirements

### Requirement 1: Display Environment Status on Loading Screen

**User Story:** As a user, I want to see environment validation status on the loading screen, so that I know whether my environment is healthy while waiting for the preview to render.

#### Acceptance Criteria

1. WHEN the preview panel is opened, THE Loading_HTML_Builder SHALL accept an optional array of Status_Lines and render each as a separate HTML div element
2. WHEN a Status_Line starts with ✅, THE Loading_HTML_Builder SHALL assign the CSS class `ms-env-ok` to that div element
3. WHEN a Status_Line starts with ❌, THE Loading_HTML_Builder SHALL assign the CSS class `ms-env-fail` to that div element
4. WHEN a Status_Line starts with neither ✅ nor ❌, THE Loading_HTML_Builder SHALL assign only the base CSS class `ms-env-line` to that div element
5. WHEN the statusLines parameter is undefined or an empty array, THE Loading_HTML_Builder SHALL produce a loading page with the spinner and no status section

### Requirement 2: Gather Environment Status Before Showing Loading Screen

**User Story:** As a user, I want the loading screen to show my environment status immediately, so that I get useful feedback without waiting for the full preview.

#### Acceptance Criteria

1. WHEN the preview panel is opened or refreshed, THE webviewPanel module SHALL call the Environment_Validator and pass the resulting Status_Lines to the Loading_HTML_Builder before setting the webview HTML
2. IF the Environment_Validator throws an error, THEN THE webviewPanel module SHALL fall back to calling the Loading_HTML_Builder with an empty status lines array so the spinner still displays
3. WHEN dependencyStatus is undefined, THE webviewPanel module SHALL pass undefined as the managedDeps parameter to the Environment_Validator, allowing it to skip managed-dependency checks gracefully

### Requirement 3: Remove Non-Functional Timer Element

**User Story:** As a developer, I want to remove the dead timer code from the loading screen and preview script, so that the codebase has no unreachable code paths.

#### Acceptance Criteria

1. THE Loading_HTML_Builder SHALL produce HTML that does not contain any element with id or class `ms-loading-timer`
2. THE Full_Preview_Builder SHALL produce HTML that does not contain any element with id or class `ms-loading-timer`
3. THE Preview_Script SHALL not contain any timer interval variables, timer update functions, or timer-related DOM creation logic
4. THE preview CSS SHALL not contain any `.ms-loading-timer` style rule

### Requirement 4: Preserve Loading Screen Security Policy

**User Story:** As a developer, I want the loading screen to remain script-free, so that the strict CSP is maintained and no script execution is possible on the loading page.

#### Acceptance Criteria

1. THE Loading_HTML_Builder SHALL produce HTML that does not contain any `<script>` tags
2. THE Loading_HTML_Builder SHALL include a CSP meta tag with `default-src 'none'` and no `script-src` directive
3. WHEN Status_Lines contain HTML-like characters, THE Loading_HTML_Builder SHALL escape the content before embedding to prevent injection

### Requirement 5: Add CSS Styles for Environment Status Display

**User Story:** As a user, I want the environment status lines to be visually clear and readable, so that I can quickly identify healthy and unhealthy checks.

#### Acceptance Criteria

1. THE preview CSS SHALL define a `.ms-env-status` container style for the status lines section
2. THE preview CSS SHALL define a `.ms-env-line` base style for individual status line elements
3. THE preview CSS SHALL define `.ms-env-ok` and `.ms-env-fail` color variant styles that visually distinguish successful checks from failed checks
4. THE preview CSS SHALL support both light and dark VS Code themes for the status line styles

### Requirement 6: Preserve Loading Overlay Behavior for Incremental Re-renders

**User Story:** As a user, I want the loading overlay during incremental re-renders to continue working correctly after the timer removal, so that I still see visual feedback when the preview updates.

#### Acceptance Criteria

1. WHEN a re-render starts, THE Preview_Script SHALL display the Loading_Overlay with the spinner visible
2. WHEN a re-render completes or errors, THE Preview_Script SHALL hide the Loading_Overlay
3. THE Preview_Script showLoadingOverlay function SHALL create the overlay with a spinner div and no timer div
4. THE Preview_Script hideLoadingOverlay function SHALL hide the overlay without attempting to clear any timer intervals

### Requirement 7: Status Line Count Consistency

**User Story:** As a developer, I want the number of rendered status divs to exactly match the number of input status lines, so that no information is lost or duplicated.

#### Acceptance Criteria

1. WHEN the Loading_HTML_Builder receives N Status_Lines, THE Loading_HTML_Builder SHALL produce HTML containing exactly N elements with class `ms-env-line`
