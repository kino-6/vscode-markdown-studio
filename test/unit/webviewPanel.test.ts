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
    },
    ViewColumn: { Beside: 2 },
    Uri: {
      joinPath: (...parts: Array<{ path?: string } | string>) => ({
        path: parts.map((p) => (typeof p === 'string' ? p : p.path ?? '')).join('/'),
      }),
    },
  };
});

// Mock buildHtml to avoid pulling in real renderer dependencies
vi.mock('../../src/preview/buildHtml', () => ({
  buildHtml: vi.fn(async () => '<html>mock</html>'),
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
