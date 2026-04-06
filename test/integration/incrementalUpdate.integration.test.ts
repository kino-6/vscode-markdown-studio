import { describe, it, expect, vi, beforeEach } from 'vitest';

/* ------------------------------------------------------------------ */
/*  Mock heavy external dependencies (PlantUML, Mermaid)               */
/*  but let the real rendering pipeline (renderBody → renderMarkdown   */
/*  → parseMarkdown → sanitizeHtml) run.                               */
/* ------------------------------------------------------------------ */

vi.mock('../../src/renderers/renderPlantUml', () => ({
  renderPlantUml: vi.fn(async () => ({ ok: false, error: 'PlantUML disabled in test' })),
  clearPlantUmlCache: vi.fn(),
}));

vi.mock('../../src/renderers/renderMermaid', () => ({
  renderMermaidBlock: vi.fn(async (src: string) => ({
    ok: true,
    placeholder: `<div class="mermaid-host" data-mermaid-src="${encodeURIComponent(src)}"></div>`,
  })),
  renderMermaidPlaceholder: vi.fn((src: string) =>
    `<div class="mermaid-host" data-mermaid-src="${encodeURIComponent(src)}"></div>`
  ),
  decodeMermaidAttribute: vi.fn((encoded: string) => decodeURIComponent(encoded)),
}));

/* ------------------------------------------------------------------ */
/*  Mock vscode API                                                    */
/* ------------------------------------------------------------------ */

type ChangeCallback = (event: {
  document: { uri: { toString: () => string }; getText: () => string };
  contentChanges: unknown[];
}) => Promise<void>;

let capturedChangeCallback: ChangeCallback | undefined;

function createMockWebview() {
  return {
    html: '',
    cspSource: 'mock-csp',
    asWebviewUri: (uri: { path: string }) => ({
      toString: () => `webview://${uri.path}`,
    }),
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
    dispose: vi.fn(() => disposeListeners.forEach((cb) => cb())),
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
      onDidChangeTextDocument: vi.fn((cb: ChangeCallback) => {
        capturedChangeCallback = cb;
        return { dispose: vi.fn() };
      }),
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
        path: parts
          .map((p) => (typeof p === 'string' ? p : p.path ?? ''))
          .join('/'),
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
    DiagnosticSeverity: { Error: 0, Warning: 1, Information: 2, Hint: 3 },
    Diagnostic: class {
      constructor(public range: unknown, public message: string, public severity: number) {}
      source = '';
    },
  };
});

vi.mock('../../src/commands/validateEnvironmentCore', () => ({
  validateEnvironment: vi.fn(async () => ({ ok: true, lines: ['✅ Java detected'] })),
}));

vi.mock('../../src/extension', () => ({
  dependencyStatus: undefined,
}));

/* ------------------------------------------------------------------ */
/*  Imports (after mocks are registered)                               */
/* ------------------------------------------------------------------ */

import {
  openOrRefreshPreview,
  _resetPanelForTesting,
} from '../../src/preview/webviewPanel';
import type * as vscode from 'vscode';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function fakeContext(): vscode.ExtensionContext {
  return {
    extensionUri: { path: '/ext' },
    extensionPath: '/ext',
  } as unknown as vscode.ExtensionContext;
}

function fakeDocument(
  uri = 'file:///test.md',
  text = '# Hello'
): vscode.TextDocument {
  return {
    getText: () => text,
    uri: { toString: () => uri },
    languageId: 'markdown',
  } as unknown as vscode.TextDocument;
}

/* ------------------------------------------------------------------ */
/*  Integration test                                                   */
/* ------------------------------------------------------------------ */

