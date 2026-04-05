# Bugfix Requirements Document

## Introduction

The Markdown Studio VS Code extension's webview preview and PDF export have regressed: Mermaid diagrams, PlantUML diagrams, and inline SVG blocks no longer render. Instead, their source code is displayed as plain text. The backend rendering pipeline (scan → replace → markdown-it → sanitize-html) is confirmed working via CLI unit tests. The regression was introduced by uncommitted changes from a separate chat session that modified `media/preview.js`, `src/preview/buildHtml.ts`, `src/preview/webviewPanel.ts`, and several other files.

The root cause is in the webview-side script (`media/preview.js`): `mermaid.initialize()` is called at module top-level. Mermaid 11.x internally uses `new Function()` (172 occurrences), which requires `'unsafe-eval'` in the CSP `script-src` directive. While `buildHtml.ts` does include `'unsafe-eval'` in the CSP, if `mermaid.initialize()` throws for any reason (CSP violation, DOM not ready, bundling issue), the entire IIFE bundle aborts silently — meaning `renderMermaidBlocks()`, the `DOMContentLoaded` listener, the `update-body` message handler, and the theme observer all fail to register. This causes all diagram types (not just Mermaid) to appear as plain text, since the webview script is responsible for post-processing the HTML placeholders.

Additionally, the incremental update path (`update-body` message → `document.body.innerHTML` replacement) re-injects server-rendered PlantUML SVG and inline SVG content, but if the webview script never initialized, no post-processing occurs and Mermaid placeholders remain unrendered.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a Markdown document contains a `mermaid` fenced code block THEN the system displays the raw Mermaid source code (e.g., `flowchart TD`, `sequenceDiagram`) as plain text in the webview preview instead of rendering it as a diagram

1.2 WHEN a Markdown document contains a `plantuml` or `puml` fenced code block THEN the system displays the raw PlantUML source code (e.g., `@startuml ... @enduml`) as plain text in the webview preview instead of rendering the server-generated SVG

1.3 WHEN a Markdown document contains an `svg` fenced code block THEN the system displays the raw SVG markup as plain text in the webview preview instead of rendering the graphic

1.4 WHEN a Markdown document containing diagrams is exported to PDF THEN the exported PDF contains plain-text source code instead of rendered diagrams

1.5 WHEN `mermaid.initialize()` throws at module top-level in the bundled webview script THEN the entire IIFE aborts silently, preventing all event listeners (`DOMContentLoaded`, `message`, `dblclick`, theme observer) from being registered

1.6 WHEN the webview receives an `update-body` message for incremental preview updates THEN Mermaid placeholder divs in the updated HTML body are not processed because `renderMermaidBlocks()` was never successfully defined/reachable due to the top-level initialization failure

### Expected Behavior (Correct)

2.1 WHEN a Markdown document contains a `mermaid` fenced code block THEN the system SHALL render the Mermaid source as an SVG diagram in the webview preview

2.2 WHEN a Markdown document contains a `plantuml` or `puml` fenced code block THEN the system SHALL render the PlantUML-generated SVG as a graphic in the webview preview

2.3 WHEN a Markdown document contains an `svg` fenced code block THEN the system SHALL render the SVG markup as a graphic in the webview preview

2.4 WHEN a Markdown document containing diagrams is exported to PDF THEN the exported PDF SHALL contain rendered diagrams matching the webview preview

2.5 WHEN `mermaid.initialize()` fails THEN the system SHALL catch the error gracefully and still register all event listeners (`DOMContentLoaded`, `message`, `dblclick`, theme observer), degrading only Mermaid rendering while preserving other functionality

2.6 WHEN the webview receives an `update-body` message THEN the system SHALL process all Mermaid placeholder divs in the updated HTML body by calling `renderMermaidBlocks()` successfully

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a Markdown document contains only standard Markdown (headings, paragraphs, lists, links, images) without any diagram blocks THEN the system SHALL CONTINUE TO render the preview correctly

3.2 WHEN the CSP `script-src` directive includes `'unsafe-eval'` THEN the system SHALL CONTINUE TO allow Mermaid's internal `new Function()` calls to execute

3.3 WHEN the user changes the VS Code color theme THEN the system SHALL CONTINUE TO detect the theme change and re-render Mermaid diagrams with the appropriate theme (`dark`/`default`)

3.4 WHEN the user double-clicks in the preview with `sourceJump` enabled THEN the system SHALL CONTINUE TO post a `jumpToLine` message to the extension host

3.5 WHEN the backend pipeline processes `mermaid` fenced blocks THEN the system SHALL CONTINUE TO produce `<div class="mermaid-host" data-mermaid-src="..."></div>` placeholder HTML that survives sanitization

3.6 WHEN the backend pipeline processes `plantuml`/`puml` fenced blocks THEN the system SHALL CONTINUE TO produce server-rendered SVG output that survives sanitization

3.7 WHEN the backend pipeline processes `svg` fenced blocks THEN the system SHALL CONTINUE TO pass through sanitized SVG markup

3.8 WHEN the `buildHtml` function generates the full HTML document THEN the system SHALL CONTINUE TO include a valid CSP header with `'unsafe-eval'` in `script-src`, a random nonce, and the webview script tag
