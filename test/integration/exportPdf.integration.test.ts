import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:fs/promises', () => {
  const accessMock = vi.fn();
  const readFileMock = vi.fn();
  return { default: { access: accessMock, readFile: readFileMock }, __accessMock: accessMock, __readFileMock: readFileMock };
});

vi.mock('../../src/preview/buildHtml', () => {
  const buildHtmlMock = vi.fn();
  return { buildHtml: buildHtmlMock, buildLoadingHtml: vi.fn(() => '<html>loading</html>'), __buildHtmlMock: buildHtmlMock };
});

vi.mock('playwright', () => {
  const setContentMock = vi.fn();
  const pdfMock = vi.fn();
  const closeMock = vi.fn();
  const newPageMock = vi.fn();
  const launchMock = vi.fn();
  const evaluateMock = vi.fn();
  const addScriptTagMock = vi.fn();
  const waitForFunctionMock = vi.fn();
  const setViewportSizeMock = vi.fn();
  return {
    chromium: { launch: launchMock },
    __setContentMock: setContentMock,
    __pdfMock: pdfMock,
    __closeMock: closeMock,
    __newPageMock: newPageMock,
    __launchMock: launchMock,
    __evaluateMock: evaluateMock,
    __addScriptTagMock: addScriptTagMock,
    __waitForFunctionMock: waitForFunctionMock,
    __setViewportSizeMock: setViewportSizeMock,
  };
});

vi.mock('../../src/infra/config', () => {
  const getConfigMock = vi.fn();
  return { getConfig: getConfigMock, __getConfigMock: getConfigMock };
});

vi.mock('../../src/export/pdfBookmarks', () => {
  const addBookmarksMock = vi.fn();
  return { addBookmarks: addBookmarksMock, buildBookmarkTree: vi.fn(), __addBookmarksMock: addBookmarksMock };
});

vi.mock('../../src/infra/customCssLoader', () => ({
  loadCustomCss: vi.fn().mockResolvedValue({ css: '', warnings: [] }),
}));

import * as fsModule from 'node:fs/promises';
import * as buildHtmlModule from '../../src/preview/buildHtml';
import * as playwrightModule from 'playwright';
import * as configModule from '../../src/infra/config';
import * as pdfBookmarksModule from '../../src/export/pdfBookmarks';
import { exportToPdf } from '../../src/export/exportPdf';

const accessMock = (fsModule as any).__accessMock as ReturnType<typeof vi.fn>;
const readFileMock = (fsModule as any).__readFileMock as ReturnType<typeof vi.fn>;
const buildHtmlMock = (buildHtmlModule as any).__buildHtmlMock as ReturnType<typeof vi.fn>;
const setContentMock = (playwrightModule as any).__setContentMock as ReturnType<typeof vi.fn>;
const pdfMock = (playwrightModule as any).__pdfMock as ReturnType<typeof vi.fn>;
const closeMock = (playwrightModule as any).__closeMock as ReturnType<typeof vi.fn>;
const newPageMock = (playwrightModule as any).__newPageMock as ReturnType<typeof vi.fn>;
const launchMock = (playwrightModule as any).__launchMock as ReturnType<typeof vi.fn>;
const evaluateMock = (playwrightModule as any).__evaluateMock as ReturnType<typeof vi.fn>;
const addScriptTagMock = (playwrightModule as any).__addScriptTagMock as ReturnType<typeof vi.fn>;
const waitForFunctionMock = (playwrightModule as any).__waitForFunctionMock as ReturnType<typeof vi.fn>;
const setViewportSizeMock = (playwrightModule as any).__setViewportSizeMock as ReturnType<typeof vi.fn>;
const getConfigMock = (configModule as any).__getConfigMock as ReturnType<typeof vi.fn>;
const addBookmarksMock = (pdfBookmarksModule as any).__addBookmarksMock as ReturnType<typeof vi.fn>;