describe('Incremental update – end-to-end integration', () => {
  beforeEach(() => {
    _resetPanelForTesting();
    capturedChangeCallback = undefined;
    mockPanel = createMockPanel();
    vi.clearAllMocks();
  });

  it('posts update-body with rendered HTML when the tracked document changes', async () => {
    // 1. Open the preview (initial full-HTML load)
    const panel = await openOrRefreshPreview(
      fakeContext(),
      fakeDocument('file:///test.md', '# Hello')
    );

    // The initial load should set webview.html to a full HTML document
    expect(panel.webview.html).toContain('<!doctype html>');
    expect(panel.webview.html).toContain('Hello</h1>');

    // 2. The change handler should have been captured
    expect(capturedChangeCallback).toBeDefined();

    // 3. Simulate a document edit — the real renderBody pipeline runs
    await capturedChangeCallback!({
      document: {
        uri: { toString: () => 'file:///test.md' },
        getText: () => '## Updated heading',
      },
      contentChanges: [],
    });

    // 4. Verify postMessage was called with render-start + update-body
    expect(panel.webview.postMessage).toHaveBeenCalledTimes(2);

    const renderStartMsg = (panel.webview.postMessage as ReturnType<typeof vi.fn>)
      .mock.calls[0][0];
    expect(renderStartMsg.type).toBe('render-start');
    expect(renderStartMsg.generation).toBe(1);

    const message = (panel.webview.postMessage as ReturnType<typeof vi.fn>)
      .mock.calls[1][0];

    expect(message.type).toBe('update-body');
    expect(message.generation).toBe(1);

    // The body HTML should contain the rendered heading (real pipeline output)
    expect(message.html).toContain('Updated heading</h2>');

    // Body-only: no full-document wrapper tags
    expect(message.html).not.toContain('<!doctype');
    expect(message.html).not.toContain('<html');
    expect(message.html).not.toContain('<head');
    expect(message.html).not.toContain('<meta');
  });

  it('renders real Markdown through the full pipeline (paragraphs, emphasis, links)', async () => {
    await openOrRefreshPreview(
      fakeContext(),
      fakeDocument('file:///test.md', '# Start')
    );

    expect(capturedChangeCallback).toBeDefined();

    await capturedChangeCallback!({
      document: {
        uri: { toString: () => 'file:///test.md' },
        getText: () => 'Hello **bold** and *italic* with a [link](https://example.com)',
      },
      contentChanges: [],
    });

    const calls = (mockPanel.webview.postMessage as ReturnType<typeof vi.fn>).mock.calls;

    // render-start is sent first, then update-body
    expect(calls[0][0].type).toBe('render-start');

    const message = calls[1][0];
    expect(message.type).toBe('update-body');
    expect(message.html).toContain('<strong>bold</strong>');
    expect(message.html).toContain('<em>italic</em>');
    // Link text should be present (may be blocked/transformed by sanitizer config)
    expect(message.html).toContain('link');
  });

  it('increments generation across successive edits', async () => {
    await openOrRefreshPreview(
      fakeContext(),
      fakeDocument('file:///test.md', '# v1')
    );

    expect(capturedChangeCallback).toBeDefined();

    // First edit
    await capturedChangeCallback!({
      document: {
        uri: { toString: () => 'file:///test.md' },
        getText: () => '# v2',
      },
      contentChanges: [],
    });

    // Second edit
    await capturedChangeCallback!({
      document: {
        uri: { toString: () => 'file:///test.md' },
        getText: () => '# v3',
      },
      contentChanges: [],
    });

    const calls = (mockPanel.webview.postMessage as ReturnType<typeof vi.fn>).mock.calls;
    // Each edit sends render-start + update-body = 4 messages total
    expect(calls).toHaveLength(4);
    // First edit: render-start then update-body
    expect(calls[0][0].type).toBe('render-start');
    expect(calls[0][0].generation).toBe(1);
    expect(calls[1][0].type).toBe('update-body');
    expect(calls[1][0].generation).toBe(1);
    // Second edit: render-start then update-body
    expect(calls[2][0].type).toBe('render-start');
    expect(calls[2][0].generation).toBe(2);
    expect(calls[3][0].type).toBe('update-body');
    expect(calls[3][0].generation).toBe(2);
    expect(calls[3][0].html).toContain('v3</h1>');
  });
});
