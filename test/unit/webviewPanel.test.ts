import { describe, it, expect, vi, beforeEach } from 'vitest';

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */

// Minimal mock helpers
function createMockWebview() {
  return {
    html: '',
    cspSource: 'mock-csp',
    asWebviewUri: (uri: { path: string }) => ({ toString: () => `webview://${uri.path}` }),
    postMessage: vi.fn(async () => true),
    onDidReceiveMessage: vi.fn(() => ({ dispose: vi.fn() })),
  };
}

function createMockPanel(webview = createMockWebview()) {
  const disposeListeners: Array<() => void> = [];
  return {
    webview,
    reveal: vi.fn(),
    onDidDispose: vi.fn((cb: () => void) => {
      disposeListeners.push(cb);
      return { dispose: vi.fn() };
    }),
    dispose: vi.fn(() => {
      disposeListeners.forEach((cb) => cb());
    }),
    _disposeListeners: disposeListeners,
  };
}

let mockPanel: ReturnType<typeof createMockPanel>;

vi.mock('vscode', () => {
  const configuration = { get: (_key: string, fallback: unknown) => fallback, inspect: (_key: string) => undefined };

  const mockDiagnosticCollection = {
    set: vi.fn(),
    dispose: vi.fn(),
    clear: vi.fn(),
  };

  return {
    workspace: {
      getConfiguration: () => configuration,
      onDidChangeTextDocument: vi.fn(() => ({ dispose: vi.fn() })),
      onDidChangeConfiguration: vi.fn(() => ({ dispose: vi.fn() })),
      createFileSystemWatcher: vi.fn(() => ({
        onDidChange: vi.fn(() => ({ dispose: vi.fn() })),
        onDidCreate: vi.fn(() => ({ dispose: vi.fn() })),
        onDidDelete: vi.fn(() => ({ dispose: vi.fn() })),
        dispose: vi.fn(),
      })),
    },
    window: {
      createWebviewPanel: vi.fn(() => mockPanel),
      showInformationMessage: vi.fn(),
      showWarningMessage: vi.fn(),
      showTextDocument: vi.fn(),
    },
    languages: {
      createDiagnosticCollection: vi.fn(() => mockDiagnosticCollection),
    },
    ViewColumn: { Beside: 2, One: 1 },
    Uri: {
      joinPath: (...parts: Array<{ path?: string } | string>) => ({
        path: parts.map((p) => (typeof p === 'string' ? p : p.path ?? '')).join('/'),
      }),
    },
    Range: class {
      constructor(public startLine: number, public startChar: number, public endLine: number, public endChar: number) {}
      get start() { return { line: this.startLine, character: this.startChar }; }
      get end() { return { line: this.endLine, character: this.endChar }; }
    },
    Selection: class {
      constructor(public anchor: unknown, public active: unknown) {}
    },
    TextEditorRevealType: { InCenter: 2 },
  };
});

// Mock buildHtml to avoid pulling in real renderer dependencies
vi.mock('../../src/preview/buildHtml', () => ({
  buildHtml: vi.fn(async () => '<html>mock</html>'),
  buildLoadingHtml: vi.fn(() => '<html>loading</html>'),
  renderBody: vi.fn(async () => '<h1>mock body</h1>'),
}));

vi.mock('../../src/preview/previewAssets', () => ({
  getPreviewAssetUris: vi.fn(() => ({
    styleUri: { toString: () => 'style.css' },
    scriptUri: { toString: () => 'script.js' },
  })),
}));

vi.mock('../../src/commands/validateEnvironmentCore', () => ({
  validateEnvironment: vi.fn(async () => ({ ok: true, lines: ['✅ Java detected'] })),
}));

vi.mock('../../src/extension', () => ({
  dependencyStatus: undefined,
}));

vi.mock('../../src/infra/config', () => ({
  getConfig: vi.fn(() => ({ javaPath: 'java', style: {}, theme: 'default', customCss: '' })),
}));

vi.mock('../../src/infra/customCssLoader', () => ({
  resolveThemePath: vi.fn(() => null),
}));

vi.mock('../../src/parser/parseMarkdown', () => ({
  createMarkdownParser: vi.fn(() => ({})),
}));

vi.mock('../../src/toc/extractHeadings', () => ({
  extractHeadings: vi.fn(() => []),
}));

