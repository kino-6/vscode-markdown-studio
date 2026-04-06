import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mock vscode ---
const editBuilderReplace = vi.fn();
const editBuilderInsert = vi.fn();
const editorEdit = vi.fn().mockImplementation(async (cb: (builder: any) => void) => {
  cb({ replace: editBuilderReplace, insert: editBuilderInsert });
  return true;
});

let mockActiveEditor: any = undefined;

vi.mock('vscode', () => {
  class MockRange {
    constructor(
      public start: any,
      public end: any,
    ) {}
  }
  class MockPosition {
    constructor(
      public line: number,
      public character: number,
    ) {}
  }
  return {
    window: {
      get activeTextEditor() {
        return mockActiveEditor;
      },
    },
    workspace: {
      getConfiguration: () => ({
        get: (_key: string, fallback: unknown) => fallback,
        inspect: () => undefined,
      }),
    },
    Range: MockRange,
    Position: MockPosition,
  };
});

// --- Mock dependencies ---
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

const mockFindTocCommentMarkers = vi.fn();
const mockReplaceTocContent = vi.fn();
const mockWrapWithMarkers = vi.fn();
vi.mock('../../src/toc/tocCommentMarker', () => ({
  findTocCommentMarkers: (...args: any[]) => mockFindTocCommentMarkers(...args),
  replaceTocContent: (...args: any[]) => mockReplaceTocContent(...args),
  wrapWithMarkers: (...args: any[]) => mockWrapWithMarkers(...args),
}));

vi.mock('../../src/parser/scanFencedBlocks', () => ({
  scanFencedBlocks: () => [],
}));

vi.mock('../../src/parser/parseMarkdown', () => ({
  createMarkdownParser: () => ({}),
}));

vi.mock('../../src/infra/config', () => ({
  getConfig: () => ({
    toc: { minLevel: 1, maxLevel: 3, orderedList: false, pageBreak: true },
  }),
}));

// Import after mocks
import { insertTocCommand } from '../../src/commands/insertToc';

describe('insertTocCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockActiveEditor = undefined;
  });

  it('does nothing when no active editor', async () => {
    mockActiveEditor = undefined;
    await insertTocCommand();
    expect(mockExtractHeadings).not.toHaveBeenCalled();
  });

  it('does nothing when active file is not markdown', async () => {
    mockActiveEditor = {
      document: { languageId: 'javascript', getText: () => '', positionAt: (n: number) => ({ line: 0, character: n }) },
      selection: { active: { line: 0, character: 0 } },
      edit: editorEdit,
    };
    await insertTocCommand();
    expect(mockExtractHeadings).not.toHaveBeenCalled();
  });

  it('inserts new TOC at cursor position when no existing markers', async () => {
    const markdown = '# Hello\n\n## World\n';
    mockActiveEditor = {
      document: {
        languageId: 'markdown',
        getText: () => markdown,
        positionAt: (n: number) => ({ line: 0, character: n }),
      },
      selection: { active: { line: 1, character: 0 } },
      edit: editorEdit,
    };

    mockExtractHeadings.mockReturnValue([
      { level: 1, text: 'Hello', line: 0 },
      { level: 2, text: 'World', line: 2 },
    ]);
    mockResolveAnchors.mockReturnValue([
      { heading: { level: 1, text: 'Hello', line: 0 }, anchorId: 'hello' },
      { heading: { level: 2, text: 'World', line: 2 }, anchorId: 'world' },
    ]);
    mockBuildTocMarkdown.mockReturnValue('- [Hello](#hello)\n  - [World](#world)');
    mockFindTocCommentMarkers.mockReturnValue(undefined);
    mockWrapWithMarkers.mockReturnValue('<!-- TOC -->\n- [Hello](#hello)\n  - [World](#world)\n<!-- /TOC -->');

    await insertTocCommand();

    expect(mockWrapWithMarkers).toHaveBeenCalledWith('- [Hello](#hello)\n  - [World](#world)');
    expect(editorEdit).toHaveBeenCalled();
    expect(editBuilderInsert).toHaveBeenCalledWith(
      { line: 1, character: 0 },
      '<!-- TOC -->\n- [Hello](#hello)\n  - [World](#world)\n<!-- /TOC -->\n',
    );
  });

  it('replaces existing TOC when markers are found', async () => {
    const markdown = '# Doc\n<!-- TOC -->\n- [Old](#old)\n<!-- /TOC -->\n## New\n';
    mockActiveEditor = {
      document: {
        languageId: 'markdown',
        getText: () => markdown,
        positionAt: (n: number) => ({ line: 0, character: n }),
        get length() { return markdown.length; },
      },
      selection: { active: { line: 0, character: 0 } },
      edit: editorEdit,
    };

    mockExtractHeadings.mockReturnValue([
      { level: 1, text: 'Doc', line: 0 },
      { level: 2, text: 'New', line: 4 },
    ]);
    mockResolveAnchors.mockReturnValue([
      { heading: { level: 1, text: 'Doc', line: 0 }, anchorId: 'doc' },
      { heading: { level: 2, text: 'New', line: 4 }, anchorId: 'new' },
    ]);
    mockBuildTocMarkdown.mockReturnValue('- [Doc](#doc)\n  - [New](#new)');
    mockFindTocCommentMarkers.mockReturnValue({
      startLine: 1,
      endLine: 3,
      content: '- [Old](#old)',
    });
    mockReplaceTocContent.mockReturnValue(
      '# Doc\n<!-- TOC -->\n- [Doc](#doc)\n  - [New](#new)\n<!-- /TOC -->\n## New\n',
    );

    await insertTocCommand();

    expect(mockReplaceTocContent).toHaveBeenCalledWith(
      markdown,
      { startLine: 1, endLine: 3, content: '- [Old](#old)' },
      '- [Doc](#doc)\n  - [New](#new)',
    );
    expect(editorEdit).toHaveBeenCalled();
    expect(editBuilderReplace).toHaveBeenCalled();
  });

  it('inserts empty TOC section when no headings exist', async () => {
    const markdown = 'No headings here.\n';
    mockActiveEditor = {
      document: {
        languageId: 'markdown',
        getText: () => markdown,
        positionAt: (n: number) => ({ line: 0, character: n }),
      },
      selection: { active: { line: 0, character: 0 } },
      edit: editorEdit,
    };

    mockExtractHeadings.mockReturnValue([]);
    mockResolveAnchors.mockReturnValue([]);
    mockBuildTocMarkdown.mockReturnValue('');
    mockFindTocCommentMarkers.mockReturnValue(undefined);
    mockWrapWithMarkers.mockReturnValue('<!-- TOC -->\n<!-- /TOC -->');

    await insertTocCommand();

    expect(mockWrapWithMarkers).toHaveBeenCalledWith('');
    expect(editBuilderInsert).toHaveBeenCalledWith(
      { line: 0, character: 0 },
      '<!-- TOC -->\n<!-- /TOC -->\n',
    );
  });
});