/** Default config used by existing tests (pdfBookmarks disabled) */
function makeDefaultConfig(overrides: Record<string, any> = {}) {
  return {
    pageFormat: 'A4',
    externalResources: { mode: 'block-all', allowedDomains: [] },
    javaPath: 'java',
    plantUmlMode: 'bundled-jar',
    pdfHeaderFooter: {
      headerEnabled: true,
      headerTemplate: null,
      footerEnabled: true,
      footerTemplate: null,
      pageBreakEnabled: true,
    },
    sourceJumpEnabled: false,
    style: {
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
      fontSize: 14,
      lineHeight: 1.6,
      margin: '20mm',
      codeFontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
      headingStyle: { h1FontWeight: 600, h1MarginTop: '24px', h1MarginBottom: '16px', h2MarginTop: '24px', h2MarginBottom: '16px' },
      codeBlockStyle: { background: '#f6f8fa', border: '1px solid #d0d7de', borderRadius: '6px', padding: '1em' },
      presetName: 'markdown-pdf',
    },
    toc: { minLevel: 1, maxLevel: 3, orderedList: false, pageBreak: true },
    codeBlock: { lineNumbers: false },
    pdfIndex: { enabled: false, title: 'Table of Contents' },
    pdfToc: { hidden: true },
    pdfBookmarks: { enabled: false },
    theme: 'default',
    customCss: '',
    outputFilename: '${filename}',
    previewTheme: 'auto' as const,
    ...overrides,
  };
}

