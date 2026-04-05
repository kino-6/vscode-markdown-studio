# Preview Rendering Fix — Bugfix Design

## Overview

The Markdown Studio webview preview fails to render Mermaid diagrams, PlantUML SVGs, and inline SVGs. The backend pipeline (scanFencedBlocks → placeholder replacement → markdown-it → sanitize-html) is confirmed working via CLI tests. The root cause is in `media/preview.js`: `mermaid.initialize()` is called at module top-level outside any try-catch. When it throws (due to CSP restrictions, DOM readiness, or bundling issues), the entire IIFE bundle aborts — preventing all event listeners and rendering functions from registering. The fix wraps the top-level `mermaid.initialize()` in a try-catch and ensures the CSP in `buildHtml.ts` includes `'unsafe-eval'` (already present, but must be verified stable). Automated testing uses Node.js-based unit and integration tests against the rendering pipeline and extracted webview logic — no manual VSIX install required.

## Glossary

- **Bug_Condition (C)**: The webview IIFE bundle aborts because `mermaid.initialize()` throws at module top-level, preventing all downstream code from executing
- **Property (P)**: All diagram types (Mermaid, PlantUML SVG, inline SVG) render correctly in the webview preview, and all event listeners (DOMContentLoaded, message, dblclick, theme observer) register successfully
- **Preservation**: Standard Markdown rendering, CSP policy, theme detection, source-jump, incremental updates, and PDF export must remain unchanged
- **`media/preview.js`**: The webview-side script bundled by esbuild as IIFE into `dist/preview.js`; responsible for client-side Mermaid rendering, theme observation, message handling, and source-jump
- **`buildHtml.ts`**: Generates the full HTML document for the webview including CSP meta tag, nonce, and script tag
- **`renderMarkdownDocument`**: The backend pipeline function in `src/renderers/renderMarkdown.ts` that scans fenced blocks, replaces them with placeholders/SVG, runs markdown-it, and sanitizes the output
- **Mermaid placeholder**: `<div class="mermaid-host" data-mermaid-src="..."></div>` — produced server-side, rendered client-side by `renderMermaidBlocks()` in preview.js
- **IIFE bundle**: The esbuild output (`dist/preview.js`) using `format: 'iife'` and `platform: 'browser'` — a single self-executing function where any top-level throw aborts everything

## Bug Details

### Bug Condition

The bug manifests when the webview loads `dist/preview.js`. The `mermaid.initialize()` call at line 37 of `media/preview.js` executes at module top-level (before any event listeners are registered). Mermaid 11.x internally uses `new Function()` (172 occurrences in the bundle), which requires `'unsafe-eval'` in the CSP `script-src` directive. If `mermaid.initialize()` throws for any reason — CSP violation, DOM not ready, or internal Mermaid error — the IIFE aborts and none of the subsequent code executes: `renderMermaidBlocks()`, the `DOMContentLoaded` listener, the `message` listener for `update-body`, the `dblclick` handler, and the theme observer all fail to register.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type WebviewLoadEvent
  OUTPUT: boolean

  LET scriptLoaded = webview loads dist/preview.js
  LET mermaidInitThrows = mermaid.initialize() throws an exception at top-level
  LET listenersRegistered = DOMContentLoaded, message, dblclick handlers are registered

  RETURN scriptLoaded
         AND mermaidInitThrows
         AND NOT listenersRegistered
