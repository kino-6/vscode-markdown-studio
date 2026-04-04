# Implementation Plan: Auto Dependency Setup

## Overview

Implement automatic download, extraction, and configuration of Amazon Corretto 21 (Java) and Playwright Chromium into the extension's `globalStorageUri`, so Markdown Studio works out of the box with zero manual environment setup. All new code lives under `src/deps/`, with integration points in `extension.ts`, `renderPlantUml.ts`, `exportPdf.ts`, and `validateEnvironmentCore.ts`.

## Tasks

- [x] 1. Create core types and PlatformDetector
  - [x] 1.1 Create `src/deps/types.ts` with shared interfaces (`PlatformInfo`, `InstallerResult`, `DependencyManifest`, `DependencyStatus`)
    - Define `PlatformInfo` with `os`, `arch`, `archiveExt` fields
    - Define `InstallerResult` with `ok`, `path?`, `error?` fields
    - Define `DependencyManifest` with `version`, `corretto?`, `chromium?` sections
    - Define `DependencyStatus` with `allReady`, `javaPath?`, `browserPath?`, `errors`
    - _Requirements: 4.1, 4.2, 5.1, 5.4_

  - [x] 1.2 Create `src/deps/platformDetector.ts` implementing `detectPlatform()`
    - Map `process.platform` and `process.arch` to supported combinations (darwin-arm64, darwin-x64, linux-x64, win32-x64)
    - Return correct `archiveExt` (`tar.gz` for macOS/Linux, `zip` for Windows)
    - Throw descriptive error listing all supported platforms for unsupported combos
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 1.3 Write property tests for PlatformDetector
    - **Property 5: Unsupported platform detection** — for any OS/arch not in the supported set, `detectPlatform()` throws an error containing all supported platform names
    - **Validates: Requirement 4.3**

  - [x] 1.4 Write unit tests for PlatformDetector
    - Test each supported platform returns correct `PlatformInfo`
    - Test unsupported platforms throw with descriptive message
    - _Requirements: 4.1, 4.2, 4.3_

- [x] 2. Implement download and extraction utilities
  - [x] 2.1 Create `src/deps/download.ts` with `downloadFile(url, destPath)` function
    - Use Node.js `https` module (no new dependencies)
    - Follow HTTP redirects (301, 302) — required for Corretto URLs
    - Throw on HTTP errors (4xx, 5xx) and network failures
    - _Requirements: 2.1, 9.2_

  - [x] 2.2 Create `src/deps/extract.ts` with `extractTarGz()` and `extractZip()` functions
    - `extractTarGz`: use `zlib.createGunzip()` piped to `tar.extract()` (Node.js built-ins)
    - `extractZip`: use `unzipper` or Node.js `zlib` for Windows zip extraction
    - Set file permissions no broader than 0o755 on extracted executables (macOS/Linux)
    - _Requirements: 2.2, 9.5_

  - [x] 2.3 Create `findJavaBinary(extractDir, platform)` helper in `src/deps/extract.ts`
    - Locate the `java` (or `java.exe` on Windows) binary within the extracted Corretto directory
    - Handle macOS layout (`Contents/Home/bin/java`) vs Linux/Windows layout (`bin/java`)
    - Return absolute path to the binary
    - _Requirements: 2.4_

  - [x] 2.4 Write unit tests for download and extraction utilities
    - Test redirect following in `downloadFile`
    - Test `findJavaBinary` for each platform layout
    - Test file permission setting on extraction
    - _Requirements: 2.1, 2.2, 2.4, 9.5_