vi.mock('../../src/toc/anchorResolver', () => ({
  resolveAnchors: vi.fn(() => []),
}));

vi.mock('../../src/toc/tocValidator', () => ({
  validateAnchors: vi.fn(() => []),
  publishDiagnostics: vi.fn(),
}));

/* ------------------------------------------------------------------ */
/*  Imports (after mocks)                                              */
/* ------------------------------------------------------------------ */

import { openOrRefreshPreview, _resetPanelForTesting } from '../../src/preview/webviewPanel';
import { renderBody, buildLoadingHtml } from '../../src/preview/buildHtml';
import { validateEnvironment } from '../../src/commands/validateEnvironmentCore';
import * as vscode from 'vscode';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function fakeContext(): vscode.ExtensionContext {
  return { extensionUri: { path: '/ext' } } as unknown as vscode.ExtensionContext;
}

function fakeDocument(uri = 'file:///test.md'): vscode.TextDocument {
  return {
    getText: () => '# Hello',
    uri: { toString: () => uri },
    languageId: 'markdown',
  } as unknown as vscode.TextDocument;
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('openOrRefreshPreview – panel reuse (R3/D3)', () => {
  beforeEach(() => {
    _resetPanelForTesting();
    mockPanel = createMockPanel();
    vi.clearAllMocks();
  });

  it('creates a new panel on first call', async () => {
    const panel = await openOrRefreshPreview(fakeContext(), fakeDocument());

    expect(vscode.window.createWebviewPanel).toHaveBeenCalledTimes(1);
    expect(panel).toBe(mockPanel);
  });

  it('reuses the existing panel on subsequent calls', async () => {
    await openOrRefreshPreview(fakeContext(), fakeDocument());
    const second = await openOrRefreshPreview(fakeContext(), fakeDocument('file:///other.md'));

    // createWebviewPanel should only have been called once
    expect(vscode.window.createWebviewPanel).toHaveBeenCalledTimes(1);
    expect(second).toBe(mockPanel);
    expect(mockPanel.reveal).toHaveBeenCalledTimes(1);
  });

  it('creates a new panel after the previous one is disposed', async () => {
    const first = await openOrRefreshPreview(fakeContext(), fakeDocument());

    // Simulate user closing the panel
    (first as unknown as ReturnType<typeof createMockPanel>).dispose();

    // Create a fresh mock for the next panel
    mockPanel = createMockPanel();
    (vscode.window.createWebviewPanel as ReturnType<typeof vi.fn>).mockReturnValue(mockPanel);

    const second = await openOrRefreshPreview(fakeContext(), fakeDocument());

    expect(vscode.window.createWebviewPanel).toHaveBeenCalledTimes(2);
    expect(second).toBe(mockPanel);
  });

  it('updates webview html content on reuse', async () => {
    const { buildHtml } = await import('../../src/preview/buildHtml');

    const panel1 = await openOrRefreshPreview(fakeContext(), fakeDocument());
    expect(buildHtml).toHaveBeenCalledTimes(1);
    expect(panel1.webview.html).toBe('<html>mock</html>');

    const panel2 = await openOrRefreshPreview(fakeContext(), fakeDocument());
    expect(buildHtml).toHaveBeenCalledTimes(2);
    // Same panel is returned, html was refreshed
    expect(panel2).toBe(panel1);
    expect(panel2.webview.html).toBe('<html>mock</html>');
  });
});

/* ------------------------------------------------------------------ */
/*  Message handler registration tests (Task 7.1)                      */
/* ------------------------------------------------------------------ */

describe('onDidReceiveMessage registration (R4.1/R6.1/R6.2)', () => {
  beforeEach(() => {
    _resetPanelForTesting();
    mockPanel = createMockPanel();
    vi.clearAllMocks();
    // Ensure createWebviewPanel returns the current mockPanel (may have been
    // overridden by mockReturnValue in a previous test).
    (vscode.window.createWebviewPanel as ReturnType<typeof vi.fn>).mockImplementation(() => mockPanel);
  });

  it('registers onDidReceiveMessage when a new panel is created', async () => {
    const panel = await openOrRefreshPreview(fakeContext(), fakeDocument());

    expect(panel).toBe(mockPanel);
    expect(mockPanel.webview.onDidReceiveMessage).toHaveBeenCalledTimes(1);
    expect(mockPanel.webview.onDidReceiveMessage).toHaveBeenCalledWith(expect.any(Function));
  });

  it('disposes old message listener and re-registers when panel is reused with a different document', async () => {
    // Track the dispose function from the first registration
    const firstDispose = vi.fn();
    mockPanel.webview.onDidReceiveMessage = vi.fn(() => ({ dispose: firstDispose }));

    await openOrRefreshPreview(fakeContext(), fakeDocument('file:///first.md'));
    expect(mockPanel.webview.onDidReceiveMessage).toHaveBeenCalledTimes(1);
    expect(firstDispose).not.toHaveBeenCalled();

    // Reuse panel with a different document
    await openOrRefreshPreview(fakeContext(), fakeDocument('file:///second.md'));

    // Old subscription should have been disposed
    expect(firstDispose).toHaveBeenCalledTimes(1);
    // New subscription should have been registered
    expect(mockPanel.webview.onDidReceiveMessage).toHaveBeenCalledTimes(2);
  });

  it('disposes messageSubscription when the panel is disposed', async () => {
    const msgDispose = vi.fn();
    mockPanel.webview.onDidReceiveMessage = vi.fn(() => ({ dispose: msgDispose }));

    const panel = await openOrRefreshPreview(fakeContext(), fakeDocument());
    expect(msgDispose).not.toHaveBeenCalled();

    // Simulate user closing the panel
    (panel as unknown as ReturnType<typeof createMockPanel>).dispose();

    expect(msgDispose).toHaveBeenCalledTimes(1);
  });
});

/* ------------------------------------------------------------------ */
/*  Change handler tests (Task 2.5)                                    */
/* ------------------------------------------------------------------ */

/**
 * Helper: extract the most recently registered onDidChangeTextDocument callback.
 */
function getChangeHandler(): (event: { document: { uri: { toString: () => string }; getText: () => string } }) => Promise<void> {
  const calls = (vscode.workspace.onDidChangeTextDocument as ReturnType<typeof vi.fn>).mock.calls;
  expect(calls.length).toBeGreaterThan(0);
  return calls[calls.length - 1][0];
}

function fakeChangeEvent(uri = 'file:///test.md', text = '# Updated') {
  return {
    document: {
      uri: { toString: () => uri },
      getText: () => text,
    },
    contentChanges: [],
  };
}

describe('change handler – incremental updates (R1/R2/R3/R5/R6)', () => {
  beforeEach(() => {
    _resetPanelForTesting();
    mockPanel = createMockPanel();
    vi.clearAllMocks();
    // Reset renderBody to default behavior
    (renderBody as ReturnType<typeof vi.fn>).mockResolvedValue('<h1>mock body</h1>');
  });

  it('matching URI fires postMessage with render-start then update-body', async () => {
    const panel = await openOrRefreshPreview(fakeContext(), fakeDocument('file:///test.md'));

    const handler = getChangeHandler();
    await handler(fakeChangeEvent('file:///test.md'));

    expect(panel.webview.postMessage).toHaveBeenCalledTimes(2);
    expect(panel.webview.postMessage).toHaveBeenNthCalledWith(1, {
      type: 'render-start',
      generation: 1,
    });
    expect(panel.webview.postMessage).toHaveBeenNthCalledWith(2, {
      type: 'update-body',
      html: '<h1>mock body</h1>',
      generation: 1,
    });
  });

  it('non-matching URI does not fire postMessage', async () => {
    const panel = await openOrRefreshPreview(fakeContext(), fakeDocument('file:///test.md'));

    const handler = getChangeHandler();
    await handler(fakeChangeEvent('file:///other.md'));

    expect(panel.webview.postMessage).not.toHaveBeenCalled();
  });

  it('generation counter prevents stale update (out-of-order async renders)', async () => {
    const panel = await openOrRefreshPreview(fakeContext(), fakeDocument('file:///test.md'));

    const handler = getChangeHandler();

    // Create two deferred promises to control resolution order
    let resolveFirst!: (value: string) => void;
    let resolveSecond!: (value: string) => void;
    const firstPromise = new Promise<string>((r) => { resolveFirst = r; });
    const secondPromise = new Promise<string>((r) => { resolveSecond = r; });

    (renderBody as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(firstPromise)
      .mockReturnValueOnce(secondPromise);

    // Fire two change events without awaiting
    const call1 = handler(fakeChangeEvent('file:///test.md', '# First'));
    const call2 = handler(fakeChangeEvent('file:///test.md', '# Second'));

    // Resolve the second (newer) render first
    resolveSecond('<h1>Second</h1>');
    await call2;

    // Now resolve the first (stale) render
    resolveFirst('<h1>First</h1>');
    await call1;

    // Both render-start messages are sent, but only the second update-body is posted
    const updateBodyCalls = (panel.webview.postMessage as ReturnType<typeof vi.fn>).mock.calls
      .filter((c: unknown[]) => (c[0] as { type: string }).type === 'update-body');
    expect(updateBodyCalls).toHaveLength(1);
    expect(updateBodyCalls[0][0]).toEqual(
      expect.objectContaining({ html: '<h1>Second</h1>' }),
    );
  });

  it('disposed panel does not receive postMessage', async () => {
    const panel = await openOrRefreshPreview(fakeContext(), fakeDocument('file:///test.md'));

    const handler = getChangeHandler();

    // Dispose the panel (triggers onDidDispose cleanup)
    (panel as unknown as ReturnType<typeof createMockPanel>).dispose();

    await handler(fakeChangeEvent('file:///test.md'));

    // postMessage should not have been called after dispose
    expect(panel.webview.postMessage).not.toHaveBeenCalled();
  });

  it('renderBody error sends render-start then render-error', async () => {
    const panel = await openOrRefreshPreview(fakeContext(), fakeDocument('file:///test.md'));

    const handler = getChangeHandler();

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    (renderBody as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('render failed'));

    await handler(fakeChangeEvent('file:///test.md'));

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[Markdown Studio] renderBody failed:',
      expect.any(Error),
    );
    expect(panel.webview.postMessage).toHaveBeenCalledTimes(2);
    expect(panel.webview.postMessage).toHaveBeenNthCalledWith(1, {
      type: 'render-start',
      generation: 1,
    });
    expect(panel.webview.postMessage).toHaveBeenNthCalledWith(2, {
      type: 'render-error',
      generation: 1,
    });

    consoleErrorSpy.mockRestore();
  });
});

/* ------------------------------------------------------------------ */
/*  render-start / render-error message tests (Task 5.6)               */
/* ------------------------------------------------------------------ */

describe('change handler – render-start and render-error messages', () => {
  beforeEach(() => {
    _resetPanelForTesting();
    mockPanel = createMockPanel();
    vi.clearAllMocks();
    (renderBody as ReturnType<typeof vi.fn>).mockResolvedValue('<h1>mock body</h1>');
  });

  it('sends render-start before calling renderBody()', async () => {
    const callOrder: string[] = [];

    (renderBody as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      // At the point renderBody is called, render-start should already have been sent
      callOrder.push('renderBody');
      return '<h1>mock body</h1>';
    });

    mockPanel.webview.postMessage = vi.fn(async (msg: { type: string }) => {
      callOrder.push(msg.type);
      return true;
    });

    await openOrRefreshPreview(fakeContext(), fakeDocument('file:///test.md'));
    const handler = getChangeHandler();
    await handler(fakeChangeEvent('file:///test.md'));

    expect(callOrder.indexOf('render-start')).toBeLessThan(callOrder.indexOf('renderBody'));
  });

  it('on renderBody() error with current generation, render-error is sent', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    (renderBody as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('fail'));

    const panel = await openOrRefreshPreview(fakeContext(), fakeDocument('file:///test.md'));
    const handler = getChangeHandler();
    await handler(fakeChangeEvent('file:///test.md'));

    const messages = (panel.webview.postMessage as ReturnType<typeof vi.fn>).mock.calls.map(
      (c: unknown[]) => c[0] as { type: string; generation: number },
    );
    expect(messages).toEqual([
      { type: 'render-start', generation: 1 },
      { type: 'render-error', generation: 1 },
    ]);

    consoleErrorSpy.mockRestore();
  });

  it('on renderBody() error with stale generation, render-error is NOT sent', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    let rejectFirst!: (err: Error) => void;
    const firstPromise = new Promise<string>((_, rej) => { rejectFirst = rej; });

    (renderBody as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(firstPromise)
      .mockResolvedValueOnce('<h1>Second</h1>');

    const panel = await openOrRefreshPreview(fakeContext(), fakeDocument('file:///test.md'));
    const handler = getChangeHandler();

    // Fire first change (will hang on renderBody)
    const call1 = handler(fakeChangeEvent('file:///test.md', '# First'));
    // Fire second change (advances generation)
    const call2 = handler(fakeChangeEvent('file:///test.md', '# Second'));

    await call2;

    // Now reject the first (stale) render
    rejectFirst(new Error('stale fail'));
    await call1;

    const messages = (panel.webview.postMessage as ReturnType<typeof vi.fn>).mock.calls.map(
      (c: unknown[]) => c[0] as { type: string },
    );
    // First render-start (gen 1), second render-start (gen 2), second update-body (gen 2)
    // No render-error for the stale first render
    const renderErrors = messages.filter((m) => m.type === 'render-error');
    expect(renderErrors).toHaveLength(0);

    consoleErrorSpy.mockRestore();
  });

  it('successful render sends render-start then update-body in order', async () => {
    const panel = await openOrRefreshPreview(fakeContext(), fakeDocument('file:///test.md'));
    const handler = getChangeHandler();
    await handler(fakeChangeEvent('file:///test.md'));

    const messages = (panel.webview.postMessage as ReturnType<typeof vi.fn>).mock.calls.map(
      (c: unknown[]) => c[0] as { type: string; generation: number },
    );
    expect(messages).toEqual([
      { type: 'render-start', generation: 1 },
      { type: 'update-body', html: '<h1>mock body</h1>', generation: 1 },
    ]);
  });
});


