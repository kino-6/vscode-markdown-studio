# CI TypeScript Errors Fix — Bugfix Design

## Overview

The CI release workflow fails at `tsc --noEmit` with 15 TypeScript compilation errors across 7 files. The errors stem from five root causes: DOM type shadowing in Playwright `page.evaluate`/`page.waitForFunction` callbacks, an inline type parameter diverging from the canonical `PreviewAssetUris` interface, a stale `markdown-it/lib/token` import path incompatible with `@types/markdown-it` v14, top-level `await` in test files under `module: "commonjs"`, missing type declarations for `media/preview.js`, and a missing `pdfToc` property in a test fixture. The fix addresses each category with minimal, targeted changes.

## Glossary

- **Bug_Condition (C)**: Any TypeScript source file included in the `tsconfig.json` compilation that contains one of the five error patterns described below
- **Property (P)**: `tsc --noEmit` completes with zero errors across the entire project
- **Preservation**: All runtime behavior (PDF export, preview rendering, heading extraction, test execution) remains identical after the type-level fixes
- **`page.evaluate` / `page.waitForFunction`**: Playwright APIs that execute JavaScript in a browser context; TypeScript checks the callback as if it runs in Node, causing DOM type conflicts
- **`PreviewAssetUris`**: Interface in `src/preview/previewAssets.ts` defining all webview asset URIs including `katexStyleUri`
- **`MarkdownStudioConfig`**: Interface in `src/infra/config.ts` defining the full extension configuration shape

## Bug Details

### Bug Condition

The bug manifests when `tsc --noEmit` is run against the project. The compiler encounters type errors in 7 files because: (1) `document` in string-template Playwright callbacks resolves to VS Code's `TextDocument` instead of DOM `Document`, (2) an inline type literal lacks `katexStyleUri`, (3) `markdown-it/lib/token` has no `.d.ts` file in `@types/markdown-it` v14, (4) top-level `await` is forbidden under `module: "commonjs"`, (5) `media/preview.js` has no type declarations, and (6) a test fixture is missing the `pdfToc` property.

**Formal Specification:**
```
FUNCTION isBugCondition(file)
  INPUT: file of type TypeScriptSourceFile
  OUTPUT: boolean

  RETURN file IN tsconfig.include
         AND file NOT IN tsconfig.exclude
         AND (
           file.containsPlaywrightStringCallbackWithDOMDocument()
           OR file.hasInlineAssetTypeMissingKatexProperty()
           OR file.importsFrom('markdown-it/lib/token')
           OR (file.usesTopLevelAwait() AND tsconfig.module == 'commonjs')
           OR file.importsUntyped('../../media/preview.js')
           OR file.hasIncompleteConfigFixture('pdfToc')
         )
END FUNCTION
```

### Examples

- `src/export/exportPdf.ts` line 220: `document.querySelectorAll(...)` inside `page.evaluate` string — `document` resolves to `vscode.TextDocument` which has no `querySelectorAll`. Expected: no error (browser context).
- `src/export/exportPdf.ts` line 222: `h.offsetTop` in `.map(h => ...)` — `h` is `unknown` because the `page.evaluate` return type is untyped. Expected: no error.
- `src/preview/buildHtml.ts` line 208: `assets?.katexStyleUri` — property doesn't exist on inline type `{ styleUri: Uri; scriptUri: Uri; hljsStyleUri?: Uri }`. Expected: no error (should use `PreviewAssetUris`).
- `src/toc/extractHeadings.ts` line 2: `import type Token from 'markdown-it/lib/token'` — no `.d.ts` file exists at that path in v14. Expected: no error.
- `test/unit/loadingOverlay.test.ts` line 76: `const { ... } = await import(...)` at top level — forbidden under `module: "commonjs"`. Expected: no error.
- `test/unit/validateEnvironmentCore.test.ts`: `baseConfig` missing `pdfToc: { hidden: true }`. Expected: no error.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- PDF export via Playwright must continue to correctly detect Mermaid rendering completion by querying DOM elements in `page.waitForFunction` callbacks
- `buildHtml` must continue to generate HTML with KaTeX, highlight.js, and preview CSS stylesheet links
- `extractHeadings` must continue to correctly parse markdown-it Token objects for heading extraction
- All existing unit tests must continue to pass via `vitest`
- The `validateEnvironmentCore` test suite must continue to validate environment configuration correctly
- Runtime behavior of `media/preview.js` (Mermaid rendering, theme detection, loading overlay) must be unchanged