END FUNCTION
```

### Examples

- **Mermaid diagram as plain text**: A document with ` ```mermaid\nflowchart TD\n    A-->B\n``` ` shows the raw text "flowchart TD A-->B" instead of an SVG diagram, because `renderMermaidBlocks()` never ran
- **PlantUML SVG not displayed**: A document with ` ```plantuml\n@startuml\nA->B:Hi\n@enduml\n``` ` shows raw SVG markup as text. The backend correctly produced `<svg>...</svg>`, but the webview script abort means no post-processing or DOM manipulation occurred
- **Inline SVG not rendered**: A document with ` ```svg\n<svg><rect width="100" height="100"/></svg>\n``` ` shows raw SVG tags as text
- **Incremental update broken**: After editing the document, the `update-body` message is posted by the extension host, but the webview's `message` event listener was never registered, so the preview doesn't update
- **Theme change ignored**: Switching VS Code theme doesn't re-render Mermaid diagrams because the `MutationObserver` was never set up

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Standard Markdown (headings, paragraphs, lists, code blocks, links, images) must continue to render correctly in the preview
- The CSP meta tag in `buildHtml.ts` must continue to include `'unsafe-eval'` in `script-src` for Mermaid's `new Function()` calls
- Theme detection via `data-vscode-theme-kind` attribute and `MutationObserver` must continue to work
- Double-click source-jump (`dblclick` → `findSourceLine` → `postMessage({ type: 'jumpToLine' })`) must continue to work
- The `update-body` incremental update path must continue to work: extension host posts message, webview replaces `document.body.innerHTML` and re-renders Mermaid blocks
- PlantUML server-side rendering (Java JAR → SVG) must continue to produce SVG that survives sanitization
- Inline SVG sanitization via `sanitizeSvg()` must continue to strip dangerous tags while preserving visual attributes
- PDF export must continue to produce rendered diagrams matching the preview
- The `data-source-line` attribute injection by `parseMarkdown.ts` must continue to survive sanitization

**Scope:**
All inputs that do NOT involve the webview script initialization path should be completely unaffected by this fix. This includes:
- The backend rendering pipeline (scanFencedBlocks, renderMermaidBlock, renderPlantUml, sanitizeSvg, markdown-it, sanitize-html)
- The esbuild configuration and bundle output structure
- The extension host commands (openPreview, exportPdf, validateEnvironment)
- Non-Mermaid diagram rendering (PlantUML, inline SVG) at the backend level

## Hypothesized Root Cause

Based on the bug description and code analysis, the most likely issues are:

1. **Top-level `mermaid.initialize()` without error handling**: In `media/preview.js` line 37, `mermaid.initialize()` is called at module scope with no try-catch. Since esbuild bundles this as an IIFE, any exception here aborts the entire bundle. Mermaid 11.x's internal use of `new Function()` can throw if CSP blocks `'unsafe-eval'`, or if the DOM isn't ready when Mermaid tries to access `document` during initialization.

2. **CSP timing or configuration drift**: While `buildHtml.ts` currently includes `'unsafe-eval'` in `script-src`, any accidental removal or reordering during the separate chat's changes could cause Mermaid's `new Function()` calls to be blocked. The CSP is generated dynamically with a nonce, so the exact string must be verified.

3. **IIFE bundle execution order**: The esbuild IIFE format means all top-level statements execute synchronously before any event listeners can be registered. The `mermaid.initialize()` call precedes `renderMermaidBlocks`, `addEventListener('DOMContentLoaded')`, `addEventListener('message')`, and `addEventListener('dblclick')`. A throw at the initialize call prevents all of these from being defined.

4. **Mermaid internal DOM dependency**: `mermaid.initialize()` may attempt to access DOM elements or `window` properties that aren't available at script parse time (before `DOMContentLoaded`). While the script tag is at the bottom of `<body>`, Mermaid's internal code may still have timing assumptions.

## Correctness Properties

Property 1: Bug Condition — Resilient Webview Initialization

_For any_ webview load where `mermaid.initialize()` throws an exception (CSP violation, DOM error, internal Mermaid error), the fixed `media/preview.js` SHALL catch the error gracefully and still register all event listeners (`DOMContentLoaded`, `message`, `dblclick`), degrading only Mermaid rendering while preserving PlantUML SVG display, inline SVG display, incremental updates, theme observation, and source-jump functionality.

**Validates: Requirements 2.5, 2.6**

Property 2: Preservation — Backend Pipeline Output Unchanged

_For any_ Markdown input containing Mermaid, PlantUML, inline SVG, or standard Markdown content, the fixed code SHALL produce the same backend pipeline output (HTML body from `renderMarkdownDocument`) as the original code, preserving all placeholder generation, SVG pass-through, sanitization behavior, `data-source-line` injection, and CSP configuration.

**Validates: Requirements 3.1, 3.2, 3.5, 3.6, 3.7, 3.8**

Property 3: Bug Fix — Mermaid Placeholders Rendered After Initialization

_For any_ Markdown document containing Mermaid fenced blocks, when the webview loads successfully with a valid CSP (including `'unsafe-eval'`), the fixed `renderMermaidBlocks()` function SHALL process all `<div class="mermaid-host" data-mermaid-src="...">` placeholders and replace their innerHTML with rendered SVG output.

**Validates: Requirements 2.1, 2.2, 2.3**

Property 4: Preservation — Incremental Update Re-renders Mermaid

_For any_ `update-body` message received by the webview after the initial load, the fixed message handler SHALL replace `document.body.innerHTML` with the new HTML and then call `renderMermaidBlocks()` to process any Mermaid placeholders in the updated content.

**Validates: Requirements 2.6, 3.4**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `media/preview.js`

**Function**: Top-level IIFE initialization

**Specific Changes**:

1. **Wrap `mermaid.initialize()` in try-catch**: Move the top-level `mermaid.initialize()` call (line 37) inside a try-catch block so that if it throws, the error is logged to console but execution continues. All subsequent code (function definitions, event listeners) will still register.

   ```javascript
   try {
     mermaid.initialize({
       startOnLoad: false,
       securityLevel: 'strict',
       theme: getMermaidTheme(detectThemeKind()),
     });
   } catch (err) {
     console.error('[Markdown Studio] mermaid.initialize() failed:', err);
   }
   ```

2. **Guard `renderMermaidBlocks()` against uninitialized Mermaid**: Add a try-catch inside `renderMermaidBlocks()` around the `mermaid.parse()` and `mermaid.render()` calls (already present per-block, but ensure the outer function doesn't throw if Mermaid is completely broken).

3. **Guard theme-change re-initialization**: Wrap the `mermaid.initialize()` call inside the `observeThemeChanges` callback in a try-catch as well, so a theme change doesn't crash the observer.

4. **Verify CSP includes `'unsafe-eval'`**: Confirm that `buildHtml.ts` line 30 includes `'unsafe-eval'` in the `script-src` directive. This is already present in the current code but must be verified as stable.

5. **Ensure `renderMermaidBlocks()` is called after `update-body`**: The current `message` event handler already calls `renderMermaidBlocks()` after setting `document.body.innerHTML`. This path will now work because the event listener registration is no longer blocked by the top-level throw.

**File**: `src/preview/buildHtml.ts`

**Function**: `buildHtml()`

**Specific Changes**:

6. **No code changes needed**: The CSP already includes `'unsafe-eval'`. Add a code comment documenting why `'unsafe-eval'` is required (Mermaid 11.x uses 172 `new Function()` calls internally).

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior. All tests are CLI-based (vitest) — no manual VSIX installation or webview preview required.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write tests that simulate the webview script's initialization behavior by importing the exported functions from `media/preview.js` and verifying that a throwing `mermaid.initialize()` prevents downstream function registration. Run these tests on the UNFIXED code to observe failures.

**Test Cases**:
1. **Top-level throw aborts IIFE**: Mock `mermaid.initialize()` to throw, verify that `renderMermaidBlocks` and event listeners are not reachable (will fail on unfixed code — the IIFE aborts)
2. **CSP blocks unsafe-eval**: Simulate a CSP violation during `mermaid.initialize()`, verify the entire script fails (will fail on unfixed code)
3. **Mermaid placeholders remain unprocessed**: After a failed initialization, verify that `<div class="mermaid-host">` elements retain their `data-mermaid-src` attribute and have no SVG child (will fail on unfixed code)
4. **Message handler not registered**: After a failed initialization, verify that posting an `update-body` message has no effect (will fail on unfixed code)

**Expected Counterexamples**:
- When `mermaid.initialize()` throws, no event listeners are registered
- Mermaid placeholder divs remain as raw HTML with `data-mermaid-src` attributes
- Possible causes: no try-catch around top-level `mermaid.initialize()`, IIFE execution model

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds (mermaid.initialize throws), the fixed function still registers event listeners and degrades gracefully.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := loadPreviewScript_fixed(input)
  ASSERT eventListenersRegistered(result)
  ASSERT mermaidRenderingDegraded(result)  // Mermaid shows error, but other diagrams work
  ASSERT incrementalUpdateWorks(result)
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold (mermaid.initialize succeeds), the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT renderMarkdownDocument_original(input) = renderMarkdownDocument_fixed(input)
  ASSERT buildHtml_original(input) = buildHtml_fixed(input)  // CSP unchanged
  ASSERT mermaidPlaceholders_original(input) = mermaidPlaceholders_fixed(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many Markdown inputs automatically across the input domain (varying combinations of Mermaid, PlantUML, SVG, and standard Markdown)
- It catches edge cases in sanitization and placeholder generation that manual tests might miss
- It provides strong guarantees that the backend pipeline output is unchanged

**Test Plan**: Observe behavior on UNFIXED code first for the backend pipeline (which is already working), then write property-based tests capturing that behavior to ensure the fix doesn't regress it.

**Test Cases**:
1. **Backend pipeline preservation**: For any Markdown input, verify `renderMarkdownDocument` produces identical output before and after the fix (backend is untouched, but this guards against accidental changes)
2. **CSP preservation**: For any `buildHtml` call, verify the CSP meta tag still contains `'unsafe-eval'` in `script-src`
3. **PlantUML SVG pass-through**: For any PlantUML SVG output, verify it survives sanitization unchanged
4. **Inline SVG pass-through**: For any inline SVG block, verify `sanitizeSvg()` produces the same output

### Unit Tests

- Test that wrapping `mermaid.initialize()` in try-catch allows subsequent code to execute when initialize throws
- Test that `renderMermaidBlocks()` handles individual block failures without aborting the loop
- Test that the `update-body` message handler calls `renderMermaidBlocks()` after replacing innerHTML
- Test that `buildHtml()` CSP includes `'unsafe-eval'` in `script-src`
- Test that `findSourceLine()` continues to work after the fix
- Test that theme change callback re-initializes Mermaid with try-catch

### Property-Based Tests

- Generate random Markdown documents with varying combinations of Mermaid, PlantUML, SVG, and standard content; verify `renderMarkdownDocument` output contains correct placeholders and SVG
- Generate random Mermaid source strings; verify `renderMermaidPlaceholder` produces valid `data-mermaid-src` attributes that round-trip through encode/decode
- Generate random HTML bodies; verify `buildHtml` CSP always includes required directives (`'unsafe-eval'`, nonce, cspSource)

### Integration Tests

- Test the full pipeline from Markdown input through `renderMarkdownDocument` to `buildHtml`, verifying the output HTML contains Mermaid placeholders, PlantUML SVG, and inline SVG in the correct positions
- Test the incremental update flow: `renderBody` produces body-only HTML, verify it contains Mermaid placeholders that would be processed by the webview's `renderMermaidBlocks()`
- Test that the webview script's exported functions (`detectThemeKind`, `getMermaidTheme`, `findSourceLine`) work correctly in isolation (imported directly, not via IIFE)
