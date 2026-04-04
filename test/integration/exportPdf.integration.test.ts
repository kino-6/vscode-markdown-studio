import { describe, expect, it, vi } from 'vitest';

vi.mock('node:fs/promises', () => {
  const accessMock = vi.fn();
  return { default: { access: accessMock }, __accessMock: accessMock };
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
const buildHtmlMock = (buildHtmlModule as any).__buildHtmlMock as ReturnType<typeof vi.fn>;
const setContentMock = (playwrightModule as any).__setContentMock as ReturnType<typeof vi.fn>;
const pdfMock = (playwrightModule as any).__pdfMock as ReturnType<typeof vi.fn>;
const closeMock = (playwrightModule as any).__closeMock as ReturnType<typeof vi.fn>;
const newPageMock = (playwrightModule as any).__newPageMock as ReturnType<typeof vi.fn>;
const launchMock = (playwrightModule as any).__launchMock as ReturnType<typeof vi.fn>;

describe('exportToPdf smoke/integration', () => {
  it('uses preview composition pipeline and writes a PDF', async () => {
    buildHtmlMock.mockResolvedValue('<html><body>composed</body></html>');
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
    expect(setContentMock).toHaveBeenCalledWith('<html><body>composed</body></html>', { waitUntil: 'networkidle' });
    expect(pdfMock).toHaveBeenCalled();
    expect(output).toBe('/tmp/sample.pdf');
  });
});
