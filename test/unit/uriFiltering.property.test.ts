import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */

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
import * as vscode from 'vscode';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const TRACKED_URI = 'file:///test.md';

function fakeContext(): vscode.ExtensionContext {
  return { extensionUri: { path: '/ext' } } as unknown as vscode.ExtensionContext;
}

function fakeDocument(uri = TRACKED_URI): vscode.TextDocument {
  return {
    getText: () => '# Hello',
    uri: { toString: () => uri },
    languageId: 'markdown',
  } as unknown as vscode.TextDocument;
}

function getChangeHandler(): (event: { document: { uri: { toString: () => string }; getText: () => string } }) => Promise<void> {
  const calls = (vscode.workspace.onDidChangeTextDocument as ReturnType<typeof vi.fn>).mock.calls;
  expect(calls.length).toBeGreaterThan(0);
  return calls[calls.length - 1][0];
}

function fakeChangeEvent(uri: string) {
  return {
    document: {
      uri: { toString: () => uri },
      getText: () => '# Some content',
    },
    contentChanges: [],
  };
}

/* ------------------------------------------------------------------ */
/*  Property 3: URI filtering                                          */
/* ------------------------------------------------------------------ */

/**
 * Property 3: URI filtering
 *
 * For any text change event whose document URI does not match the
 * Tracked_URI, the Change_Handler shall not post any message to the
 * Preview_Panel.
 *
 * **Validates: Requirement 2.1**
 */
describe('Property 3: URI filtering', () => {
  beforeEach(() => {
    _resetPanelForTesting();
    mockPanel = createMockPanel();
    vi.clearAllMocks();
  });

  it('change events with non-matching URIs never trigger postMessage', async () => {
    await openOrRefreshPreview(fakeContext(), fakeDocument(TRACKED_URI));
    const handler = getChangeHandler();

    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }).filter((s) => s !== TRACKED_URI),
        async (randomUri) => {
          mockPanel.webview.postMessage.mockClear();

          await handler(fakeChangeEvent(randomUri));

          expect(mockPanel.webview.postMessage).not.toHaveBeenCalled();
        },
      ),
      { numRuns: 200 },
    );
  });

  it('file-scheme URIs that differ from tracked URI are filtered out', async () => {
    await openOrRefreshPreview(fakeContext(), fakeDocument(TRACKED_URI));
    const handler = getChangeHandler();

    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }).map((s) => `file:///${s}`).filter((uri) => uri !== TRACKED_URI),
        async (fileUri) => {
          mockPanel.webview.postMessage.mockClear();

          await handler(fakeChangeEvent(fileUri));

          expect(mockPanel.webview.postMessage).not.toHaveBeenCalled();
        },
      ),
      { numRuns: 200 },
    );
  });

  it('URIs with various schemes that differ from tracked URI are filtered out', async () => {
    await openOrRefreshPreview(fakeContext(), fakeDocument(TRACKED_URI));
    const handler = getChangeHandler();

    const schemeArb = fc.constantFrom('file', 'untitled', 'vscode-notebook', 'http', 'https', 'git');
    const pathArb = fc.string({ minLength: 1 });
    const uriArb = fc.tuple(schemeArb, pathArb)
      .map(([scheme, path]) => `${scheme}:///${path}`)
      .filter((uri) => uri !== TRACKED_URI);

    await fc.assert(
      fc.asyncProperty(uriArb, async (uri) => {
        mockPanel.webview.postMessage.mockClear();

        await handler(fakeChangeEvent(uri));

        expect(mockPanel.webview.postMessage).not.toHaveBeenCalled();
      }),
      { numRuns: 200 },
    );
  });
});
