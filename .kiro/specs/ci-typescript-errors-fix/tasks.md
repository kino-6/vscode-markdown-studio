# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** — TypeScript Compilation Fails with 15 Errors
  - **CRITICAL**: This test MUST FAIL on unfixed code — failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior — it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: The bug is deterministic — scope the property to the concrete compilation of the project via `tsc --noEmit`
  - Write a test in `test/unit/tscCompilation.property.test.ts` that shells out to `npx tsc --noEmit` and asserts exit code 0 with zero error output
  - The test asserts: `tsc --noEmit` exits with code 0 AND stderr/stdout contains no `error TS` lines (from Bug Condition in design: `isBugCondition(file)` where files contain Playwright string callbacks, inline type divergence, stale import path, top-level await, missing declarations, or incomplete fixture)
  - Run test on UNFIXED code — expect FAILURE (this confirms the bug exists: 15 TS errors across 7 files)
  - Document counterexamples found (e.g., "TS2339: Property 'querySelectorAll' does not exist on type 'TextDocument'" in exportPdf.ts)
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** — Existing Unit Tests Pass on Unfixed Code
  - **IMPORTANT**: Follow observation-first methodology
  - Observe: run `npx vitest --run` on unfixed code and record that all existing unit tests pass
  - Observe: `extractHeadings` correctly parses headings from markdown using the current Token import (runtime works despite type error)
  - Observe: `buildHtml` generates HTML with KaTeX stylesheet links using the current inline type (runtime works despite type error)
  - Observe: `validateEnvironmentCore` tests pass with the current baseConfig fixture shape
  - Write a property-based test in `test/unit/tscPreservation.property.test.ts` that shells out to `npx vitest --run` and asserts exit code 0 (all tests pass)
  - Verify test passes on UNFIXED code (confirms baseline behavior to preserve)
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 3. Fix CI TypeScript compilation errors

  - [x] 3.1 Fix Playwright string callbacks in `src/export/exportPdf.ts`
    - Convert the `page.evaluate` string template (around line 215) to a typed arrow function that receives `cfg.toc.minLevel` and `cfg.toc.maxLevel` as arguments, and add an explicit return type annotation for the `domData` result so `headings` and `scrollHeight` are properly typed
    - Convert the two `page.waitForFunction` string callbacks (Mermaid rendering detection, around lines 250 and 290) to arrow functions so TypeScript does not type-check `document` as `vscode.TextDocument`
    - This resolves 6 errors: TS2339 (`querySelectorAll` on `TextDocument`) ×2 and TS18046 (`h` is `unknown`) ×4
    - _Bug_Condition: isBugCondition(file) where file.containsPlaywrightStringCallbackWithDOMDocument()_
    - _Expected_Behavior: tsc --noEmit produces zero errors for exportPdf.ts_
    - _Preservation: PDF export Playwright callbacks continue to detect Mermaid rendering at runtime_
    - _Requirements: 1.1, 2.1, 3.2_

  - [x] 3.2 Fix inline type in `src/preview/buildHtml.ts`
    - Replace the inline `assets` parameter type `{ styleUri: vscode.Uri; scriptUri: vscode.Uri; hljsStyleUri?: vscode.Uri }` with `PreviewAssetUris` imported from `./previewAssets`
    - Make the parameter optional: `assets?: PreviewAssetUris`
    - This resolves 1 error: TS2339 (`katexStyleUri` does not exist on inline type)
    - _Bug_Condition: isBugCondition(file) where file.hasInlineAssetTypeMissingKatexProperty()_
    - _Expected_Behavior: tsc --noEmit produces zero errors for buildHtml.ts_
    - _Preservation: buildHtml continues to generate HTML with KaTeX, hljs, and preview CSS links_
    - _Requirements: 1.2, 2.2, 3.3_

  - [x] 3.3 Fix Token import in `src/toc/extractHeadings.ts`
    - Replace `import type Token from 'markdown-it/lib/token'` with `import type { Token } from 'markdown-it'`
    - This resolves 1 error: TS2307 (Cannot find module 'markdown-it/lib/token')
    - _Bug_Condition: isBugCondition(file) where file.importsFrom('markdown-it/lib/token')_
    - _Expected_Behavior: tsc --noEmit produces zero errors for extractHeadings.ts_
    - _Preservation: extractHeadings continues to parse markdown-it Token objects correctly_
    - _Requirements: 1.3, 2.3, 3.4_

  - [x] 3.4 Exclude test files with top-level await from `tsconfig.json`
    - Add to the `exclude` array: `test/unit/loadingOverlay.test.ts`, `test/unit/loadingOverlayMessageHandler.test.ts`, `test/unit/initialLoadSpinner.test.ts`
    - This resolves 2 top-level await errors (TS1378) and 4 missing declaration errors (TS7016) since all three files import `../../media/preview.js`
    - Vitest uses its own config so these tests continue to run normally
    - _Bug_Condition: isBugCondition(file) where file.usesTopLevelAwait() AND tsconfig.module == 'commonjs', OR file.importsUntyped('../../media/preview.js')_
    - _Expected_Behavior: tsc --noEmit produces zero errors for top-level await and missing declaration files_
    - _Preservation: All excluded test files continue to run via vitest_
    - _Requirements: 1.4, 1.5, 2.4, 2.5, 3.5_

  - [x] 3.5 Add missing `pdfToc` property in `test/unit/validateEnvironmentCore.test.ts`
    - Add `pdfToc: { hidden: true }` to the `baseConfig` fixture object (after the `pdfIndex` property)
    - This resolves 1 error: TS2741 (Property 'pdfToc' is missing)
    - _Bug_Condition: isBugCondition(file) where file.hasIncompleteConfigFixture('pdfToc')_
    - _Expected_Behavior: tsc --noEmit produces zero errors for validateEnvironmentCore.test.ts_
    - _Preservation: validateEnvironmentCore tests continue to validate environment configuration_
    - _Requirements: 1.6, 2.6, 3.6_

  - [x] 3.6 Optionally create `src/deps/preview.d.ts` type declaration
    - Create a minimal ambient module declaration for `../../media/preview.js` if any importing test files remain in the compilation scope after step 3.4
    - If all importing files are excluded, skip this step (the declaration is not needed)
    - _Bug_Condition: isBugCondition(file) where file.importsUntyped('../../media/preview.js')_
    - _Expected_Behavior: No TS7016 errors for media/preview.js imports_
    - _Preservation: Runtime behavior of media/preview.js unchanged_
    - _Requirements: 1.5, 2.5_

  - [x] 3.7 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** — Zero TypeScript Compilation Errors
    - **IMPORTANT**: Re-run the SAME test from task 1 — do NOT write a new test
    - The test from task 1 encodes the expected behavior: `tsc --noEmit` exits with code 0
    - When this test passes, it confirms all 15 TypeScript errors are resolved
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [x] 3.8 Verify preservation tests still pass
    - **Property 2: Preservation** — Existing Unit Tests Still Pass
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all existing vitest tests still pass after fix (no regressions)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 4. Checkpoint — Ensure all tests pass
  - Run `npx tsc --noEmit` and verify exit code 0 (zero compilation errors)
  - Run `npx vitest --run` and verify all existing tests pass
  - Ensure all tests pass, ask the user if questions arise.
