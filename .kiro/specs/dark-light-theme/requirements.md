# Requirements Document

## Introduction

Markdown Studio's preview webview currently renders all diagrams and SVG elements with hardcoded light-mode colors, making them unreadable when VS Code uses a dark theme. This feature adds automatic theme detection so that Mermaid diagrams switch between dark and light themes, inline SVG and PlantUML output receive CSS-based color overrides for dark mode, and the preview adapts dynamically when the user changes their VS Code theme. The implementation relies on the `data-vscode-theme-kind` body dataset attribute for JS-driven logic and VS Code body classes (`vscode-dark`, `vscode-light`, `vscode-high-contrast`) for CSS overrides.

## Glossary

- **Theme_Detector**: The JavaScript module in `preview.js` responsible for reading the current VS Code theme kind from the webview body dataset and notifying other components of theme changes.
- **Mermaid_Renderer**: The client-side component in `preview.js` that initializes and renders Mermaid diagrams within `.mermaid-host` elements.
- **CSS_Theme_Layer**: The set of CSS custom properties and selectors in `preview.css` that provide theme-aware colors for SVG, PlantUML, and general preview elements.
- **Theme_Observer**: The MutationObserver instance that watches for changes to the `data-vscode-theme-kind` attribute on the webview body element.
- **VSCodeThemeKind**: One of the four recognized theme kind strings: `vscode-dark`, `vscode-light`, `vscode-high-contrast`, `vscode-high-contrast-light`.
- **MermaidThemeName**: Either `'dark'` or `'default'`, representing the Mermaid library's built-in theme options.
- **Preview_Webview**: The VS Code webview panel that displays the rendered Markdown preview.

## Requirements

### Requirement 1: Theme Detection on Page Load

**User Story:** As a user, I want the preview to detect my current VS Code theme when it opens, so that diagrams and content render with appropriate colors from the start.

#### Acceptance Criteria

1. WHEN the Preview_Webview loads, THE Theme_Detector SHALL read the `data-vscode-theme-kind` attribute from `document.body.dataset` and return a valid VSCodeThemeKind value.
2. WHEN the `data-vscode-theme-kind` attribute is missing or contains an unrecognized value, THE Theme_Detector SHALL default to `vscode-light`.
3. WHEN the Theme_Detector returns a VSCodeThemeKind, THE Mermaid_Renderer SHALL initialize Mermaid with the corresponding MermaidThemeName before rendering any diagrams.

### Requirement 2: Theme-to-Mermaid Mapping

**User Story:** As a user, I want Mermaid diagrams to use the correct dark or light theme, so that diagram text and backgrounds are readable in any VS Code color scheme.

#### Acceptance Criteria

1. WHEN the VSCodeThemeKind is `vscode-dark` or `vscode-high-contrast`, THE Theme_Detector SHALL map it to MermaidThemeName `'dark'`.
2. WHEN the VSCodeThemeKind is `vscode-light` or `vscode-high-contrast-light`, THE Theme_Detector SHALL map it to MermaidThemeName `'default'`.
3. THE Theme_Detector SHALL return a valid MermaidThemeName for every recognized VSCodeThemeKind without returning undefined or null.

### Requirement 3: Dynamic Theme Switching

**User Story:** As a user, I want the preview to update automatically when I change my VS Code theme, so that I do not need to reload the preview to see correct colors.

#### Acceptance Criteria

1. WHEN the Preview_Webview loads, THE Theme_Observer SHALL begin observing the `data-vscode-theme-kind` attribute on `document.body` for changes.
2. WHEN the `data-vscode-theme-kind` attribute changes, THE Theme_Observer SHALL invoke the theme change callback exactly once per change.
3. WHEN the theme change callback fires, THE Mermaid_Renderer SHALL re-initialize Mermaid with the new MermaidThemeName and re-render all `.mermaid-host` elements.
4. THE Theme_Observer SHALL observe only the `data-vscode-theme-kind` attribute and ignore changes to other body attributes.

### Requirement 4: CSS Dark Mode Overrides for SVG and PlantUML

**User Story:** As a user, I want inline SVG and PlantUML diagrams to be visible in dark mode, so that diagram elements do not disappear against a dark background.

#### Acceptance Criteria

1. THE CSS_Theme_Layer SHALL define CSS custom properties for diagram text color, background color, and stroke color with light-mode default values on `:root`.
2. WHEN the Preview_Webview body has class `vscode-dark` or `vscode-high-contrast`, THE CSS_Theme_Layer SHALL override the diagram CSS custom properties with dark-mode values that provide sufficient contrast.
3. WHEN the Preview_Webview body has class `vscode-dark` or `vscode-high-contrast`, THE CSS_Theme_Layer SHALL apply `fill` overrides to SVG `text` elements within `svg[xmlns]` containers using the dark-mode text color variable.
4. WHEN the Preview_Webview body has class `vscode-dark` or `vscode-high-contrast`, THE CSS_Theme_Layer SHALL apply `fill` and `stroke` overrides to SVG shape elements (`rect`, `circle`, `ellipse`, `polygon`) that do not have an explicit `fill` attribute.
5. THE CSS_Theme_Layer SHALL ensure that `.ms-error` blocks remain readable in both light and dark themes.

### Requirement 5: Mermaid Block Rendering with Theme

**User Story:** As a user, I want every Mermaid diagram in my document to render with the correct theme, so that all diagrams are consistently styled.

#### Acceptance Criteria

1. WHEN Mermaid is initialized with a MermaidThemeName and `renderMermaidBlocks()` is called, THE Mermaid_Renderer SHALL render all `.mermaid-host[data-mermaid-src]` elements using the initialized theme.
2. WHEN a Mermaid block renders successfully, THE Mermaid_Renderer SHALL replace the element innerHTML with the rendered SVG.
3. IF a Mermaid block fails to render, THEN THE Mermaid_Renderer SHALL replace the element innerHTML with an error div containing the error message, without affecting other blocks.
4. WHEN a theme change triggers re-rendering, THE Mermaid_Renderer SHALL re-render all Mermaid blocks with the new theme, producing valid SVG for all previously valid diagram sources.

### Requirement 6: No CSP Changes Required

**User Story:** As a developer, I want the theme support to work within the existing Content Security Policy, so that no security relaxations are needed.

#### Acceptance Criteria

1. THE Preview_Webview SHALL continue using the existing CSP that allows `'unsafe-inline'` for styles and nonce-gated scripts.
2. THE CSS_Theme_Layer SHALL use only CSS selectors and custom properties, without requiring additional CSP directives.
3. THE Theme_Observer SHALL use only the MutationObserver API, without requiring additional CSP directives.

### Requirement 7: Demo File Theme Showcase

**User Story:** As a user evaluating the extension, I want the demo file to demonstrate theme adaptability, so that I can verify dark/light mode support works correctly.

#### Acceptance Criteria

1. THE demo file SHALL include a section that describes theme adaptability and instructs the user to switch between light and dark mode.
2. THE demo file SHALL include a Mermaid diagram that visually demonstrates theme-aware rendering.
3. THE demo file SHALL include an SVG example that uses colors chosen for visibility in both light and dark themes.
