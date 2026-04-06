import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Capture the onWillSaveTextDocument callback ---
let onWillSaveCallback: ((event: any) => void) | undefined;

const registerCommand = vi.fn().mockReturnValue({ dispose: vi.fn() });
const onWillSaveTextDocument = vi.fn().mockImplementation((cb: any) => {
  onWillSaveCallback = cb;
  return { dispose: vi.fn() };
});

vi.mock('vscode', () => {
  class MockPosition {
    constructor(public line: number, public character: number) {}
  }
  class MockRange {
    constructor(public start: any, public end: any) {}
  }
  class MockTextEdit {
    static replace(range: any, newText: string) {
      return { range, newText };
    }
  }
  return {
    workspace: {
      getConfiguration: () => ({
        get: (_key: string, fallback: unknown) => fallback,
        inspect: () => undefined,
      }),
      onWillSaveTextDocument,
    },
    window: {
      showInformationMessage: vi.fn(),
      showWarningMessage: vi.fn(),
      showErrorMessage: vi.fn(),
    },
    commands: { registerCommand },
    ProgressLocation: { Notification: 15 },
    Position: MockPosition,
    Range: MockRange,
    TextEdit: MockTextEdit,
  };
});

// --- Mock dependencies ---
const mockScanFencedBlocks = vi.fn().mockReturnValue([]);
vi.mock('../../src/parser/scanFencedBlocks', () => ({
  scanFencedBlocks: (...args: any[]) => mockScanFencedBlocks(...args),
}));

const mockFindTocCommentMarkers = vi.fn();
vi.mock('../../src/toc/tocCommentMarker', () => ({
  findTocCommentMarkers: (...args: any[]) => mockFindTocCommentMarkers(...args),
  replaceTocContent: vi.fn(),
  wrapWithMarkers: vi.fn(),
}));

const mockCreateMarkdownParser = vi.fn().mockReturnValue({});
vi.mock('../../src/parser/parseMarkdown', () => ({
  createMarkdownParser: (...args: any[]) => mockCreateMarkdownParser(...args),
}));

const mockExtractHeadings = vi.fn();
vi.mock('../../src/toc/extractHeadings', () => ({
  extractHeadings: (...args: any[]) => mockExtractHeadings(...args),
}));

const mockResolveAnchors = vi.fn();
vi.mock('../../src/toc/anchorResolver', () => ({
  resolveAnchors: (...args: any[]) => mockResolveAnchors(...args),
}));

const mockBuildTocMarkdown = vi.fn();
vi.mock('../../src/toc/buildTocMarkdown', () => ({
  buildTocMarkdown: (...args: any[]) => mockBuildTocMarkdown(...args),
}));

vi.mock('../../src/infra/config', () => ({
  getConfig: () => ({
    toc: { minLevel: 1, maxLevel: 3, orderedList: false, pageBreak: true },
  }),
}));

// Mock other imports used by extension.ts
const ensureAllMock = vi.fn().mockResolvedValue({ allReady: true, errors: [] });
vi.mock('../../src/deps/dependencyManager', () => ({
  DependencyManager: vi.fn().mockImplementation(() => ({
    ensureAll: ensureAllMock,
    reinstall: vi.fn(),
  })),
}));
vi.mock('../../src/commands/exportPdf', () => ({ exportPdfCommand: vi.fn() }));
vi.mock('../../src/commands/openPreview', () => ({ openPreviewCommand: vi.fn() }));
vi.mock('../../src/commands/validateEnvironment', () => ({ validateEnvironmentCommand: vi.fn() }));
vi.mock('../../src/commands/insertToc', () => ({ insertTocCommand: vi.fn() }));
vi.mock('../../src/infra/tempFiles', () => ({ cleanupTempFiles: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../../src/preview/webviewPanel', () => ({ destroyPreviewPanel: vi.fn() }));

describe('TOC auto-update on save', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    onWillSaveCallback = undefined;

    // Activate extension to register the onWillSaveTextDocument listener
    const ext = await import('../../src/extension');
    await ext.activate({
      globalStorageUri: { fsPath: '/tmp/test' },
      subscriptions: { push: vi.fn() },
    } as any);
  });

  it('applies edit when markers present and content changed', () => {
    expect(onWillSaveCallback).toBeDefined();

    const markdown = '# Title\n<!-- TOC -->\n- [Old](#old)\n<!-- /TOC -->\n## New Section\n';
    mockFindTocCommentMarkers.mockReturnValue({
      startLine: 1,
      endLine: 3,
      content: '- [Old](#old)',
    });
    mockExtractHeadings.mockReturnValue([
      { level: 1, text: 'Title', line: 0 },
      { level: 2, text: 'New Section', line: 4 },
    ]);
    mockResolveAnchors.mockReturnValue([
      { heading: { level: 1, text: 'Title', line: 0 }, anchorId: 'title' },
      { heading: { level: 2, text: 'New Section', line: 4 }, anchorId: 'new-section' },
    ]);
    mockBuildTocMarkdown.mockReturnValue('- [Title](#title)\n  - [New Section](#new-section)');

    const waitUntil = vi.fn();
    const event = {
      document: { languageId: 'markdown', getText: () => markdown },
      waitUntil,
    };

    onWillSaveCallback!(event);

    expect(waitUntil).toHaveBeenCalledTimes(1);
    const promise = waitUntil.mock.calls[0][0];
    expect(promise).toBeInstanceOf(Promise);
  });

  it('skips edit when markers present but content unchanged', () => {
    expect(onWillSaveCallback).toBeDefined();

    const tocContent = '- [Title](#title)';
    const markdown = `# Title\n<!-- TOC -->\n${tocContent}\n<!-- /TOC -->\n`;
    mockFindTocCommentMarkers.mockReturnValue({
      startLine: 1,
      endLine: 3,
      content: tocContent,
    });
    mockExtractHeadings.mockReturnValue([{ level: 1, text: 'Title', line: 0 }]);
    mockResolveAnchors.mockReturnValue([
      { heading: { level: 1, text: 'Title', line: 0 }, anchorId: 'title' },
    ]);
    mockBuildTocMarkdown.mockReturnValue(tocContent);

    const waitUntil = vi.fn();
    const event = {
      document: { languageId: 'markdown', getText: () => markdown },
      waitUntil,
    };

    onWillSaveCallback!(event);

    expect(waitUntil).not.toHaveBeenCalled();
  });

  it('skips processing when no markers present', () => {
    expect(onWillSaveCallback).toBeDefined();

    const markdown = '# Title\n\nSome content\n';
    mockFindTocCommentMarkers.mockReturnValue(undefined);

    const waitUntil = vi.fn();
    const event = {
      document: { languageId: 'markdown', getText: () => markdown },
      waitUntil,
    };

    onWillSaveCallback!(event);

    expect(waitUntil).not.toHaveBeenCalled();
    expect(mockExtractHeadings).not.toHaveBeenCalled();
  });

  it('skips processing for non-markdown files', () => {
    expect(onWillSaveCallback).toBeDefined();

    const waitUntil = vi.fn();
    const event = {
      document: { languageId: 'javascript', getText: () => 'const x = 1;' },
      waitUntil,
    };

    onWillSaveCallback!(event);

    expect(waitUntil).not.toHaveBeenCalled();
    expect(mockScanFencedBlocks).not.toHaveBeenCalled();
    expect(mockFindTocCommentMarkers).not.toHaveBeenCalled();
  });
});