describe('exportToPdf smoke/integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getConfigMock.mockReturnValue(makeDefaultConfig());
  });

  it('uses preview composition pipeline and writes a PDF', async () => {
    buildHtmlMock.mockResolvedValue('<html><head></head><body>composed</body></html>');
    readFileMock.mockResolvedValue('.hljs { background: #f6f8fa; }');
    accessMock.mockResolvedValue(undefined);
    setContentMock.mockResolvedValue(undefined);
    pdfMock.mockResolvedValue(undefined);
    closeMock.mockResolvedValue(undefined);
    evaluateMock.mockResolvedValue(undefined);
    addScriptTagMock.mockResolvedValue(undefined);
    waitForFunctionMock.mockResolvedValue(undefined);
    setViewportSizeMock.mockResolvedValue(undefined);
    newPageMock.mockResolvedValue({
      setContent: setContentMock, pdf: pdfMock,
      evaluate: evaluateMock, addScriptTag: addScriptTagMock,
      waitForFunction: waitForFunctionMock, setViewportSize: setViewportSizeMock,
    });
    launchMock.mockResolvedValue({ newPage: newPageMock, close: closeMock });

    const document = {
      getText: () => '# Hello',
      uri: { fsPath: '/tmp/sample.md' }
    } as any;

    const output = await exportToPdf(document, { extensionPath: '/tmp/ext' } as any);

    expect(buildHtmlMock).toHaveBeenCalledWith('# Hello', expect.anything(), undefined, undefined, expect.anything());
    expect(setContentMock).toHaveBeenCalledWith(
      expect.stringContaining('<style>.hljs { background: #f6f8fa; }</style>'),
      { waitUntil: 'networkidle' }
    );
    expect(pdfMock).toHaveBeenCalled();
    expect(output).toBe('/tmp/sample.pdf');
  });

  it('inlines hljs theme CSS into the HTML for PDF export', async () => {
    buildHtmlMock.mockResolvedValue('<html><head><meta charset="UTF-8"></head><body>code</body></html>');
    readFileMock.mockResolvedValue('.hljs-keyword { color: red; }');
    accessMock.mockResolvedValue(undefined);
    setContentMock.mockResolvedValue(undefined);
    pdfMock.mockResolvedValue(undefined);
    closeMock.mockResolvedValue(undefined);
    evaluateMock.mockResolvedValue(undefined);
    addScriptTagMock.mockResolvedValue(undefined);
    waitForFunctionMock.mockResolvedValue(undefined);
    setViewportSizeMock.mockResolvedValue(undefined);
    newPageMock.mockResolvedValue({
      setContent: setContentMock, pdf: pdfMock,
      evaluate: evaluateMock, addScriptTag: addScriptTagMock,
      waitForFunction: waitForFunctionMock, setViewportSize: setViewportSizeMock,
    });
    launchMock.mockResolvedValue({ newPage: newPageMock, close: closeMock });

    const document = {
      getText: () => '```ts\nconst x = 1;\n```',
      uri: { fsPath: '/tmp/sample.md' }
    } as any;

    await exportToPdf(document, { extensionPath: '/tmp/ext' } as any);

    const htmlArg = setContentMock.mock.calls[0][0] as string;
    expect(htmlArg).toContain('<style>.hljs-keyword { color: red; }</style>');
    expect(htmlArg).toContain('</head>');
    // The style tag should appear before </head>
    const styleIdx = htmlArg.indexOf('<style>');
    const headCloseIdx = htmlArg.indexOf('</head>');
    expect(styleIdx).toBeLessThan(headCloseIdx);
  });

  it('degrades gracefully when hljs CSS file is missing', async () => {
    buildHtmlMock.mockResolvedValue('<html><head></head><body>code</body></html>');
    readFileMock.mockRejectedValue(new Error('ENOENT'));
    accessMock.mockResolvedValue(undefined);
    setContentMock.mockResolvedValue(undefined);
    pdfMock.mockResolvedValue(undefined);
    closeMock.mockResolvedValue(undefined);
    evaluateMock.mockResolvedValue(undefined);
    addScriptTagMock.mockResolvedValue(undefined);
    waitForFunctionMock.mockResolvedValue(undefined);
    setViewportSizeMock.mockResolvedValue(undefined);
    newPageMock.mockResolvedValue({
      setContent: setContentMock, pdf: pdfMock,
      evaluate: evaluateMock, addScriptTag: addScriptTagMock,
      waitForFunction: waitForFunctionMock, setViewportSize: setViewportSizeMock,
    });
    launchMock.mockResolvedValue({ newPage: newPageMock, close: closeMock });

    const document = {
      getText: () => '# Hello',
      uri: { fsPath: '/tmp/sample.md' }
    } as any;

    // Should not throw even if CSS file is missing
    const output = await exportToPdf(document, { extensionPath: '/tmp/ext' } as any);
    expect(output).toBe('/tmp/sample.pdf');

    // HTML should be passed without the hljs style injection (page-break CSS may still be present)
    const htmlArg = setContentMock.mock.calls[0][0] as string;
    expect(htmlArg).not.toContain('.hljs');
  });

  it('PDF export with default settings includes header/footer options', async () => {
    buildHtmlMock.mockResolvedValue('<html><head></head><body>content</body></html>');
    readFileMock.mockResolvedValue('.hljs { background: #f6f8fa; }');
    accessMock.mockResolvedValue(undefined);
    setContentMock.mockResolvedValue(undefined);
    pdfMock.mockResolvedValue(undefined);
    closeMock.mockResolvedValue(undefined);
    evaluateMock.mockResolvedValue(undefined);
    addScriptTagMock.mockResolvedValue(undefined);
    waitForFunctionMock.mockResolvedValue(undefined);
    setViewportSizeMock.mockResolvedValue(undefined);
    newPageMock.mockResolvedValue({
      setContent: setContentMock, pdf: pdfMock,
      evaluate: evaluateMock, addScriptTag: addScriptTagMock,
      waitForFunction: waitForFunctionMock, setViewportSize: setViewportSizeMock,
    });
    launchMock.mockResolvedValue({ newPage: newPageMock, close: closeMock });

    const document = {
      getText: () => '# Hello',
      uri: { fsPath: '/tmp/sample.md' }
    } as any;

    await exportToPdf(document, { extensionPath: '/tmp/ext' } as any);

    expect(pdfMock).toHaveBeenCalledWith(
      expect.objectContaining({
        displayHeaderFooter: true,
        headerTemplate: expect.stringContaining('sample'),
        footerTemplate: expect.stringContaining('pageNumber'),
        margin: expect.objectContaining({ top: '20mm', bottom: '20mm' }),
      })
    );
  });

  it('PDF export injects page-break CSS when enabled', async () => {
    buildHtmlMock.mockResolvedValue('<html><head></head><body>content</body></html>');
    readFileMock.mockResolvedValue('.hljs { background: #f6f8fa; }');
    accessMock.mockResolvedValue(undefined);
    setContentMock.mockResolvedValue(undefined);
    pdfMock.mockResolvedValue(undefined);
    closeMock.mockResolvedValue(undefined);
    evaluateMock.mockResolvedValue(undefined);
    addScriptTagMock.mockResolvedValue(undefined);
    waitForFunctionMock.mockResolvedValue(undefined);
    setViewportSizeMock.mockResolvedValue(undefined);
    newPageMock.mockResolvedValue({
      setContent: setContentMock, pdf: pdfMock,
      evaluate: evaluateMock, addScriptTag: addScriptTagMock,
      waitForFunction: waitForFunctionMock, setViewportSize: setViewportSizeMock,
    });
    launchMock.mockResolvedValue({ newPage: newPageMock, close: closeMock });

    const document = {
      getText: () => '# Hello',
      uri: { fsPath: '/tmp/sample.md' }
    } as any;

    await exportToPdf(document, { extensionPath: '/tmp/ext' } as any);

    const htmlArg = setContentMock.mock.calls[0][0] as string;
    expect(htmlArg).toContain('page-break-before');
  });
});

