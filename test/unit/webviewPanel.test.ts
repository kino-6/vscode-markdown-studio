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
  const configuration = { get: (_key: string, fallback: unknown) => fallback };

  return {
    workspace: {
      getConfiguration: () => configuration,
      onDidChangeTextDocument: vi.fn(() => ({ dispose: vi.fn() })),
    },
    window: {
      createWebviewPanel: vi.fn(() => mockPanel),
      showInformationMessage: vi.fn(),
      showWarningMessage: vi.fn(),
      showTextDocument: vi.fn(),
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
  renderBody: vi.fn(async () => '<h1>mock body</h1>'),
}));

vi.mock('../../src/preview/previewAssets', () => ({
  getPreviewAssetUris: vi.fn(() => ({
    styleUri: { toString: () => 'style.css' },
    scriptUri: { toString: () => 'script.js' },
  })),
}));

/* ------------------------------------------------------------------ */
/*  Imports (after mocks)                                              */
/* ------------------------------------------------------------------ */

import { openOrRefreshPreview, _resetPanelForTesting } from '../../src/preview/webviewPanel';
import { renderBody } from '../../src/preview/buildHtml';
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

  it('matching URI fires postMessage with { type: "update-body", html, generation }', async () => {
    const panel = await openOrRefreshPreview(fakeContext(), fakeDocument('file:///test.md'));

    const handler = getChangeHandler();
    await handler(fakeChangeEvent('file:///test.md'));

    expect(panel.webview.postMessage).toHaveBeenCalledTimes(1);
    expect(panel.webview.postMessage).toHaveBeenCalledWith({
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

    // Only the second (newer) render should have been posted
    expect(panel.webview.postMessage).toHaveBeenCalledTimes(1);
    expect(panel.webview.postMessage).toHaveBeenCalledWith(
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

  it('renderBody error is caught and logged, no postMessage call', async () => {
    const panel = await openOrRefreshPreview(fakeContext(), fakeDocument('file:///test.md'));

    const handler = getChangeHandler();

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    (renderBody as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('render failed'));

    await handler(fakeChangeEvent('file:///test.md'));

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[Markdown Studio] renderBody failed:',
      expect.any(Error),
    );
    expect(panel.webview.postMessage).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });
});
