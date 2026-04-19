# Dependency Download Race Condition Bugfix Design

## Overview

When the Markdown Studio extension activates, `DependencyManager.ensureAll()` downloads Corretto JDK and Playwright Chromium asynchronously. Although `activate()` awaits `ensureAll()`, commands are registered regardless of whether dependencies installed successfully. There is no gate mechanism to check dependency readiness when commands execute, leading to silent failures or cryptic error messages (e.g., "Executable doesn't exist" instead of "Dependencies not installed"). Additionally, the `setupDependencies` command can be re-invoked during an ongoing setup, causing parallel downloads that may corrupt the installation.

The fix introduces a dependency readiness gate that commands check before execution, clear user-facing messages when dependencies are unavailable, and a mutex to prevent concurrent setup operations.

## Glossary

- **Bug_Condition (C)**: A command requiring a specific dependency (Chromium for PDF export, Java for PlantUML) is executed when that dependency is not ready — either still downloading, failed to install, or missing from disk
- **Property (P)**: Commands that require dependencies SHALL either (a) block with a clear progress message until dependencies are ready, or (b) show an actionable error message directing the user to run "Setup Dependencies"
- **Preservation**: All existing behavior when dependencies are fully installed must remain unchanged — no additional latency, no changed error messages, no altered command registration
- **`DependencyManager`**: Class in `src/deps/dependencyManager.ts` that manages downloading and verifying Corretto JDK and Playwright Chromium
- **`dependencyStatus`**: Module-level exported variable in `src/extension.ts` of type `DependencyStatus` that holds the current state of dependencies
- **`ensureAll()`**: Method on `DependencyManager` that checks manifest, downloads missing dependencies in parallel, and returns `DependencyStatus`
- **`reinstall()`**: Method on `DependencyManager` that clears the manifest and re-runs `ensureAll()` for a fresh install

## Bug Details

### Bug Condition

