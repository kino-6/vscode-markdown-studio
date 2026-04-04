# Requirements Document

## Introduction

Markdown Studio requires two external runtime dependencies — a Java runtime (for PlantUML rendering) and a Chromium browser (for PDF export) — that users currently install and configure manually. This feature automates the download, extraction, verification, and configuration of Amazon Corretto 21 LTS and Playwright Chromium so that the extension works out of the box, with zero manual environment setup. All managed binaries are stored in the extension's `globalStorageUri`, are platform-aware, and are idempotent across activations.

## Glossary

- **DependencyManager**: The orchestrator component that coordinates dependency installation, manifest management, and status reporting.
- **CorrettoInstaller**: The component responsible for downloading, extracting, and verifying the Amazon Corretto JDK.
- **ChromiumInstaller**: The component responsible for installing and verifying the Playwright Chromium browser.
- **PlatformDetector**: The component that identifies the current operating system and CPU architecture.
- **Manifest**: A JSON file (`manifest.json`) stored in `globalStorageUri` that records the installed state of each dependency (paths, versions, timestamps).
- **globalStorageUri**: A VS Code-provided directory scoped to the extension that persists across extension updates.
- **Extension**: The Markdown Studio VS Code extension.
- **Setup_Command**: The "Markdown Studio: Setup Dependencies" VS Code command for manual dependency installation or retry.

## Requirements

### Requirement 1: Automatic Dependency Setup on Activation

**User Story:** As a user, I want dependencies to be automatically downloaded and configured when I first activate the extension, so that I can start writing design docs without manual environment setup.

#### Acceptance Criteria

1. WHEN the Extension activates and the Manifest indicates missing dependencies, THE DependencyManager SHALL download and install the missing dependencies automatically.
2. WHEN the Extension activates and the Manifest indicates all dependencies are present and verified, THE DependencyManager SHALL skip installation and return the existing dependency paths without making network calls.
3. WHEN dependency installation is in progress, THE Extension SHALL display a VS Code progress notification with descriptive status messages for each installation step.
4. WHEN dependency installation completes successfully, THE DependencyManager SHALL write an updated Manifest to globalStorageUri recording the installed paths, versions, and timestamps.

### Requirement 2: Amazon Corretto JDK Installation

**User Story:** As a user, I want the extension to automatically provide a Java runtime, so that PlantUML rendering works without me installing Java manually.

#### Acceptance Criteria

1. WHEN Corretto installation is triggered, THE CorrettoInstaller SHALL download the Amazon Corretto 21 LTS archive from the official corretto.aws HTTPS endpoint for the detected platform.
2. WHEN the Corretto archive has been downloaded, THE CorrettoInstaller SHALL extract the archive into the `globalStorageUri/corretto/` directory.
3. WHEN extraction completes, THE CorrettoInstaller SHALL verify the installation by executing `java -version` on the extracted binary and confirming a successful response.
4. WHEN Corretto installation succeeds, THE CorrettoInstaller SHALL return the absolute path to the `java` executable.
5. WHEN Corretto installation succeeds, THE Extension SHALL use the managed Corretto java path for PlantUML rendering instead of the default system java path.
6. WHEN the Corretto archive download completes, THE CorrettoInstaller SHALL delete the downloaded archive file to reclaim disk space.

### Requirement 3: Playwright Chromium Installation

**User Story:** As a user, I want the extension to automatically provide a Chromium browser, so that PDF export works without me installing a browser manually.

#### Acceptance Criteria

1. WHEN Chromium installation is triggered, THE ChromiumInstaller SHALL install Playwright's Chromium browser into the `globalStorageUri/chromium/` directory.
2. WHEN Chromium installation completes, THE ChromiumInstaller SHALL verify the installation by launching the browser headlessly and confirming it starts successfully.
3. WHEN Chromium installation succeeds, THE ChromiumInstaller SHALL return the path to the Chromium browser directory.
4. WHEN Chromium installation succeeds, THE Extension SHALL set the `PLAYWRIGHT_BROWSERS_PATH` environment variable to the managed Chromium directory for PDF export operations.

### Requirement 4: Platform Detection

**User Story:** As a user on any supported operating system, I want the extension to detect my platform and download the correct binaries, so that dependencies work on my machine.

#### Acceptance Criteria