/* ------------------------------------------------------------------ */
/*  Integration tests: environment validation wiring (Task 6.5/6.6)    */
/* ------------------------------------------------------------------ */

describe('webviewPanel environment validation integration', () => {
  beforeEach(() => {
    _resetPanelForTesting();
    mockPanel = createMockPanel();
    vi.clearAllMocks();
    (vscode.window.createWebviewPanel as ReturnType<typeof vi.fn>).mockImplementation(() => mockPanel);
  });

  /**
   * Task 6.5: webviewPanel calls validateEnvironment and passes lines to buildLoadingHtml
   */
  it('calls validateEnvironment and passes lines to buildLoadingHtml on new panel', async () => {
    const envLines = ['✅ Java detected', '❌ Chromium missing'];
    (validateEnvironment as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      lines: envLines,
    });

    await openOrRefreshPreview(fakeContext(), fakeDocument());

    expect(validateEnvironment).toHaveBeenCalledTimes(1);
    expect(buildLoadingHtml).toHaveBeenCalledWith(
      mockPanel.webview,
      expect.any(Object),
      envLines,
    );
  });

  it('calls validateEnvironment and passes lines to buildLoadingHtml on panel reuse', async () => {
    // First call — create panel
    await openOrRefreshPreview(fakeContext(), fakeDocument());
    vi.clearAllMocks();

    const envLines = ['✅ Java detected (managed Corretto)'];
    (validateEnvironment as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      lines: envLines,
    });

    // Second call — reuse panel
    await openOrRefreshPreview(fakeContext(), fakeDocument('file:///other.md'));

    expect(validateEnvironment).toHaveBeenCalledTimes(1);
    expect(buildLoadingHtml).toHaveBeenCalledWith(
      mockPanel.webview,
      expect.any(Object),
      envLines,
    );
  });

  /**
   * Task 6.6: webviewPanel falls back to empty array when validateEnvironment throws
   */
  it('falls back to empty array when validateEnvironment throws on new panel', async () => {
    (validateEnvironment as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('Java binary not found'),
    );

    await openOrRefreshPreview(fakeContext(), fakeDocument());

    expect(validateEnvironment).toHaveBeenCalledTimes(1);
    expect(buildLoadingHtml).toHaveBeenCalledWith(
      mockPanel.webview,
      expect.any(Object),
      [],
    );
  });

  it('falls back to empty array when validateEnvironment throws on panel reuse', async () => {
    // First call — create panel
    await openOrRefreshPreview(fakeContext(), fakeDocument());
    vi.clearAllMocks();

    (validateEnvironment as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('timeout'),
    );

    // Second call — reuse panel
    await openOrRefreshPreview(fakeContext(), fakeDocument('file:///other.md'));

    expect(validateEnvironment).toHaveBeenCalledTimes(1);
    expect(buildLoadingHtml).toHaveBeenCalledWith(
      mockPanel.webview,
      expect.any(Object),
      [],
    );
  });
});