describe('exportToPdf bookmark integration', () => {
  /** Helper to set up common mocks for bookmark tests */
  function setupPageMocks() {
    buildHtmlMock.mockResolvedValue('<html><head></head><body><h1>Title</h1><h2>Section</h2></body></html>');
    readFileMock.mockResolvedValue('.hljs { background: #f6f8fa; }');
    accessMock.mockResolvedValue(undefined);
    setContentMock.mockResolvedValue(undefined);
    // Return a fake PDF buffer with 2 "/Type /Page" markers so page counting works
    const fakePdf = Buffer.from('/Type /Page\n/Type /Page\n');
    pdfMock.mockResolvedValue(fakePdf);
    closeMock.mockResolvedValue(undefined);
    evaluateMock.mockResolvedValue({
      headings: [
        { level: 1, text: 'Title', offsetTop: 0 },
        { level: 2, text: 'Section', offsetTop: 500 },
      ],
      scrollHeight: 1000,
    });
    addScriptTagMock.mockResolvedValue(undefined);
    waitForFunctionMock.mockResolvedValue(undefined);
    setViewportSizeMock.mockResolvedValue(undefined);
    addBookmarksMock.mockResolvedValue(undefined);
    newPageMock.mockResolvedValue({
      setContent: setContentMock, pdf: pdfMock,
      evaluate: evaluateMock, addScriptTag: addScriptTagMock,
      waitForFunction: waitForFunctionMock, setViewportSize: setViewportSizeMock,
    });
    launchMock.mockResolvedValue({ newPage: newPageMock, close: closeMock });
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls addBookmarks when pdfBookmarks.enabled=true (Validates: Requirements 1.1, 4.2)', async () => {
    getConfigMock.mockReturnValue(makeDefaultConfig({
      pdfBookmarks: { enabled: true },
      pdfIndex: { enabled: false, title: 'Table of Contents' },
    }));
    setupPageMocks();

    const document = { getText: () => '# Title\n## Section', uri: { fsPath: '/tmp/sample.md' } } as any;
    await exportToPdf(document, { extensionPath: '/tmp/ext' } as any);

    expect(addBookmarksMock).toHaveBeenCalledWith(
      '/tmp/sample.pdf',
      expect.arrayContaining([
        expect.objectContaining({ level: 1, text: 'Title' }),
        expect.objectContaining({ level: 2, text: 'Section' }),
      ]),
      1,
      3,
    );
  });

  it('does NOT call addBookmarks when pdfBookmarks.enabled=false (Validates: Requirements 1.2)', async () => {
    getConfigMock.mockReturnValue(makeDefaultConfig({
      pdfBookmarks: { enabled: false },
      pdfIndex: { enabled: false, title: 'Table of Contents' },
    }));
    setupPageMocks();

    const document = { getText: () => '# Title\n## Section', uri: { fsPath: '/tmp/sample.md' } } as any;
    await exportToPdf(document, { extensionPath: '/tmp/ext' } as any);

    expect(addBookmarksMock).not.toHaveBeenCalled();
  });

  it('generates bookmarks when pdfIndex.enabled=false + pdfBookmarks.enabled=true (Validates: Requirements 4.1, 4.2)', async () => {
    getConfigMock.mockReturnValue(makeDefaultConfig({
      pdfBookmarks: { enabled: true },
      pdfIndex: { enabled: false, title: 'Table of Contents' },
    }));
    setupPageMocks();

    const document = { getText: () => '# Title\n## Section', uri: { fsPath: '/tmp/sample.md' } } as any;
    await exportToPdf(document, { extensionPath: '/tmp/ext' } as any);

    // addBookmarks should be called even without pdfIndex
    expect(addBookmarksMock).toHaveBeenCalledTimes(1);
    expect(addBookmarksMock).toHaveBeenCalledWith(
      '/tmp/sample.pdf',
      expect.any(Array),
      1,
      3,
    );
    // Verify bookmark entries have valid page numbers
    const entries = addBookmarksMock.mock.calls[0][1];
    expect(entries.length).toBe(2);
    for (const entry of entries) {
      expect(entry.pageNumber).toBeGreaterThanOrEqual(1);
    }
  });
});
