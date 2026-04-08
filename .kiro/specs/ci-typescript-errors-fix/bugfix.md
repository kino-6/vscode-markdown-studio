# Bugfix Requirements Document

## Introduction

The GitHub Actions release workflow fails at the `npm run lint` step (`tsc --noEmit`) with 15 TypeScript compilation errors across 7 files. These errors prevent CI from completing, blocking all releases. The errors fall into five categories: DOM type shadowing in Playwright callbacks, missing property in an inline type, changed module path in markdown-it v14, top-level `await` incompatible with `module: "commonjs"`, missing type declarations for a JS file, and a missing required property in a test fixture.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN `tsc --noEmit` runs on `src/export/exportPdf.ts` THEN the compiler reports errors at lines 220, 222, 294, 296 because `document` inside `page.waitForFunction()` string callbacks resolves to VS Code's `TextDocument` type (from the `vscode` types package) instead of the DOM `Document`, and the `h` variable in `Array.from(hosts).every(h => ...)` is typed as `unknown`

1.2 WHEN `tsc --noEmit` runs on `src/preview/buildHtml.ts` THEN the compiler reports an error at line 208 because `assets?.katexStyleUri` references a property not present in the inline type `{ styleUri: Uri; scriptUri: Uri; hljsStyleUri?: Uri }`, even though the `PreviewAssetUris` interface in `previewAssets.ts` includes `katexStyleUri`

1.3 WHEN `tsc --noEmit` runs on `src/toc/extractHeadings.ts` THEN the compiler reports "Cannot find module 'markdown-it/lib/token'" at line 2 because markdown-it v14 changed its type export paths

1.4 WHEN `tsc --noEmit` runs on `test/unit/loadingOverlay.test.ts` and `test/unit/loadingOverlayMessageHandler.test.ts` THEN the compiler reports top-level `await` is not allowed when `module` is `"commonjs"` (at lines 76 and 98 respectively)

1.5 WHEN `tsc --noEmit` runs on `test/unit/initialLoadSpinner.test.ts`, `test/unit/loadingOverlay.test.ts`, and `test/unit/loadingOverlayMessageHandler.test.ts` THEN the compiler reports TS7016 "Could not find a declaration file for module '../../media/preview.js'" because `media/preview.js` has no type declarations

1.6 WHEN `tsc --noEmit` runs on `test/unit/validateEnvironmentCore.test.ts` THEN the compiler reports that the `baseConfig` object literal is missing the required `pdfToc` property from the `MarkdownStudioConfig` interface

### Expected Behavior (Correct)

2.1 WHEN `tsc --noEmit` runs on `src/export/exportPdf.ts` THEN the compiler SHALL produce no errors for the `page.waitForFunction()` callbacks, because the callback strings/functions passed to Playwright execute in a browser context where `document` is the DOM `Document` and element types are properly resolved

2.2 WHEN `tsc --noEmit` runs on `src/preview/buildHtml.ts` THEN the compiler SHALL produce no errors for `assets?.katexStyleUri` because the `assets` parameter type SHALL include the `katexStyleUri` property (aligned with the `PreviewAssetUris` interface)

2.3 WHEN `tsc --noEmit` runs on `src/toc/extractHeadings.ts` THEN the compiler SHALL produce no errors for the `Token` import because the import path SHALL be updated to match the markdown-it v14 type export structure

2.4 WHEN `tsc --noEmit` runs on test files using top-level `await` THEN the compiler SHALL produce no errors because the test files SHALL either be excluded from the main `tsconfig.json` compilation or use a compatible module setting

2.5 WHEN `tsc --noEmit` runs on test files importing `media/preview.js` THEN the compiler SHALL produce no errors because a type declaration file SHALL exist for the module or the files SHALL be excluded from strict type checking

2.6 WHEN `tsc --noEmit` runs on `test/unit/validateEnvironmentCore.test.ts` THEN the compiler SHALL produce no errors because the `baseConfig` fixture SHALL include the `pdfToc` property matching the `MarkdownStudioConfig` interface

### Unchanged Behavior (Regression Prevention)

3.1 WHEN `tsc --noEmit` runs on all other source files not mentioned above THEN the system SHALL CONTINUE TO compile without errors

3.2 WHEN the PDF export function executes Playwright `page.waitForFunction()` callbacks at runtime THEN the system SHALL CONTINUE TO correctly detect Mermaid diagram rendering completion by querying DOM elements

3.3 WHEN `buildHtml` is called with preview assets THEN the system SHALL CONTINUE TO generate HTML with KaTeX stylesheet links, highlight.js stylesheet links, and all other asset references

3.4 WHEN `extractHeadings` parses markdown content THEN the system SHALL CONTINUE TO correctly extract heading entries using markdown-it Token types

3.5 WHEN unit tests execute via `vitest` THEN the system SHALL CONTINUE TO pass all existing tests including those that dynamically import `media/preview.js`

3.6 WHEN `validateEnvironmentCore` tests run THEN the system SHALL CONTINUE TO validate environment configuration using a complete `MarkdownStudioConfig` fixture