1. THE PlatformDetector SHALL support the following OS and architecture combinations: macOS arm64, macOS x64, Linux x64, and Windows x64.
2. WHEN the PlatformDetector runs on a supported platform, THE PlatformDetector SHALL return a PlatformInfo object containing the OS identifier, architecture identifier, and correct archive extension (`tar.gz` for macOS and Linux, `zip` for Windows).
3. WHEN the PlatformDetector runs on an unsupported platform, THE PlatformDetector SHALL throw an error that lists all supported platform combinations.
4. WHEN building the Corretto download URL, THE CorrettoInstaller SHALL use the PlatformInfo to construct the platform-specific URL matching the Amazon Corretto download pattern.

### Requirement 5: Manifest-Based Idempotency

**User Story:** As a user, I want the extension to remember what it has already installed, so that subsequent activations are fast and do not re-download dependencies.

#### Acceptance Criteria

1. THE DependencyManager SHALL store the dependency Manifest as a JSON file at `globalStorageUri/manifest.json`.
2. WHEN the Manifest indicates a dependency is installed, THE DependencyManager SHALL verify the recorded binary path exists on disk before treating the dependency as present.
3. WHEN the Manifest indicates a dependency is installed but the binary file is missing from disk, THE DependencyManager SHALL treat the dependency as not installed and trigger re-installation.
4. THE Manifest SHALL include a schema version number to support future schema migrations.
5. WHEN the Manifest file is missing or corrupted, THE DependencyManager SHALL treat all dependencies as not installed and proceed with fresh installation.

### Requirement 6: Graceful Degradation on Failure

**User Story:** As a user in a restricted network environment, I want the extension to still activate and provide available features even when dependency installation fails, so that I am not completely blocked.

#### Acceptance Criteria

1. IF a dependency installation fails, THEN THE Extension SHALL still activate and register all commands.
2. IF a dependency installation fails, THEN THE Extension SHALL display a warning message that identifies the failed dependency and suggests running the Setup_Command to retry.
3. IF the Corretto installation fails, THEN THE Extension SHALL allow all features except PlantUML rendering to function normally.
4. IF the Chromium installation fails, THEN THE Extension SHALL allow all features except PDF export to function normally.
5. IF a user invokes a feature that requires a missing dependency, THEN THE Extension SHALL display an actionable error message identifying the missing dependency and how to install it.

### Requirement 7: Manual Setup Command

**User Story:** As a user, I want a command to manually trigger dependency installation, so that I can retry after a failure or force a reinstall.

#### Acceptance Criteria

1. THE Extension SHALL register a "Markdown Studio: Setup Dependencies" command in the VS Code command palette.
2. WHEN a user invokes the Setup_Command, THE DependencyManager SHALL re-run the full dependency installation process, re-downloading and re-extracting dependencies as needed.
3. WHEN the Setup_Command completes, THE Extension SHALL display a notification indicating whether the installation succeeded or failed.

### Requirement 8: Integration with Existing Features

**User Story:** As a user, I want PlantUML rendering and PDF export to seamlessly use the managed dependencies, so that existing features work without additional configuration.

#### Acceptance Criteria

1. WHEN PlantUML rendering is invoked and managed Corretto is available, THE Extension SHALL use the managed java path from the DependencyManager instead of the default `markdownStudio.java.path` configuration value.
2. WHEN PDF export is invoked and managed Chromium is available, THE Extension SHALL configure Playwright to use the managed Chromium browser path.
3. WHEN the validateEnvironment command is invoked, THE Extension SHALL include the status of managed dependencies (Corretto and Chromium) in the validation output.

### Requirement 9: Storage and Security

**User Story:** As a corporate user, I want all managed binaries stored safely in user-scoped directories using only trusted download sources, so that the extension is safe for enterprise use.

#### Acceptance Criteria

1. THE DependencyManager SHALL store all managed binaries exclusively within the `globalStorageUri` directory.
2. THE CorrettoInstaller SHALL download archives only from HTTPS endpoints on the `corretto.aws` domain.
3. THE ChromiumInstaller SHALL download browsers only through Playwright's official distribution mechanism.
4. THE DependencyManager SHALL perform all file operations without requiring elevated system privileges.
5. WHEN extracting binaries on macOS or Linux, THE CorrettoInstaller SHALL set file permissions on the java executable to no broader than 0o755.

### Requirement 10: Parallel Installation

**User Story:** As a user, I want the initial setup to complete as quickly as possible, so that I can start working without a long wait.

#### Acceptance Criteria

1. WHEN both Corretto and Chromium need installation, THE DependencyManager SHALL run both installations in parallel to minimize total setup time.
2. IF one parallel installation fails, THEN THE DependencyManager SHALL allow the other installation to complete independently and report individual results.