- [x] 3. Implement CorrettoInstaller
  - [x] 3.1 Create `src/deps/correttoInstaller.ts` implementing the `CorrettoInstaller` interface
    - Implement `buildCorrettoUrl(platform)` to construct the correct HTTPS URL on `corretto.aws` domain
    - Implement `install(storageDir, platform, progress)`: download archive, extract to `storageDir/corretto/`, verify with `java -version`, clean up archive
    - Implement `verify(storageDir)`: run `java -version` on the extracted binary
    - Implement `getJavaPath(storageDir)`: return absolute path to the java executable
    - Delete downloaded archive after extraction to reclaim disk space
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.6, 4.4, 9.2_

  - [x] 3.2 Write property tests for CorrettoInstaller URL construction
    - **Property 4: Platform-specific Corretto URL construction** — for any supported PlatformInfo, `buildCorrettoUrl()` produces an HTTPS URL on `corretto.aws` with correct platform tokens and archive extension
    - **Validates: Requirements 2.1, 4.2, 4.4, 9.2**

  - [x] 3.3 Write property test for java binary path correctness
    - **Property 6: Java binary path correctness** — for any supported PlatformInfo, the java path is absolute, ends in `java`/`java.exe`, and is within `globalStorageUri/corretto/`
    - **Validates: Requirement 2.4**

  - [x] 3.4 Write property test for java verification output parsing
    - **Property 7: Java verification output parsing** — for any process result, verification succeeds iff exit code is 0 or stderr contains "version"
    - **Validates: Requirement 2.3**

- [x] 4. Implement ChromiumInstaller
  - [x] 4.1 Create `src/deps/chromiumInstaller.ts` implementing the `ChromiumInstaller` interface
    - Implement `install(storageDir, progress)`: set `PLAYWRIGHT_BROWSERS_PATH` to `storageDir/chromium/`, use Playwright's programmatic install API, fall back to CLI-based install
    - Implement `verify(storageDir)`: launch Chromium headlessly and confirm it starts
    - Implement `getBrowserPath(storageDir)`: return path to the chromium browser directory
    - _Requirements: 3.1, 3.2, 3.3, 9.3_

  - [x] 4.2 Write unit tests for ChromiumInstaller
    - Test that `PLAYWRIGHT_BROWSERS_PATH` is set correctly
    - Test verify logic with mocked Playwright launch
    - _Requirements: 3.1, 3.2, 3.3_

- [x] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement Manifest read/write and DependencyManager
  - [x] 6.1 Create `src/deps/manifest.ts` with `readManifest(storageDir)` and `writeManifest(storageDir, manifest)` functions
    - Read/parse JSON from `globalStorageUri/manifest.json`
    - Handle missing file (return empty manifest), corrupted JSON (return empty manifest)
    - Validate schema version number
    - Write manifest with proper serialization
    - _Requirements: 5.1, 5.4, 5.5_

  - [x] 6.2 Create `src/deps/dependencyManager.ts` implementing the `DependencyManager` class
    - Implement `ensureAll(context)`: read manifest, verify binaries on disk, install missing deps in parallel with `Promise.all`, write updated manifest, return `DependencyStatus`
    - Implement `getStatus(context)`: read manifest, verify binaries, return status without installing
    - Implement `reinstall(context)`: force re-download and re-extract both dependencies
    - Show `vscode.window.withProgress` notification during installation with descriptive messages
    - Handle partial failures: if one installer fails, let the other complete and report individual results
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 5.2, 5.3, 6.1, 6.2, 10.1, 10.2_

  - [x] 6.3 Write property test for orchestration correctness
    - **Property 1: Orchestration correctness** — for any manifest state and disk state, `ensureAll()` invokes installers only for missing/unverified dependencies
    - **Validates: Requirements 1.1, 1.2, 5.2, 5.3**

  - [x] 6.4 Write property test for manifest round-trip
    - **Property 2: Manifest round-trip after successful installation** — writing then reading a manifest produces an equivalent object with valid paths, schema version, and timestamps
    - **Validates: Requirements 1.4, 5.1, 5.4**

  - [x] 6.5 Write property test for corrupted manifest handling
    - **Property 3: Corrupted or missing manifest triggers fresh installation** — for any invalid manifest content, all dependencies are treated as not installed
    - **Validates: Requirement 5.5**

  - [x] 6.6 Write property test for independent parallel failure reporting
    - **Property 10: Independent parallel failure reporting** — for any combination of success/failure, each result is reported independently and a failure in one does not prevent the other
    - **Validates: Requirements 10.1, 10.2**

  - [x] 6.7 Write unit tests for DependencyManager
    - Test skip-when-present logic with mocked manifest and filesystem
    - Test install-when-missing with mocked installers
    - Test partial failure scenarios (one succeeds, one fails)
    - Test manifest written after successful install
    - _Requirements: 1.1, 1.2, 1.4, 5.2, 5.3, 6.1, 6.2, 10.1, 10.2_

