# Implementation Plan: Dark/Light Theme Support

## Overview

Add automatic theme detection to the preview webview so Mermaid diagrams switch between dark and light themes, inline SVG and PlantUML output receive CSS-based color overrides for dark mode, and the preview adapts dynamically when the user changes their VS Code theme. Changes touch `media/preview.js` (theme detector, Mermaid re-init, MutationObserver), `media/preview.css` (CSS custom properties and dark-mode selectors), and `examples/demo.md` (theme showcase section).

## Tasks

- [x] 1. Implement theme detection and Mermaid theme mapping in preview.js
  - [x] 1.1 Add THEME_MAP, detectThemeKind(), and getMermaidTheme() to `media/preview.js`
    - Define `THEME_MAP` constant mapping VSCodeThemeKind strings to MermaidThemeName
    - Implement `detectThemeKind()` that reads `document.body.dataset.vscodeThemeKind` and returns a valid VSCodeThemeKind, defaulting to `'vscode-light'` for missing/unrecognized values
    - Implement `getMermaidTheme(themeKind)` that returns `'dark'` or `'default'` via THEME_MAP lookup
    - _Requirements: 1.1, 1.2, 2.1, 2.2, 2.3_

  - [x] 1.2 Update Mermaid initialization to use detected theme
    - Replace the hardcoded `theme: 'default'` in `mermaid.initialize()` with `theme: getMermaidTheme(detectThemeKind())`
    - Ensure Mermaid is initialized with the correct theme before `renderMermaidBlocks()` is called
    - _Requirements: 1.3, 5.1_

  - [x] 1.3 Write property tests for theme detection and mapping
    - [x] 1.3.1 Property test for Property 1: detectThemeKind always returns a valid VSCodeThemeKind
      - **Property 1: Theme detection always returns a valid theme kind with correct fallback**
      - For any string value (including undefined and empty string) as `data-vscode-theme-kind`, `detectThemeKind()` returns a valid VSCodeThemeKind; for unrecognized values, returns `'vscode-light'`
      - **Validates: Requirements 1.1, 1.2**
    - [x] 1.3.2 Property test for Property 2: getMermaidTheme mapping is total and correct
      - **Property 2: Theme-to-Mermaid mapping is total and correct**
      - For any recognized VSCodeThemeKind, `getMermaidTheme()` returns `'dark'` for dark-family themes and `'default'` for light-family themes, never returning undefined or null
      - **Validates: Requirements 2.1, 2.2, 2.3**

- [x] 2. Implement dynamic theme switching via MutationObserver
  - [x] 2.1 Add `observeThemeChanges()` to `media/preview.js`
    - Create a MutationObserver that watches `document.body` for changes to the `data-vscode-theme-kind` attribute only (using `attributeFilter`)
    - On change, invoke callback with the result of `detectThemeKind()`
    - _Requirements: 3.1, 3.2, 3.4_

  - [x] 2.2 Wire theme observer into DOMContentLoaded handler
    - Update the `DOMContentLoaded` event listener to call `observeThemeChanges()` after initial render
    - The callback should re-initialize Mermaid with the new theme and re-render all `.mermaid-host` blocks
    - _Requirements: 3.3, 5.4_

  - [x] 2.3 Write unit tests for theme observer and re-render flow
    - Test that `observeThemeChanges` only fires for `data-vscode-theme-kind` attribute changes
    - Test that the callback triggers Mermaid re-initialization and re-render
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Add CSS dark mode overrides for SVG and PlantUML in preview.css
  - [x] 4.1 Define CSS custom properties for diagram colors on `:root`
    - Add `--diagram-text`, `--diagram-bg`, `--diagram-stroke` with light-mode default values
    - _Requirements: 4.1_

  - [x] 4.2 Add dark-mode overrides under `body.vscode-dark` and `body.vscode-high-contrast` selectors
    - Override `--diagram-text`, `--diagram-bg`, `--diagram-stroke` with dark-mode values providing sufficient contrast
    - _Requirements: 4.2_

  - [x] 4.3 Add SVG element overrides for dark mode
    - Apply `fill` override to `svg[xmlns] text` elements using `--diagram-text`
    - Apply `fill` and `stroke` overrides to `svg rect:not([fill])`, `circle:not([fill])`, `ellipse:not([fill])`, `polygon:not([fill])` using `--diagram-bg` and `--diagram-stroke`
    - _Requirements: 4.3, 4.4_

  - [x] 4.4 Ensure `.ms-error` blocks remain readable in both themes
    - Verify or adjust error block styling so it works in both light and dark modes
    - _Requirements: 4.5_

- [x] 5. Verify no CSP changes are needed
  - [x] 5.1 Confirm buildHtml.ts CSP remains unchanged
    - Verify that `buildHtml.ts` does not need any CSP modifications — CSS custom properties and MutationObserver work within existing policy
    - _Requirements: 6.1, 6.2, 6.3_

- [x] 6. Update demo file with theme showcase
  - [x] 6.1 Add theme adaptability section to `examples/demo.md`
    - Add a section describing theme adaptability with instructions to switch between light and dark mode
    - Include a Mermaid diagram that demonstrates theme-aware rendering
    - Include an SVG example using colors chosen for visibility in both themes
    - _Requirements: 7.1, 7.2, 7.3_

- [x] 7. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- All implementation is in TypeScript/JavaScript — `media/preview.js` and `media/preview.css` are the primary files modified
- No new dependencies are required; Mermaid already supports `theme: 'dark'`
