# Tasks

## Task 1: Add CSS styles for environment status display

- [ ] 1.1 Add `.ms-env-status`, `.ms-env-line`, `.ms-env-ok`, and `.ms-env-fail` styles to `media/preview.css` with light and dark theme support
- [ ] 1.2 Remove the `.ms-loading-timer` style rule from `media/preview.css`

## Task 2: Update `buildLoadingHtml()` to accept and render status lines

- [ ] 2.1 Add an HTML-escape utility function in `src/preview/buildHtml.ts`
- [ ] 2.2 Modify `buildLoadingHtml()` signature to accept an optional `statusLines` parameter
- [ ] 2.3 Implement status line rendering logic: iterate over `statusLines`, classify by ✅/❌ prefix, escape content, and emit div elements with appropriate CSS classes
- [ ] 2.4 Remove the `ms-loading-timer` div from `buildLoadingHtml()` output
- [ ] 2.5 Remove the `ms-loading-timer` div from `buildHtml()` output

## Task 3: Remove dead timer code from `preview.js`

- [ ] 3.1 Remove `_loadingTimerId`, `_loadingStartTime`, and `_updateTimerText()` from `media/preview.js`
- [ ] 3.2 Simplify `showLoadingOverlay()` to create overlay with spinner only (no timer div, no setInterval)
- [ ] 3.3 Simplify `hideLoadingOverlay()` to hide overlay without clearInterval logic

## Task 4: Wire environment validation into webview panel loading flow

- [ ] 4.1 Import `validateEnvironment`, `dependencyStatus`, and `getConfig` in `src/preview/webviewPanel.ts`
- [ ] 4.2 Call `validateEnvironment()` before `buildLoadingHtml()` in both the new-panel and reuse-panel code paths, with try/catch fallback to empty array on error
- [ ] 4.3 Pass the resulting status lines to `buildLoadingHtml()`

## Task 5: Write property-based tests

- [ ] 5.1 Property test: Status line count invariant — for any array of N strings, output contains exactly N `ms-env-line` elements (Validates: Requirements 1.1, 7.1)
- [ ] 5.2 Property test: Status line CSS class classification — ✅ → `ms-env-ok`, ❌ → `ms-env-fail`, other → `ms-env-line` only (Validates: Requirements 1.2, 1.3, 1.4)
- [ ] 5.3 Property test: No script execution in loading page — output never contains `<script` and CSP has no `script-src` (Validates: Requirements 4.1, 4.2)
- [ ] 5.4 Property test: Timer removal completeness — output never contains `ms-loading-timer` (Validates: Requirement 3.1)
- [ ] 5.5 Property test: HTML escaping — status lines with `<`, `>`, `&`, `"` are escaped in output (Validates: Requirement 4.3)

## Task 6: Write unit and integration tests

- [ ] 6.1 Unit test: `buildLoadingHtml()` with undefined and empty statusLines produces spinner with no status section
- [ ] 6.2 Unit test: `buildHtml()` output does not contain `ms-loading-timer`
- [ ] 6.3 Unit test: `showLoadingOverlay()` creates overlay with spinner and no timer div
- [ ] 6.4 Unit test: `hideLoadingOverlay()` hides overlay without clearInterval
- [ ] 6.5 Integration test: webviewPanel calls validateEnvironment and passes lines to buildLoadingHtml
- [ ] 6.6 Integration test: webviewPanel falls back to empty array when validateEnvironment throws

## Task 7: Update existing tests for timer removal

- [ ] 7.1 Update any existing tests that reference `ms-loading-timer` to reflect its removal
- [ ] 7.2 Update any existing tests for `showLoadingOverlay`/`hideLoadingOverlay` to remove timer assertions