**Scope:**
All changes are type-level only (import paths, type annotations, tsconfig excludes, type declarations, fixture completeness). No runtime logic is modified. All inputs that do NOT involve TypeScript compilation are completely unaffected.

## Hypothesized Root Cause

Based on the bug description, the root causes are:

1. **DOM Type Shadowing in Playwright Callbacks**: `tsconfig.json` has `"types": ["node", "vscode"]` which makes `document` resolve to `vscode.TextDocument` globally. The `page.evaluate` and `page.waitForFunction` callbacks in `exportPdf.ts` use template-string JavaScript that references `document` and DOM APIs, but TypeScript type-checks these strings in the Node/VS Code type context. The `page.evaluate` return value is also untyped, making destructured properties `unknown`.

2. **Inline Type Divergence**: `buildHtml` in `src/preview/buildHtml.ts` declares its `assets` parameter with an inline type `{ styleUri: Uri; scriptUri: Uri; hljsStyleUri?: Uri }` instead of using the `PreviewAssetUris` interface from `previewAssets.ts`. When `katexStyleUri` was added to `PreviewAssetUris`, the inline type in `buildHtml` was not updated.

3. **markdown-it v14 Type Export Path Change**: `@types/markdown-it` v14 only ships `.d.mts` files in `lib/` (e.g., `lib/token.d.mts`), not `.d.ts` files. The import `from 'markdown-it/lib/token'` fails because TypeScript with `module: "commonjs"` looks for `.d.ts` files. The `Token` type is available via `MarkdownIt.Token` from the main namespace.

4. **Top-Level `await` Under CommonJS**: `tsconfig.json` uses `"module": "commonjs"` which forbids top-level `await`. Three test files use `await import(...)` at the module level. These files need to be excluded from the main tsconfig compilation (vitest has its own config).

5. **Missing Type Declaration for `media/preview.js`**: Test files import `../../media/preview.js` which is a plain JavaScript file with no `.d.ts` declaration. TypeScript reports TS7016.

6. **Incomplete Test Fixture**: The `baseConfig` in `validateEnvironmentCore.test.ts` was not updated when `pdfToc: PdfTocConfig` was added to `MarkdownStudioConfig`.

## Correctness Properties

Property 1: Bug Condition — Zero TypeScript Compilation Errors

_For any_ TypeScript source file included in the `tsconfig.json` compilation scope, the fixed codebase SHALL compile without errors when `tsc --noEmit` is executed, producing an exit code of 0.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6**

Property 2: Preservation — Runtime Behavior Unchanged

_For any_ runtime execution path (PDF export, preview rendering, heading extraction, test execution), the fixed code SHALL produce exactly the same behavior as the original code, preserving all existing functionality since changes are type-level only.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `src/export/exportPdf.ts`

**Changes**:
1. **Convert string-template `page.evaluate` to a typed function**: Replace the string argument in `page.evaluate(...)` (around line 215) with a proper function that receives parameters. This avoids TypeScript trying to type-check `document` as `vscode.TextDocument`. Add an explicit return type annotation to the evaluate call so the destructured `headings` and `scrollHeight` are properly typed instead of `unknown`.
2. **Convert string-template `page.waitForFunction` callbacks**: Replace the two `page.waitForFunction` string callbacks (around lines 250 and 290) with arrow functions. This lets TypeScript skip type-checking the browser-context code while still being valid Playwright usage.

**File**: `src/preview/buildHtml.ts`

**Changes**:
3. **Use `PreviewAssetUris` interface**: Replace the inline `assets` parameter type `{ styleUri: vscode.Uri; scriptUri: vscode.Uri; hljsStyleUri?: vscode.Uri }` with the `PreviewAssetUris` interface imported from `./previewAssets`. This aligns the type with the canonical interface that already includes `katexStyleUri`. Make the parameter optional (`assets?: PreviewAssetUris`) to preserve the existing call pattern where `assets` can be `undefined`.

**File**: `src/toc/extractHeadings.ts`

**Changes**:
4. **Fix Token import path**: Replace `import type Token from 'markdown-it/lib/token'` with `import type { Token } from 'markdown-it'`. The `Token` type is exported from the `MarkdownIt` namespace in the main `@types/markdown-it` package, accessible as a named export.

