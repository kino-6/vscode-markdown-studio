# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** — Unguarded mermaid.initialize() Aborts IIFE
  - **CRITICAL**: This test MUST FAIL on unfixed code — failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior — it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: Scope the property to the concrete failing case: `mermaid.initialize()` throws at top-level, preventing all downstream code from executing
  - Create test file `test/unit/previewInitResilience.property.test.ts`
  - Use fast-check to generate arbitrary error types (TypeError, EvalError, generic Error with random messages) thrown by `mermaid.initialize()`
  - Mock `mermaid` module so `mermaid.initialize()` throws the generated error
  - Import the webview script's exported functions (`detectThemeKind`, `getMermaidTheme`, `findSourceLine`, `observeThemeChanges`) and verify they are still reachable/defined after the throw
  - Since the current code calls `mermaid.initialize()` at module top-level without try-catch, the IIFE aborts and exports are undefined — test will FAIL
  - The test assertions should match Expected Behavior from design: all event listeners register, only Mermaid rendering degrades
  - Property: _for any_ error thrown by `mermaid.initialize()`, the fixed script SHALL still export all helper functions and register all event listeners
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct — it proves the bug exists because the IIFE aborts on unguarded throw)
  - Document counterexamples found (e.g., "TypeError thrown by mermaid.initialize() causes all exports to be undefined")
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.5, 2.5_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** — Backend Pipeline Output Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - **IMPORTANT**: Write and run these tests BEFORE implementing the fix
  - Observe on UNFIXED code: `renderMarkdownDocument` with Mermaid input produces `<div class="mermaid-host" data-mermaid-src="...">` placeholders
  - Observe on UNFIXED code: `renderMarkdownDocument` with standard Markdown produces correct HTML with `data-source-line` attributes
  - Observe on UNFIXED code: `buildHtml` CSP includes `'unsafe-eval'` in `script-src`
  - Observe on UNFIXED code: `renderMermaidPlaceholder` round-trips through encode/decode
  - Create test file `test/unit/previewPreservation.property.test.ts`
  - Use fast-check to generate random Markdown documents with varying combinations of Mermaid fenced blocks, standard Markdown (headings, paragraphs, lists), and mixed content
  - Property 2a: _for any_ Markdown input containing `mermaid` fenced blocks, `renderMarkdownDocument` output contains one `mermaid-host` div with `data-mermaid-src` per block, and no raw ` ```mermaid ` source in the HTML
  - Property 2b: _for any_ Mermaid source string, `renderMermaidPlaceholder` produces a `data-mermaid-src` attribute whose `decodeURIComponent` equals the original source
  - Property 2c: _for any_ `buildHtml` call, the CSP meta tag contains `'unsafe-eval'` in the `script-src` directive
  - Property 2d: _for any_ standard Markdown input (no diagram blocks), `renderMarkdownDocument` produces non-empty HTML without error
  - Mock `vscode` and `renderPlantUml` following existing test conventions (see `test/unit/mermaidPipeline.test.ts`)
  - Verify all tests PASS on UNFIXED code (backend pipeline is already working correctly)
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.5, 3.7, 3.8_

- [x] 3. Fix for unguarded mermaid.initialize() aborting webview IIFE

  - [x] 3.1 Wrap top-level `mermaid.initialize()` in try-catch in `media/preview.js`
    - Replace the bare `mermaid.initialize({...})` call (line ~37) with a try-catch block
    - On catch: log `[Markdown Studio] mermaid.initialize() failed:` + error to console.error
    - Track initialization state with a `let mermaidReady = true` flag, set to `false` in catch
    - All subsequent code (function definitions, event listeners) MUST remain outside the try-catch so they always execute
    - _Bug_Condition: isBugCondition(input) where mermaid.initialize() throws at top-level, aborting the IIFE_
    - _Expected_Behavior: catch error, log it, set mermaidReady=false, continue executing rest of script_
    - _Preservation: All non-Mermaid functionality (PlantUML SVG display, inline SVG, theme observer, source-jump, incremental updates) must continue to work_
    - _Requirements: 1.5, 2.5_

  - [x] 3.2 Guard `renderMermaidBlocks()` against uninitialized Mermaid in `media/preview.js`
    - At the top of `renderMermaidBlocks()`, check `mermaidReady` flag; if false, log warning and return early (skip Mermaid rendering but don't throw)
    - The existing per-block try-catch inside the for loop already handles individual render failures — keep it
    - This ensures that if `mermaid.initialize()` failed, calling `renderMermaidBlocks()` from the message handler or DOMContentLoaded doesn't throw
    - _Bug_Condition: renderMermaidBlocks() called when mermaid.initialize() previously failed_
    - _Expected_Behavior: graceful no-op with console warning, no throw_
    - _Preservation: When mermaidReady=true, behavior is identical to original code_
    - _Requirements: 2.5, 2.6_

  - [x] 3.3 Guard theme-change re-initialization with try-catch in `media/preview.js`
    - Inside the `observeThemeChanges` callback (in the `DOMContentLoaded` listener), wrap the `mermaid.initialize()` call in try-catch
    - On catch: log `[Markdown Studio] Mermaid re-init on theme change failed:` + error, set `mermaidReady = false`
    - On success: set `mermaidReady = true` (re-initialization succeeded, Mermaid is usable again)
    - _Bug_Condition: theme change triggers mermaid.initialize() which throws_
    - _Expected_Behavior: catch error, log it, theme observer continues running_
    - _Preservation: Theme detection and observer registration unchanged_
    - _Requirements: 2.5, 3.3_

  - [x] 3.4 Verify CSP includes `'unsafe-eval'` in `src/preview/buildHtml.ts`
    - Confirm the CSP meta tag in `buildHtml()` contains `'unsafe-eval'` in the `script-src` directive (already present at line ~30)
    - Add a code comment explaining why `'unsafe-eval'` is required: `// Mermaid 11.x uses new Function() internally (172 occurrences) — requires 'unsafe-eval'`
    - No functional code change needed — this is a verification + documentation step
    - _Preservation: CSP policy unchanged_
    - _Requirements: 3.2, 3.8_

  - [x] 3.5 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** — Resilient Webview Initialization
    - **IMPORTANT**: Re-run the SAME test from task 1 — do NOT write a new test
    - The test from task 1 encodes the expected behavior: when `mermaid.initialize()` throws, all exports are still defined and event listeners can register
    - Run `npx vitest run test/unit/previewInitResilience.property.test.ts`
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed — try-catch prevents IIFE abort)
    - _Requirements: 2.5, 2.6_

  - [x] 3.6 Verify preservation tests still pass
    - **Property 2: Preservation** — Backend Pipeline Output Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - Run `npx vitest run test/unit/previewPreservation.property.test.ts`
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions in backend pipeline, CSP, or placeholder generation)
    - Confirm all tests still pass after fix (no regressions)

- [x] 4. Checkpoint — Ensure all tests pass
  - Run full unit test suite: `npx vitest run -c config/vitest.unit.config.ts`
  - Run integration tests: `npx vitest run -c config/vitest.integration.config.ts`
  - Verify no existing tests were broken by the changes to `media/preview.js` or `src/preview/buildHtml.ts`
  - Ensure all tests pass, ask the user if questions arise