- [x] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Integrate with extension activation and register Setup Dependencies command
  - [x] 8.1 Update `src/extension.ts` to call `DependencyManager.ensureAll()` on activation
    - Import and instantiate `DependencyManager`
    - Call `ensureAll(context)` before registering commands
    - On failure: show warning message suggesting "Setup Dependencies" command
    - Store resolved `DependencyStatus` for use by commands
    - _Requirements: 1.1, 1.2, 1.3, 6.1, 6.2_

  - [x] 8.2 Register `markdownStudio.setupDependencies` command in `src/extension.ts`
    - Call `DependencyManager.reinstall(context)` when invoked
    - Show success/failure notification on completion
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 8.3 Update `package.json` to register the new command and activation event
    - Add `markdownStudio.setupDependencies` to `contributes.commands` with title "Markdown Studio: Setup Dependencies"
    - Add `onCommand:markdownStudio.setupDependencies` to `activationEvents`
    - _Requirements: 7.1_

- [x] 9. Integrate with renderPlantUml and exportPdf
  - [x] 9.1 Update `src/renderers/renderPlantUml.ts` to use managed Corretto java path
    - Accept `DependencyStatus` or managed java path as parameter
    - Use managed java path when available, fall back to config `markdownStudio.java.path`
    - Show actionable error if PlantUML invoked but Corretto is missing
    - _Requirements: 2.5, 8.1, 6.3, 6.5_

  - [x] 9.2 Update `src/export/exportPdf.ts` to use managed Chromium browser path
    - Set `PLAYWRIGHT_BROWSERS_PATH` env var to managed chromium directory before launching
    - Show actionable error if PDF export invoked but Chromium is missing
    - _Requirements: 3.4, 8.2, 6.4, 6.5_

- [x] 10. Update validateEnvironment to include managed dependency status
  - [x] 10.1 Update `src/commands/validateEnvironmentCore.ts` to check managed dependencies
    - Add checks for managed Corretto (path exists, `java -version` works)
    - Add checks for managed Chromium (path exists)
    - Include managed dependency status lines in validation output
    - _Requirements: 8.3_

  - [x] 10.2 Update unit tests for validateEnvironmentCore
    - Test validation output includes managed dependency status
    - Test validation when managed deps are present vs missing
    - _Requirements: 8.3_

- [x] 11. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Graceful degradation and error handling
  - [x] 12.1 Ensure extension activates and registers all commands even when dependency installation fails
    - Verify activation flow catches installer errors and continues
    - Verify all commands are registered regardless of dependency status
    - _Requirements: 6.1, 6.3, 6.4_

  - [x] 12.2 Add actionable error messages when features are invoked with missing dependencies
    - PlantUML rendering: show error identifying missing Java and suggesting "Setup Dependencies"
    - PDF export: show error identifying missing Chromium and suggesting "Setup Dependencies"
    - _Requirements: 6.5_

  - [x] 12.3 Write property test for graceful degradation
    - **Property 8: Graceful degradation on install failure** — for any combination of installer failures, the extension completes activation, registers all commands, and DependencyStatus contains descriptive errors
    - **Validates: Requirements 6.1, 6.2**

  - [x] 12.4 Write property test for storage isolation
    - **Property 9: Storage isolation** — for any installation operation, all file write paths are within `globalStorageUri`
    - **Validates: Requirement 9.1**

  - [x] 12.5 Write property test for Unix file permissions
    - **Property 11: Unix file permissions** — for any extraction on macOS/Linux, the java executable permissions are no broader than 0o755
    - **Validates: Requirement 9.5**

- [x] 13. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- All new code goes under `src/deps/` to keep the dependency management module self-contained
- The design uses TypeScript throughout, matching the existing codebase
