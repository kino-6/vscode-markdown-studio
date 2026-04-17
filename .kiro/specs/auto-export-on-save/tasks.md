# Implementation Plan: Auto-Export on Save

## Overview

Implement a watch-mode feature that automatically exports Markdown files to PDF on save. The implementation adds three new modules (`ExportRegistry`, `AutoExportEngine`, `AutoExportStatusBar`), a new VS Code setting, a toggle command, and integrates them into the existing extension activation flow. The existing `exportToPdf` function is reused as-is.

## Tasks

- [x] 1. Add configuration and command declarations
  - [x] 1.1 Add `markdownStudio.export.autoExport` boolean setting to `package.json`
    - Add to `contributes.configuration.properties` with `type: "boolean"`, `default: false`, and a Japanese description
    - _Requirements: 1.1_
  - [x] 1.2 Add `markdownStudio.toggleAutoExport` command to `package.json`
    - Add to `contributes.commands` array with title `"Markdown Studio: Toggle Auto-Export"`
    - _Requirements: 6.3_

- [x] 2. Implement ExportRegistry
  - [x] 2.1 Create `src/autoExport/exportRegistry.ts`
    - Implement `ExportRegistry` class with a session-based `Set<string>` for tracking manually exported file paths
    - Implement `register(filePath: string)` to add a file to the session set
    - Implement `async isEligible(filePath: string)` that returns `true` if the file is in the session set OR a `.markdownstudio` file exists in the file's workspace folder
    - Implement `hasWorkspaceConfig(filePath: string)` private method using `fs.access` to check for `.markdownstudio`
    - Implement `clear()` to reset session history
    - Implement `hasSession(filePath: string)` for testability
    - _Requirements: 7.1, 7.2, 7.3, 7.4_
  - [x] 2.2 Write property test for ExportRegistry eligibility consistency
    - **Property 3: Registry Eligibility Consistency**
    - For any file path P, after `register(P)` is called, `isEligible(P)` always returns `true`. Before registration and without workspace config, `isEligible(P)` returns `false`.
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.4**
  - [x] 2.3 Write unit tests for ExportRegistry
    - Test `register` adds file to session set
    - Test `isEligible` returns false for unregistered file without workspace config
    - Test `clear` resets session history
    - Test `hasSession` reflects registration state
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [ ] 3. Implement AutoExportEngine
  - [ ] 3.1 Create `src/autoExport/autoExportEngine.ts`
    - Implement `AutoExportEngine` class with constructor accepting `vscode.ExtensionContext` and `ExportRegistry`
    - Implement `start()` that subscribes to `vscode.workspace.onDidSaveTextDocument`; idempotent if already started
    - Implement `stop()` that disposes the save listener, clears all debounce timers via `clearTimeout`, cancels in-progress exports, and clears the `pendingExports` map
    - Implement `onDocumentSaved(document)` handler: skip non-markdown files, check eligibility via registry, cancel existing pending export for the same file, set a new debounce timer of 1000ms
    - Implement `executeExport(document)` that calls `exportToPdf` via `vscode.window.withProgress` with `ProgressLocation.Notification`, shows success message with output path, catches errors and shows error notification (except `CancellationError`)
    - Use a `Map<string, PendingExport>` for per-file debounce timers with cancellation handles
    - Implement `dispose()` that calls `stop()`
    - _Requirements: 1.2, 1.3, 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 4.1, 4.2, 4.3, 5.1, 5.2, 5.3_
  - [ ] 3.2 Write property test for debounce consolidation
    - **Property 1: Debounce Consolidation**
    - For any sequence of N (N ≥ 1) save events for the same file within the debounce interval, exactly 1 export is triggered.
    - **Validates: Requirements 3.1, 3.2**
  - [ ] 3.3 Write property test for per-file timer independence
    - **Property 2: Per-File Timer Independence**
    - For any two distinct files A and B, a save event for file A does not affect the debounce timer or export execution for file B.
    - **Validates: Requirements 3.3**
  - [ ] 3.4 Write property test for engine state consistency
    - **Property 4: Engine State Consistency**
    - Calling `start()` when already started is idempotent. After `stop()`, no save events trigger exports and all pending timers are cleared.
    - **Validates: Requirements 1.2, 1.3**
  - [ ] 3.5 Write unit tests for AutoExportEngine
    - Test that `start()` subscribes to save events
    - Test that `stop()` disposes listener and clears timers
    - Test that non-markdown files are ignored
    - Test that ineligible files are skipped silently
    - Test that export errors show error notification
    - Test that `CancellationError` is handled silently
    - _Requirements: 1.2, 1.3, 2.1, 5.1, 5.3, 7.4_

- [ ] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Implement AutoExportStatusBar
  - [ ] 5.1 Create `src/autoExport/statusBarItem.ts`
    - Implement `AutoExportStatusBar` class that creates a `vscode.StatusBarItem` aligned right with priority 100
    - Set the item's command to `markdownStudio.toggleAutoExport`
    - Display `$(file-pdf) Auto-export: ON` text when enabled, hide when disabled
    - Listen for `onDidChangeConfiguration` affecting `markdownStudio.export.autoExport` and call `update()`
    - Implement `update()` to read current setting and show/hide accordingly
    - Implement `dispose()` to clean up the status bar item and config listener
    - _Requirements: 6.1, 6.2, 6.3, 6.4_
  - [ ] 5.2 Write unit tests for AutoExportStatusBar
    - Test that status bar item is visible when autoExport is true
    - Test that status bar item is hidden when autoExport is false
    - Test that the item's command is set to toggleAutoExport
    - _Requirements: 6.1, 6.2, 6.3_

- [ ] 6. Integrate into extension activation
  - [ ] 6.1 Wire up all components in `src/extension.ts`
    - Import `AutoExportEngine`, `ExportRegistry`, and `AutoExportStatusBar`
    - Instantiate `ExportRegistry`, `AutoExportEngine`, and `AutoExportStatusBar` in `activate()`
    - Read initial `markdownStudio.export.autoExport` setting and call `autoExportEngine.start()` if true
    - Register `onDidChangeConfiguration` listener to start/stop engine when setting changes
    - Register `markdownStudio.toggleAutoExport` command that reads current setting and updates it to the opposite value via `ConfigurationTarget.Workspace`
    - Push all disposables to `context.subscriptions`
    - _Requirements: 1.1, 1.2, 1.3, 6.3_
  - [ ] 6.2 Register exported files in ExportRegistry from `src/commands/exportPdf.ts`
    - After successful manual PDF export, call `exportRegistry.register(editor.document.uri.fsPath)`
    - Pass `ExportRegistry` instance to `exportPdfCommand` (update function signature to accept registry parameter)
    - _Requirements: 7.2_

- [ ] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Final integration verification
  - [ ] 8.1 Write integration tests for auto-export flow
    - Test end-to-end: enable setting → register file → simulate save → verify export triggered
    - Test that disabling setting stops monitoring
    - Test that unregistered files are skipped
    - _Requirements: 1.2, 1.3, 2.1, 7.1, 7.4_

- [ ] 9. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The existing `exportToPdf` function is reused without modification; all new logic is in the `src/autoExport/` directory
- TypeScript is used throughout, matching the existing codebase
- Test framework: vitest with fast-check for property tests (both already in devDependencies)