The bug manifests when a user executes a command that requires a specific dependency (Chromium for PDF export, Java/Corretto for PlantUML rendering) while that dependency is not available. The current code registers all commands unconditionally after `ensureAll()` completes (whether it succeeded or failed), and individual commands either produce cryptic errors from the underlying tool (Playwright's "Executable doesn't exist") or fall back to a system `java` path that may not exist.

A secondary bug manifests when the user triggers "Setup Dependencies" while a previous setup is still in progress, causing concurrent `ensureAll()` calls that race on file system operations.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { command: string, dependencyStatus: DependencyStatus, setupInProgress: boolean }
  OUTPUT: boolean

  // Primary bug: command executed without required dependency
  IF input.command == 'exportPdf' AND NOT input.dependencyStatus.browserPath THEN
    RETURN true
  END IF
  IF input.command == 'renderPlantUml' AND NOT input.dependencyStatus.javaPath THEN
    RETURN true
  END IF

  // Secondary bug: concurrent setup execution
  IF input.command == 'setupDependencies' AND input.setupInProgress THEN
    RETURN true
  END IF

  RETURN false
END FUNCTION
```

### Examples

- **PDF Export without Chromium**: User runs "Export PDF" after `ensureAll()` failed to install Chromium. Current behavior: Playwright throws "Executable doesn't exist" or "browserType.launch" error. Expected: Clear message "Chromium is not installed. Run 'Markdown Studio: Setup Dependencies' to install it."
- **PlantUML without Java**: User previews a Markdown file with PlantUML diagrams after Corretto failed to install. Current behavior: `runProcess` fails with ENOENT for `java` command, showing "Java is not available" without clear remediation. Expected: Error message explicitly states the dependency is missing and directs to "Setup Dependencies".
- **Partial install (Corretto OK, Chromium failed)**: User runs "Export PDF". Current behavior: cryptic Playwright error. Expected: Message specifically identifies Chromium as the missing dependency.
- **Concurrent setup**: User clicks "Setup Dependencies" twice quickly. Current behavior: two parallel `ensureAll()` calls race on file I/O. Expected: Second call shows "Setup already in progress" and is rejected.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- When all dependencies are installed and verified, PDF export must work exactly as before with no additional latency from gate checks
- When all dependencies are installed, PlantUML rendering must use the managed Corretto path exactly as before
- Preview of plain Markdown (no PlantUML) must work regardless of dependency state, with no gate blocking
- The "Validate Environment" command must continue to report dependency status as before
- Extension activation must still call `ensureAll()` to attempt automatic dependency setup
- The TOC insert command, reload preview command, and other non-dependency commands must be unaffected
- Command registration in `activate()` must still happen so commands appear in the command palette

**Scope:**
All inputs that do NOT involve executing a dependency-requiring command while that dependency is unavailable should be completely unaffected by this fix. This includes:
- Any command execution when dependencies are fully installed
- Preview of Markdown without PlantUML blocks
- TOC insertion, environment validation, and other utility commands
- Normal extension activation and deactivation lifecycle

## Hypothesized Root Cause

Based on the bug description and code analysis, the issues are:

1. **No dependency gate in command handlers**: `exportPdfCommand` in `src/commands/exportPdf.ts` and `renderPlantUml` in `src/renderers/renderPlantUml.ts` access `dependencyStatus` but only use it as a fallback path — they don't check readiness upfront and fail deep in the execution stack with tool-specific errors.

2. **Commands registered unconditionally**: In `src/extension.ts`, all commands are registered in `context.subscriptions.push()` after `ensureAll()` completes, regardless of whether `dependencyStatus.allReady` is true. While commands should remain registered (for discoverability), they lack a pre-execution readiness check.

3. **No mutex on setup operations**: `DependencyManager` has no internal state tracking whether `ensureAll()` or `reinstall()` is currently running. The `setupDependencies` command handler in `extension.ts` calls `depManager.reinstall()` without checking if a previous call is still in progress.

4. **Module-level `dependencyStatus` is a snapshot, not reactive**: The exported `dependencyStatus` variable is set once after `ensureAll()` completes. If a user runs "Setup Dependencies" to fix a failed install, the variable is updated, but there's no mechanism to notify commands that were already mid-execution or queued.

## Correctness Properties

Property 1: Bug Condition - Dependency Gate Blocks Commands

_For any_ command execution where the required dependency is not available (isBugCondition returns true for the primary condition), the gate mechanism SHALL prevent the command from proceeding to the dependency-requiring code path and SHALL display a clear, actionable error message that identifies the specific missing dependency and directs the user to run "Markdown Studio: Setup Dependencies".

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Bug Condition - Concurrent Setup Prevention

_For any_ invocation of "Setup Dependencies" while a previous setup operation is still in progress (isBugCondition returns true for the secondary condition), the system SHALL reject the duplicate invocation with a notification that setup is already in progress, preventing concurrent file system operations.

**Validates: Requirements 2.4**

Property 3: Preservation - Commands Work When Dependencies Ready

_For any_ command execution where all required dependencies are available (isBugCondition returns false), the fixed code SHALL produce exactly the same behavior as the original code, with no additional blocking, no changed error messages, and no measurable latency from the gate check, preserving all existing functionality.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**

Property 4: Preservation - Non-Dependency Commands Unaffected

_For any_ command that does not require external dependencies (preview without PlantUML, TOC insertion, environment validation), the fixed code SHALL execute the command immediately regardless of dependency state, preserving existing behavior for all non-dependency-requiring operations.

**Validates: Requirements 2.5, 3.3, 3.4**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `src/deps/dependencyManager.ts`

**Changes**:
1. **Add setup mutex**: Add a private `_setupInProgress` boolean flag and a `_setupPromise` field to `DependencyManager`. When `ensureAll()` or `reinstall()` is called while another is running, return the existing promise or reject with a "setup in progress" indicator.
2. **Expose `isSetupInProgress` getter**: Add a public getter so command handlers can check if setup is running.

**File**: `src/extension.ts`

**Changes**:
3. **Add dependency gate helper**: Create a `requireDependency(name: 'java' | 'chromium')` function that checks `dependencyStatus` and shows a clear VS Code error message if the required dependency is missing, returning `false` to signal the caller to abort.
4. **Gate `exportPdf` command**: Before calling `exportPdfCommand(context)`, check `requireDependency('chromium')`. If it returns false, abort.
5. **Gate `setupDependencies` command**: Before calling `depManager.reinstall()`, check `depManager.isSetupInProgress`. If true, show an info message and return.
6. **Update `dependencyStatus` export**: Keep the module-level export but ensure it's updated after both `ensureAll()` and `reinstall()` complete.

**File**: `src/renderers/renderPlantUml.ts`

**Changes**:
7. **Improve error message for missing Java**: When `dependencyStatus?.javaPath` is undefined and the fallback `cfg.javaPath` also fails, produce a clear error message: "Java (Corretto) is not installed. Run 'Markdown Studio: Setup Dependencies' to install it automatically."

**File**: `src/commands/exportPdf.ts`

**Changes**:
8. **Improve error message for missing Chromium**: Update the catch block to produce a clearer message when `dependencyStatus?.browserPath` is undefined, referencing "Setup Dependencies" instead of `npx playwright install chromium`.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write unit tests that simulate dependency failure states and invoke command handlers, observing the error messages produced. Run these tests on the UNFIXED code to confirm that error messages are cryptic/unhelpful.

**Test Cases**:
1. **PDF Export without Chromium**: Set `dependencyStatus` to `{ allReady: false, browserPath: undefined, errors: ['Chromium: failed'] }`, invoke `exportPdfCommand` — observe that the error message references Playwright internals rather than "Setup Dependencies" (will fail on unfixed code)
2. **PlantUML without Java**: Set `dependencyStatus` to `{ allReady: false, javaPath: undefined, errors: ['Corretto: failed'] }`, invoke `renderPlantUml` — observe that the error message is generic (will fail on unfixed code)
3. **Concurrent Setup**: Call `depManager.reinstall()` twice in rapid succession — observe that both calls execute in parallel without mutex protection (will fail on unfixed code)
4. **Partial Install**: Set `dependencyStatus` with `javaPath` set but `browserPath` undefined, invoke `exportPdfCommand` — observe that the error doesn't identify the specific missing dependency (will fail on unfixed code)

**Expected Counterexamples**:
- Error messages reference tool-specific internals ("Executable doesn't exist", "ENOENT") instead of actionable guidance
- Concurrent `reinstall()` calls both proceed without coordination
- Possible causes: no pre-execution gate check, no mutex on setup operations

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  IF input.command IN ['exportPdf'] AND NOT input.dependencyStatus.browserPath THEN
    result := executeCommand(input.command)
    ASSERT result.errorMessage CONTAINS 'Setup Dependencies'
    ASSERT result.commandAborted == true
  END IF
  IF input.command IN ['renderPlantUml'] AND NOT input.dependencyStatus.javaPath THEN
    result := renderPlantUml(input.source, input.context)
    ASSERT result.ok == false
    ASSERT result.error CONTAINS 'Setup Dependencies'
  END IF
  IF input.command == 'setupDependencies' AND input.setupInProgress THEN
    result := executeSetup()
    ASSERT result.rejected == true
    ASSERT infoMessageShown CONTAINS 'already in progress'
  END IF
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT executeCommand_original(input) = executeCommand_fixed(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain (various dependency states, command types)
- It catches edge cases that manual unit tests might miss (e.g., partially valid states)
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for commands with all dependencies ready, then write property-based tests capturing that behavior.

**Test Cases**:
1. **PDF Export Preservation**: Verify that when `dependencyStatus.browserPath` is set, `exportPdfCommand` proceeds exactly as before with no gate interference
2. **PlantUML Preservation**: Verify that when `dependencyStatus.javaPath` is set, `renderPlantUml` uses the managed path exactly as before
3. **Preview Preservation**: Verify that `openPreviewCommand` works regardless of dependency state for plain Markdown
4. **Non-Dependency Command Preservation**: Verify that `insertTocCommand`, `validateEnvironmentCommand` work regardless of dependency state

### Unit Tests

- Test `requireDependency('chromium')` returns true when `browserPath` is set, false when undefined
- Test `requireDependency('java')` returns true when `javaPath` is set, false when undefined
- Test `DependencyManager.isSetupInProgress` returns correct state during and after setup
- Test concurrent `reinstall()` calls — second call should be rejected
- Test that gate check is synchronous and adds no async overhead when dependencies are ready
- Test error messages contain "Setup Dependencies" guidance

### Property-Based Tests

- Generate random `DependencyStatus` objects and verify: if `allReady` is true, gate always passes; if specific dependency is missing, gate blocks the corresponding command
- Generate random sequences of `ensureAll()`/`reinstall()` calls and verify mutex prevents concurrent execution
- Generate random command + dependency state combinations and verify non-dependency commands are never blocked

### Integration Tests

- Test full activation → ensureAll failure → command execution → clear error message flow
- Test activation → ensureAll success → command execution → normal behavior flow
- Test setupDependencies → concurrent setupDependencies → rejection flow
- Test partial dependency state → specific command → specific error message flow
