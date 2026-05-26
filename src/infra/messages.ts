export const RUNTIME_MESSAGES = {
  command: {
    openMarkdownFirst: 'Markdown Studio: Open a Markdown file first.',
  },

  customCss: {
    syntaxWarning: 'Markdown Studio: Custom CSS has syntax errors — rendering with default styles. Fix your CSS to apply it.',
    skippedForSyntaxErrors: 'Custom CSS was skipped due to syntax errors — rendering with default styles',
  },

  dependencies: {
    setupProgressTitle: 'Markdown Studio: Setting up dependencies',
    allInstalled: 'Markdown Studio: All dependencies installed successfully.',
    chromiumMissing: "Chromium is not installed. Run 'Markdown Studio: Setup Dependencies' to install it.",
    chromiumMissingAutomatic: "Markdown Studio: Chromium is not installed. Run 'Markdown Studio: Setup Dependencies' to install it automatically.",
    chromiumBrowserUnavailable: 'Chromium browser is not available. Run "Markdown Studio: Setup Dependencies" to install it automatically.',
    javaMissing: "Java (Corretto) is not installed. Run 'Markdown Studio: Setup Dependencies' to install it.",
    javaMissingAutomatic: "Java (Corretto) is not installed. Run 'Markdown Studio: Setup Dependencies' to install it automatically.",
    partialFailure: (errors: string[]): string =>
      `Markdown Studio: Some dependencies failed to install. ${errors.join('; ')}.`,
    partialFailureWithRetry: (errors: string[]): string =>
      `Markdown Studio: Some dependencies failed to install. ${errors.join('; ')}. Run "Markdown Studio: Setup Dependencies" to retry.`,
    setupFailed: (message: string): string =>
      `Markdown Studio: Dependency setup failed. ${message}`,
    setupFailedWithRetry: (message: string): string =>
      `Markdown Studio: Dependency setup failed. ${message}. Run "Markdown Studio: Setup Dependencies" to retry.`,
    javaVerificationFailed: (exitCode: number): string => `Java verification failed: exit code ${exitCode}`,
    javaVerificationError: (message: string): string => `Java verification error: ${message}`,
    correttoInstallFailed: (message: string): string => `Corretto installation failed: ${message}`,
    correttoVerificationFailed: (message: string): string => `Corretto verification failed: ${message}`,
    chromiumInstallFailed: (message: string): string => `Chromium install failed: ${message}`,
    chromiumInstallationFailed: (message: string): string => `Chromium installation failed: ${message}`,
    chromiumVerificationFailed: (message: string): string => `Chromium verification failed: ${message}`,
  },

  dependencyProgress: {
    downloadingCorretto: 'Downloading Amazon Corretto JDK...',
    extractingJdk: 'Extracting JDK...',
    verifyingJava: 'Verifying Java installation...',
    installingChromium: 'Installing Chromium browser...',
    verifyingChromium: 'Verifying Chromium installation...',
  },

  dependencyStatus: {
    correttoBinaryMissing: 'Corretto: binary missing from disk',
    correttoNotInstalled: 'Corretto: not installed',
    chromiumBinaryMissing: 'Chromium: binary missing from disk',
    chromiumNotInstalled: 'Chromium: not installed',
  },

  validation: {
    javaDetectedManaged: '✅ Java detected (managed Corretto)',
    javaDetectedSystem: '✅ Java detected (system)',
    javaMissing: '❌ Java missing or inaccessible',
    bundledPlantUmlJarFound: '✅ Bundled PlantUML jar found',
    bundledPlantUmlJarMissing: (jarPath: string): string => `❌ Bundled PlantUML jar missing at ${jarPath}`,
    tempDirectoryWritable: '✅ Temp directory writable',
    tempDirectoryNotWritable: '❌ Temp directory is not writable',
    managedChromiumAvailable: '✅ Managed Chromium browser available',
    managedChromiumUnavailable: '❌ Managed Chromium browser not available',
    summary: (lines: string[]): string => `Markdown Studio environment validation:\n${lines.join('\n')}`,
  },

  exportPdf: {
    progressTitle: 'Markdown Studio: Exporting PDF',
    success: (outputPath: string): string => `Markdown Studio: Exported PDF to ${outputPath}`,
    cancelled: 'Markdown Studio: Export cancelled.',
    failed: (message: string): string => `Markdown Studio PDF export failed: ${message}`,
    cancellationError: 'Export cancelled by user',
  },

  exportProfiles: {
    importSourcePlaceholder: 'Choose a recent settings export, or select a JSON file',
    importProfilePlaceholder: 'Choose settings to import',
    importTargetPlaceholder: 'Choose where to save the imported settings',
    userSettings: 'User Settings',
    workspaceSettings: 'Workspace Settings',
    importedSettings: (name: string): string => `Markdown Studio: Imported settings from ${name}.`,
    exportedSettings: 'Markdown Studio: Exported current settings.',
    importFailed: (message: string): string => `Markdown Studio settings import failed: ${message}`,
    exportFailed: (message: string): string => `Markdown Studio settings export failed: ${message}`,
    invalidJson: 'Invalid JSON file.',
  },

  exportProgress: {
    buildingHtml: 'Building HTML...',
    processingImages: 'Processing images...',
    launchingBrowser: 'Launching browser...',
    renderingDiagrams: 'Rendering diagrams...',
    renderingDiagramsElapsed: (elapsedSeconds: number): string => `Rendering diagrams... (${elapsedSeconds}s)`,
    diagramTimeoutProceeding: (elapsedSeconds: number): string =>
      `Diagram rendering timed out after ${elapsedSeconds}s — proceeding`,
    generatingTableOfContents: 'Generating table of contents...',
    renderingDiagramsPass2Elapsed: (elapsedSeconds: number): string =>
      `Rendering diagrams (pass 2)... (${elapsedSeconds}s)`,
    generatingPdf: 'Generating PDF...',
    addingBookmarks: 'Adding bookmarks...',
  },

  plantUml: {
    unsupportedMode: (mode: string): string =>
      `PlantUML mode '${mode}' is reserved for future MVP iterations.`,
    bundledJarMissing: (jarPath: string): string => `Bundled PlantUML jar missing at ${jarPath}`,
    timedOut: 'PlantUML rendering timed out.',
    failed: (message: string): string => `PlantUML rendering failed: ${message}`,
    missingSvg: 'PlantUML did not produce SVG output.',
  },

  render: {
    mermaidErrorTitle: 'Mermaid render error',
    plantUmlErrorTitle: 'PlantUML render error',
    unknownMermaidIssue: 'Unknown Mermaid rendering issue.',
    unknownPlantUmlIssue: 'Unknown PlantUML rendering issue.',
    unknownError: 'Unknown error',
  },
};
