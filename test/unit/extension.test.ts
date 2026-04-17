import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock vscode before any imports that use it
const showWarningMessage = vi.fn();
const showInformationMessage = vi.fn();
const showErrorMessage = vi.fn();
const registerCommand = vi.fn().mockReturnValue({ dispose: vi.fn() });
const subscriptionsPush = vi.fn();

const onWillSaveTextDocument = vi.fn().mockReturnValue({ dispose: vi.fn() });

vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: () => ({ get: (_: string, f: unknown) => f }),
    onWillSaveTextDocument,
  },
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
  Position: class { constructor(public line: number, public character: number) {} },
  Range: class { constructor(public start: any, public end: any) {} },
  TextEdit: { replace: vi.fn() },
}));

// Mock DependencyManager
const ensureAllMock = vi.fn();
const reinstallMock = vi.fn();
let isSetupInProgressValue = false;

vi.mock('../../src/deps/dependencyManager', () => ({
  DependencyManager: vi.fn().mockImplementation(() => ({
    ensureAll: ensureAllMock,
    reinstall: reinstallMock,
    get isSetupInProgress() { return isSetupInProgressValue; },
  })),
}));

// Mock other command imports to avoid side effects
vi.mock('../../src/commands/exportPdf', () => ({ exportPdfCommand: vi.fn() }));
vi.mock('../../src/commands/openPreview', () => ({ openPreviewCommand: vi.fn() }));
vi.mock('../../src/commands/validateEnvironment', () => ({ validateEnvironmentCommand: vi.fn() }));
vi.mock('../../src/commands/insertToc', () => ({ insertTocCommand: vi.fn() }));
vi.mock('../../src/infra/tempFiles', () => ({ cleanupTempFiles: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../../src/preview/webviewPanel', () => ({ destroyPreviewPanel: vi.fn() }));
vi.mock('../../src/parser/scanFencedBlocks', () => ({ scanFencedBlocks: vi.fn().mockReturnValue([]) }));
vi.mock('../../src/toc/tocCommentMarker', () => ({
  findTocCommentMarkers: vi.fn(),
  replaceTocContent: vi.fn(),
  wrapWithMarkers: vi.fn(),
}));
vi.mock('../../src/parser/parseMarkdown', () => ({ createMarkdownParser: vi.fn().mockReturnValue({}) }));
vi.mock('../../src/toc/extractHeadings', () => ({ extractHeadings: vi.fn().mockReturnValue([]) }));
vi.mock('../../src/toc/anchorResolver', () => ({ resolveAnchors: vi.fn().mockReturnValue([]) }));
vi.mock('../../src/toc/buildTocMarkdown', () => ({ buildTocMarkdown: vi.fn().mockReturnValue('') }));
vi.mock('../../src/infra/config', () => ({
  getConfig: () => ({
    toc: { minLevel: 1, maxLevel: 3, orderedList: false, pageBreak: true },
  }),
}));

describe('extension activation', () => {
  let context: any;

  beforeEach(() => {
    vi.clearAllMocks();
    isSetupInProgressValue = false;
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

    // 6 commands registered: openPreview, exportPdf, validateEnvironment, reloadPreview, setupDependencies, insertToc
    expect(registerCommand).toHaveBeenCalledTimes(6);
    expect(registerCommand).toHaveBeenCalledWith('markdownStudio.openPreview', expect.any(Function));
    expect(registerCommand).toHaveBeenCalledWith('markdownStudio.exportPdf', expect.any(Function));
    expect(registerCommand).toHaveBeenCalledWith('markdownStudio.validateEnvironment', expect.any(Function));
    expect(registerCommand).toHaveBeenCalledWith('markdownStudio.reloadPreview', expect.any(Function));
    expect(registerCommand).toHaveBeenCalledWith('markdownStudio.setupDependencies', expect.any(Function));
    expect(registerCommand).toHaveBeenCalledWith('markdownStudio.insertToc', expect.any(Function));
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
    expect(registerCommand).toHaveBeenCalledTimes(6);
  });

  it('still activates and registers commands when ensureAll throws', async () => {
    ensureAllMock.mockRejectedValue(new Error('unexpected crash'));

    const ext = await import('../../src/extension');
    await ext.activate(context);

    expect(showWarningMessage).toHaveBeenCalledWith(
      expect.stringContaining('unexpected crash')
    );
    // All commands still registered
    expect(registerCommand).toHaveBeenCalledTimes(6);
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

describe('checkDependency', () => {
  let context: any;

  beforeEach(() => {
    vi.clearAllMocks();
    isSetupInProgressValue = false;
    context = {
      globalStorageUri: { fsPath: '/tmp/test-storage' },
      subscriptions: { push: subscriptionsPush },
    };
  });

  it('returns true when chromium browserPath is available', async () => {
    ensureAllMock.mockResolvedValue({
      allReady: true,
      javaPath: '/path/to/java',
      browserPath: '/path/to/chromium',
      errors: [],
    });

    const ext = await import('../../src/extension');
    await ext.activate(context);

    expect(ext.checkDependency('chromium')).toBe(true);
    expect(showErrorMessage).not.toHaveBeenCalled();
  });

  it('returns true when java javaPath is available', async () => {
    ensureAllMock.mockResolvedValue({
      allReady: true,
      javaPath: '/path/to/java',
      browserPath: '/path/to/chromium',
      errors: [],
    });

    const ext = await import('../../src/extension');
    await ext.activate(context);

    expect(ext.checkDependency('java')).toBe(true);
    expect(showErrorMessage).not.toHaveBeenCalled();
  });

  it('returns false and shows error when chromium is missing', async () => {
    ensureAllMock.mockResolvedValue({
      allReady: false,
      javaPath: '/path/to/java',
      browserPath: undefined,
      errors: ['Chromium: failed'],
    });

    const ext = await import('../../src/extension');
    await ext.activate(context);
    showErrorMessage.mockClear();

    expect(ext.checkDependency('chromium')).toBe(false);
    expect(showErrorMessage).toHaveBeenCalledWith(
      expect.stringContaining('Chromium is not installed')
    );
    expect(showErrorMessage).toHaveBeenCalledWith(
      expect.stringContaining('Setup Dependencies')
    );
  });

  it('returns false and shows error when java is missing', async () => {
    ensureAllMock.mockResolvedValue({
      allReady: false,
      javaPath: undefined,
      browserPath: '/path/to/chromium',
      errors: ['Corretto: failed'],
    });

    const ext = await import('../../src/extension');
    await ext.activate(context);
    showErrorMessage.mockClear();

    expect(ext.checkDependency('java')).toBe(false);
    expect(showErrorMessage).toHaveBeenCalledWith(
      expect.stringContaining('Java (Corretto) is not installed')
    );
    expect(showErrorMessage).toHaveBeenCalledWith(
      expect.stringContaining('Setup Dependencies')
    );
  });

  it('returns false when dependencyStatus has no paths (ensureAll threw)', async () => {
    ensureAllMock.mockRejectedValue(new Error('network error'));

    const ext = await import('../../src/extension');
    await ext.activate(context);
    showErrorMessage.mockClear();

    expect(ext.checkDependency('chromium')).toBe(false);
    expect(showErrorMessage).toHaveBeenCalled();
  });
});

describe('exportPdf command gate', () => {
  let context: any;

  beforeEach(() => {
    vi.clearAllMocks();
    isSetupInProgressValue = false;
    context = {
      globalStorageUri: { fsPath: '/tmp/test-storage' },
      subscriptions: { push: subscriptionsPush },
    };
  });

  it('blocks exportPdf when chromium is not available', async () => {
    ensureAllMock.mockResolvedValue({
      allReady: false,
      javaPath: '/path/to/java',
      browserPath: undefined,
      errors: ['Chromium: failed'],
    });

    const ext = await import('../../src/extension');
    const { exportPdfCommand } = await import('../../src/commands/exportPdf');
    await ext.activate(context);

    const exportCall = registerCommand.mock.calls.find(
      (call: unknown[]) => call[0] === 'markdownStudio.exportPdf'
    );
    const handler = exportCall![1] as () => Promise<void>;
    await handler();

    expect(showErrorMessage).toHaveBeenCalledWith(
      expect.stringContaining('Chromium is not installed')
    );
    expect(exportPdfCommand).not.toHaveBeenCalled();
  });

  it('allows exportPdf when chromium is available', async () => {
    ensureAllMock.mockResolvedValue({
      allReady: true,
      javaPath: '/path/to/java',
      browserPath: '/path/to/chromium',
      errors: [],
    });

    const ext = await import('../../src/extension');
    const { exportPdfCommand } = await import('../../src/commands/exportPdf');
    await ext.activate(context);

    const exportCall = registerCommand.mock.calls.find(
      (call: unknown[]) => call[0] === 'markdownStudio.exportPdf'
    );
    const handler = exportCall![1] as () => Promise<void>;
    await handler();

    expect(showErrorMessage).not.toHaveBeenCalled();
    expect(exportPdfCommand).toHaveBeenCalledWith(context);
  });
});

describe('setupDependencies command gate', () => {
  let context: any;

  beforeEach(() => {
    vi.clearAllMocks();
    isSetupInProgressValue = false;
    context = {
      globalStorageUri: { fsPath: '/tmp/test-storage' },
      subscriptions: { push: subscriptionsPush },
    };
  });

  it('shows info message and returns early when setup is already in progress', async () => {
    ensureAllMock.mockResolvedValue({ allReady: true, errors: [] });

    const ext = await import('../../src/extension');
    await ext.activate(context);

    // Simulate setup in progress
    isSetupInProgressValue = true;

    const setupCall = registerCommand.mock.calls.find(
      (call: unknown[]) => call[0] === 'markdownStudio.setupDependencies'
    );
    const handler = setupCall![1] as () => Promise<void>;
    await handler();

    expect(reinstallMock).not.toHaveBeenCalled();
    expect(showInformationMessage).toHaveBeenCalledWith(
      expect.stringContaining('Setup is already in progress')
    );
  });

  it('proceeds with reinstall when setup is not in progress', async () => {
    ensureAllMock.mockResolvedValue({ allReady: true, errors: [] });
    reinstallMock.mockResolvedValue({
      allReady: true,
      javaPath: '/path/to/java',
      browserPath: '/path/to/chromium',
      errors: [],
    });

    const ext = await import('../../src/extension');
    await ext.activate(context);

    isSetupInProgressValue = false;

    const setupCall = registerCommand.mock.calls.find(
      (call: unknown[]) => call[0] === 'markdownStudio.setupDependencies'
    );
    const handler = setupCall![1] as () => Promise<void>;
    await handler();

    expect(reinstallMock).toHaveBeenCalledWith(context);
  });
});

describe('non-dependency commands are not blocked', () => {
  let context: any;

  beforeEach(() => {
    vi.clearAllMocks();
    isSetupInProgressValue = false;
    context = {
      globalStorageUri: { fsPath: '/tmp/test-storage' },
      subscriptions: { push: subscriptionsPush },
    };
  });

  it('openPreview command works regardless of dependency state', async () => {
    ensureAllMock.mockResolvedValue({
      allReady: false,
      javaPath: undefined,
      browserPath: undefined,
      errors: ['Corretto: failed', 'Chromium: failed'],
    });

    const ext = await import('../../src/extension');
    const { openPreviewCommand } = await import('../../src/commands/openPreview');
    await ext.activate(context);

    const previewCall = registerCommand.mock.calls.find(
      (call: unknown[]) => call[0] === 'markdownStudio.openPreview'
    );
    const handler = previewCall![1] as () => Promise<void>;
    await handler();

    expect(openPreviewCommand).toHaveBeenCalledWith(context);
    // No dependency error shown for preview
    expect(showErrorMessage).not.toHaveBeenCalled();
  });

  it('insertToc command works regardless of dependency state', async () => {
    ensureAllMock.mockResolvedValue({
      allReady: false,
      javaPath: undefined,
      browserPath: undefined,
      errors: ['Corretto: failed', 'Chromium: failed'],
    });

    const ext = await import('../../src/extension');
    const { insertTocCommand } = await import('../../src/commands/insertToc');
    await ext.activate(context);

    const tocCall = registerCommand.mock.calls.find(
      (call: unknown[]) => call[0] === 'markdownStudio.insertToc'
    );
    const handler = tocCall![1] as () => Promise<void>;
    await handler();

    expect(insertTocCommand).toHaveBeenCalled();
    expect(showErrorMessage).not.toHaveBeenCalled();
  });

  it('validateEnvironment command works regardless of dependency state', async () => {
    ensureAllMock.mockResolvedValue({
      allReady: false,
      javaPath: undefined,
      browserPath: undefined,
      errors: ['Corretto: failed', 'Chromium: failed'],
    });

    const ext = await import('../../src/extension');
    const { validateEnvironmentCommand } = await import('../../src/commands/validateEnvironment');
    await ext.activate(context);

    const validateCall = registerCommand.mock.calls.find(
      (call: unknown[]) => call[0] === 'markdownStudio.validateEnvironment'
    );
    const handler = validateCall![1] as () => Promise<void>;
    await handler();

    expect(validateEnvironmentCommand).toHaveBeenCalledWith(context);
    expect(showErrorMessage).not.toHaveBeenCalled();
  });
});
