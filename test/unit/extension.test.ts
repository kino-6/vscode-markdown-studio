import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock vscode before any imports that use it
const showWarningMessage = vi.fn();
const showInformationMessage = vi.fn();
const showErrorMessage = vi.fn();
const registerCommand = vi.fn().mockReturnValue({ dispose: vi.fn() });
const subscriptionsPush = vi.fn();

vi.mock('vscode', () => ({
  workspace: { getConfiguration: () => ({ get: (_: string, f: unknown) => f }) },
  window: {
    showInformationMessage,
    showWarningMessage,
    showErrorMessage,
    withProgress: vi.fn((_opts: unknown, task: (progress: unknown) => Promise<unknown>) =>
      task({ report: vi.fn() })
    ),
  },
  ProgressLocation: { Notification: 15 },
  commands: { registerCommand },
}));

// Mock DependencyManager
const ensureAllMock = vi.fn();
const reinstallMock = vi.fn();

vi.mock('../../src/deps/dependencyManager', () => ({
  DependencyManager: vi.fn().mockImplementation(() => ({
    ensureAll: ensureAllMock,
    reinstall: reinstallMock,
  })),
}));

// Mock other command imports to avoid side effects
vi.mock('../../src/commands/exportPdf', () => ({ exportPdfCommand: vi.fn() }));
vi.mock('../../src/commands/openPreview', () => ({ openPreviewCommand: vi.fn() }));
vi.mock('../../src/commands/validateEnvironment', () => ({ validateEnvironmentCommand: vi.fn() }));
vi.mock('../../src/infra/tempFiles', () => ({ cleanupTempFiles: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../../src/preview/webviewPanel', () => ({ destroyPreviewPanel: vi.fn() }));

describe('extension activation', () => {
  let context: any;

  beforeEach(() => {
    vi.clearAllMocks();
    context = {
      globalStorageUri: { fsPath: '/tmp/test-storage' },
      subscriptions: { push: subscriptionsPush },
    };
  });

  it('calls ensureAll on activation and registers all commands', async () => {
    ensureAllMock.mockResolvedValue({
      allReady: true,
      javaPath: '/path/to/java',
      browserPath: '/path/to/chromium',
      errors: [],
    });

    // Dynamic import to get fresh module state
    const ext = await import('../../src/extension');
    await ext.activate(context);

    expect(ensureAllMock).toHaveBeenCalledWith(context);
    expect(showWarningMessage).not.toHaveBeenCalled();

    // 5 commands registered: openPreview, exportPdf, validateEnvironment, reloadPreview, setupDependencies
    expect(registerCommand).toHaveBeenCalledTimes(5);
    expect(registerCommand).toHaveBeenCalledWith('markdownStudio.openPreview', expect.any(Function));
    expect(registerCommand).toHaveBeenCalledWith('markdownStudio.exportPdf', expect.any(Function));
    expect(registerCommand).toHaveBeenCalledWith('markdownStudio.validateEnvironment', expect.any(Function));
    expect(registerCommand).toHaveBeenCalledWith('markdownStudio.reloadPreview', expect.any(Function));
    expect(registerCommand).toHaveBeenCalledWith('markdownStudio.setupDependencies', expect.any(Function));
  });

  it('shows warning when ensureAll reports failures', async () => {
    ensureAllMock.mockResolvedValue({
      allReady: false,
      errors: ['Corretto: download timeout'],
    });

    const ext = await import('../../src/extension');
    await ext.activate(context);

    expect(showWarningMessage).toHaveBeenCalledWith(
      expect.stringContaining('Corretto: download timeout')
    );
    expect(showWarningMessage).toHaveBeenCalledWith(
      expect.stringContaining('Setup Dependencies')
    );
    // Commands still registered despite failure
    expect(registerCommand).toHaveBeenCalledTimes(5);
  });

  it('still activates and registers commands when ensureAll throws', async () => {
    ensureAllMock.mockRejectedValue(new Error('unexpected crash'));

    const ext = await import('../../src/extension');
    await ext.activate(context);

    expect(showWarningMessage).toHaveBeenCalledWith(
      expect.stringContaining('unexpected crash')
    );
    // All commands still registered
    expect(registerCommand).toHaveBeenCalledTimes(5);
  });

  it('setupDependencies command calls reinstall and shows success', async () => {
    ensureAllMock.mockResolvedValue({ allReady: true, errors: [] });
    reinstallMock.mockResolvedValue({
      allReady: true,
      javaPath: '/path/to/java',
      browserPath: '/path/to/chromium',
      errors: [],
    });

    const ext = await import('../../src/extension');
    await ext.activate(context);

    // Find the setupDependencies handler
    const setupCall = registerCommand.mock.calls.find(
      (call: unknown[]) => call[0] === 'markdownStudio.setupDependencies'
    );
    expect(setupCall).toBeDefined();

    const handler = setupCall![1] as () => Promise<void>;
    await handler();

    expect(reinstallMock).toHaveBeenCalledWith(context);
    expect(showInformationMessage).toHaveBeenCalledWith(
      expect.stringContaining('All dependencies installed successfully')
    );
  });

  it('setupDependencies command shows warning on partial failure', async () => {
    ensureAllMock.mockResolvedValue({ allReady: true, errors: [] });
    reinstallMock.mockResolvedValue({
      allReady: false,
      errors: ['Chromium: network error'],
    });

    const ext = await import('../../src/extension');
    await ext.activate(context);

    const setupCall = registerCommand.mock.calls.find(
      (call: unknown[]) => call[0] === 'markdownStudio.setupDependencies'
    );
    const handler = setupCall![1] as () => Promise<void>;
    await handler();

    expect(showWarningMessage).toHaveBeenCalledWith(
      expect.stringContaining('Chromium: network error')
    );
  });

  it('setupDependencies command shows error when reinstall throws', async () => {
    ensureAllMock.mockResolvedValue({ allReady: true, errors: [] });
    reinstallMock.mockRejectedValue(new Error('disk full'));

    const ext = await import('../../src/extension');
    await ext.activate(context);

    const setupCall = registerCommand.mock.calls.find(
      (call: unknown[]) => call[0] === 'markdownStudio.setupDependencies'
    );
    const handler = setupCall![1] as () => Promise<void>;
    await handler();

    expect(showErrorMessage).toHaveBeenCalledWith(
      expect.stringContaining('disk full')
    );
  });
});
