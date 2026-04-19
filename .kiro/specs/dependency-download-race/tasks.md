# Implementation Tasks

## Task 1: Add setup mutex to DependencyManager
- [x] 1.1 Add `_setupInProgress` boolean flag and `_setupPromise: Promise<DependencyStatus> | null` private fields to `DependencyManager` class in `src/deps/dependencyManager.ts`
- [x] 1.2 Add public `get isSetupInProgress(): boolean` getter that returns `_setupInProgress`
- [x] 1.3 Modify `ensureAll()` to set `_setupInProgress = true` at start and `false` in a `finally` block, storing the promise in `_setupPromise`
- [x] 1.4 Modify `ensureAll()` to return the existing `_setupPromise` if `_setupInProgress` is already true (deduplication)
- [x] 1.5 Modify `reinstall()` to check `_setupInProgress` and return the existing promise if setup is already running
- [x] 1.6 Write unit tests for mutex behavior: concurrent `ensureAll()` calls return the same promise, `isSetupInProgress` reflects correct state, mutex resets after completion and after errors

## Task 2: Add dependency gate helper in extension.ts
- [x] 2.1 Create a `checkDependency(name: 'java' | 'chromium'): boolean` function in `src/extension.ts` that checks `dependencyStatus` for the specified dependency and returns `true` if available
- [x] 2.2 When `checkDependency` returns `false`, show a `vscode.window.showErrorMessage` with a clear message identifying the missing dependency and suggesting "Run 'Markdown Studio: Setup Dependencies' to install it"
- [x] 2.3 Gate the `exportPdf` command registration lambda: call `checkDependency('chromium')` before `exportPdfCommand(context)`, return early if false
- [x] 2.4 Gate the `setupDependencies` command: check `depManager.isSetupInProgress` before calling `depManager.reinstall()`, show info message "Setup is already in progress" and return early if true
- [x] 2.5 Write unit tests for `checkDependency`: returns true when dependency is available, returns false and shows error when missing, does not block non-dependency commands

## Task 3: Improve error messages in command handlers
- [x] 3.1 Update `src/commands/exportPdf.ts` catch block to replace the `npx playwright install chromium` message with "Chromium is not installed. Run 'Markdown Studio: Setup Dependencies' to install it automatically."
- [x] 3.2 Update `src/renderers/renderPlantUml.ts` to check `dependencyStatus?.javaPath` before attempting `runProcess`, and return a clear error result with "Java (Corretto) is not installed. Run 'Markdown Studio: Setup Dependencies' to install it automatically." when Java is unavailable
- [x] 3.3 Write unit tests verifying error messages contain "Setup Dependencies" for both PDF export and PlantUML rendering failure cases

## Task 4: Write exploratory property-based tests (bug condition)
- [x] 4.1 (**PBT - Exploration**) Write a property test that generates random `DependencyStatus` objects where `browserPath` is undefined, invokes the dependency gate for 'chromium', and asserts the gate blocks execution — run on UNFIXED code to confirm the bug exists
- [x] 4.2 (**PBT - Exploration**) Write a property test that generates random concurrent `reinstall()` call sequences and asserts only one executes at a time — run on UNFIXED code to confirm the race condition exists

## Task 5: Write fix-verification property-based tests
- [x] 5.1 (**PBT - Fix**) Write a property test: for any `DependencyStatus` where `browserPath` is undefined, the chromium gate SHALL return false and the error message SHALL contain "Setup Dependencies"
- [x] 5.2 (**PBT - Fix**) Write a property test: for any `DependencyStatus` where `javaPath` is undefined, the java gate SHALL return false and the error message SHALL contain "Setup Dependencies"
- [x] 5.3 (**PBT - Fix**) Write a property test: for any sequence of concurrent `ensureAll()`/`reinstall()` calls, the mutex SHALL ensure only one runs at a time (second call returns same promise)

## Task 6: Write preservation property-based tests
- [x] 6.1 (**PBT - Preservation**) Write a property test: for any `DependencyStatus` where `allReady` is true and both paths are set, the gate SHALL pass for all command types with no blocking
- [x] 6.2 (**PBT - Preservation**) Write a property test: for any command that does not require dependencies (insertToc, validateEnvironment, openPreview without PlantUML), the command SHALL execute regardless of dependency state

## Task 7: Verify and finalize
- [x] 7.1 Run full unit test suite (`npm run test:unit`) and verify all tests pass
- [x] 7.2 Run integration test suite (`npm run test:integration`) and verify no regressions
- [x] 7.3 Run TypeScript type check (`npm run lint`) and verify no type errors