**File**: `tsconfig.json`

**Changes**:
5. **Exclude test files with top-level `await`**: Add the three offending test files to the `exclude` array:
   - `test/unit/loadingOverlay.test.ts`
   - `test/unit/loadingOverlayMessageHandler.test.ts`
   - `test/unit/initialLoadSpinner.test.ts`
   These files are executed by vitest (which uses its own tsconfig/transform), so excluding them from the main `tsc` compilation has no effect on test execution.

**File**: `src/deps/preview.d.ts` (new file)

**Changes**:
6. **Add type declaration for `media/preview.js`**: Create a minimal ambient module declaration for `../../media/preview.js` that exports the functions used by the test files (`showLoadingOverlay`, `hideLoadingOverlay`, and the default module). This resolves TS7016 for any test files that remain in the compilation scope. Alternatively, since all three importing test files are being excluded (step 5), this may not be strictly necessary — but it's good practice for future imports.

**File**: `test/unit/validateEnvironmentCore.test.ts`

**Changes**:
7. **Add missing `pdfToc` property**: Add `pdfToc: { hidden: true }` to the `baseConfig` fixture object, matching the `MarkdownStudioConfig` interface shape.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, confirm the errors exist on unfixed code, then verify the fix eliminates all errors and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis.

**Test Plan**: Run `tsc --noEmit` on the unfixed codebase and capture all 15 errors. Verify each error matches the hypothesized root cause.

**Test Cases**:
1. **DOM Shadowing Test**: Run `tsc --noEmit` and verify errors at `exportPdf.ts` lines 220, 222, 294, 296 (will fail on unfixed code)
2. **Inline Type Test**: Run `tsc --noEmit` and verify error at `buildHtml.ts` line 208 (will fail on unfixed code)
3. **Import Path Test**: Run `tsc --noEmit` and verify error at `extractHeadings.ts` line 2 (will fail on unfixed code)
4. **Top-Level Await Test**: Run `tsc --noEmit` and verify errors in the three test files (will fail on unfixed code)
5. **Missing Declaration Test**: Run `tsc --noEmit` and verify TS7016 errors for `media/preview.js` imports (will fail on unfixed code)
6. **Missing Property Test**: Run `tsc --noEmit` and verify error in `validateEnvironmentCore.test.ts` (will fail on unfixed code)

**Expected Counterexamples**:
- 15 TypeScript errors across 7 files matching the 5 categories described in the bug analysis

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed codebase compiles cleanly.

**Pseudocode:**
```
FOR ALL file WHERE isBugCondition(file) DO
  result := tsc_noEmit(fixedCodebase)
  ASSERT result.exitCode == 0
  ASSERT result.errors.length == 0
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed code produces the same result as the original code.

**Pseudocode:**
```
FOR ALL file WHERE NOT isBugCondition(file) DO
  ASSERT tsc_noEmit(file, originalConfig) == tsc_noEmit(file, fixedConfig)
END FOR
```

**Testing Approach**: Since all changes are type-level only, preservation is verified by running the existing test suite (`vitest --run`) and confirming all tests pass with identical results.

**Test Cases**:
1. **Compilation Preservation**: Run `tsc --noEmit` on the fixed codebase and verify zero errors total
2. **Unit Test Preservation**: Run `vitest --run` and verify all existing tests pass
3. **PDF Export Preservation**: Verify `exportPdf.ts` Playwright callbacks still execute correctly at runtime (covered by integration tests)
4. **Preview Rendering Preservation**: Verify `buildHtml` still generates correct HTML with all asset URIs (covered by existing buildHtml tests)
5. **Heading Extraction Preservation**: Verify `extractHeadings` still works with markdown-it Token type (covered by existing extractHeadings tests)

### Unit Tests

- Run `tsc --noEmit` and assert exit code 0
- Run existing `vitest --run` suite and assert all tests pass
- Verify `baseConfig` fixture in `validateEnvironmentCore.test.ts` matches `MarkdownStudioConfig` shape

### Property-Based Tests

- Generate random markdown inputs and verify `extractHeadings` produces identical results before and after the Token import change
- Generate random asset URI configurations and verify `buildHtml` produces identical HTML output before and after the type change

### Integration Tests

- Run the full `tsc --noEmit` compilation as an integration test
- Run `vitest --run` to verify no test regressions
- Verify PDF export flow works end-to-end with the refactored Playwright callbacks
