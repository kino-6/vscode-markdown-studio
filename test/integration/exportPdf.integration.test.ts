import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:fs/promises', () => {
  const accessMock = vi.fn();
  const readFileMock = vi.fn();
  return { default: { access: accessMock, readFile: readFileMock }, __accessMock: accessMock, __readFileMock: readFileMock };
});

vi.mock('../../src/preview/buildHtml', () => {
  const buildHtmlMock = vi.fn();
  return { buildHtml: buildHtmlMock, __buildHtmlMock: buildHtmlMock };
});

vi.mock('playwright', () => {
  const setContentMock = vi.fn();
  const pdfMock = vi.fn();
  const closeMock = vi.fn();
  const newPageMock = vi.fn();
  const launchMock = vi.fn();
  return {
    chromium: { launch: launchMock },
    __setContentMock: setContentMock,
    __pdfMock: pdfMock,
    __closeMock: closeMock,
    __newPageMock: newPageMock,
    __launchMock: launchMock
  };
});

vi.mock('../../src/infra/config', () => ({
  getConfig: () => ({
    pageFormat: 'A4',
    blockExternalLinks: true,
    javaPath: 'java',
    plantUmlMode: 'bundled-jar'
  })
}));

import * as fsModule from 'node:fs/promises';
import * as buildHtmlModule from '../../src/preview/buildHtml';
import * as playwrightModule from 'playwright';
import { exportToPdf } from '../../src/export/exportPdf';

const accessMock = (fsModule as any).__accessMock as ReturnType<typeof vi.fn>;
const readFileMock = (fsModule as any).__readFileMock as ReturnType<typeof vi.fn>;
const buildHtmlMock = (buildHtmlModule as any).__buildHtmlMock as ReturnType<typeof vi.fn>;
const setContentMock = (playwrightModule as any).__setContentMock as ReturnType<typeof vi.fn>;
const pdfMock = (playwrightModule as any).__pdfMock as ReturnType<typeof vi.fn>;
const closeMock = (playwrightModule as any).__closeMock as ReturnType<typeof vi.fn>;
const newPageMock = (playwrightModule as any).__newPageMock as ReturnType<typeof vi.fn>;
const launchMock = (playwrightModule as any).__launchMock as ReturnType<typeof vi.fn>;

describe('exportToPdf smoke/integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses preview composition pipeline and writes a PDF', async () => {
    buildHtmlMock.mockResolvedValue('<html><head></head><body>composed</body></html>');
    readFileMock.mockResolvedValue('.hljs { background: #f6f8fa; }');
    accessMock.mockResolvedValue(undefined);
    setContentMock.mockResolvedValue(undefined);
    pdfMock.mockResolvedValue(undefined);
    closeMock.mockResolvedValue(undefined);
    newPageMock.mockResolvedValue({ setContent: setContentMock, pdf: pdfMock });
    launchMock.mockResolvedValue({ newPage: newPageMock, close: closeMock });

    const document = {
      getText: () => '# Hello',
      uri: { fsPath: '/tmp/sample.md' }
    } as any;

    const output = await exportToPdf(document, { extensionPath: '/tmp/ext' } as any);

    expect(buildHtmlMock).toHaveBeenCalledWith('# Hello', expect.anything());
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
    newPageMock.mockResolvedValue({ setContent: setContentMock, pdf: pdfMock });
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
    newPageMock.mockResolvedValue({ setContent: setContentMock, pdf: pdfMock });
    launchMock.mockResolvedValue({ newPage: newPageMock, close: closeMock });

    const document = {
      getText: () => '# Hello',
      uri: { fsPath: '/tmp/sample.md' }
    } as any;

    // Should not throw even if CSS file is missing
    const output = await exportToPdf(document, { extensionPath: '/tmp/ext' } as any);
    expect(output).toBe('/tmp/sample.pdf');

    // HTML should be passed without the style injection
    const htmlArg = setContentMock.mock.calls[0][0] as string;
    expect(htmlArg).not.toContain('<style>');
  });
});
