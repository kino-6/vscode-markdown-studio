import { describe, expect, it, vi } from 'vitest';

const buildHtmlMock = vi.fn();
const accessMock = vi.fn();
const setContentMock = vi.fn();
const pdfMock = vi.fn();
const closeMock = vi.fn();
const newPageMock = vi.fn();
const launchMock = vi.fn();

vi.mock('node:fs/promises', () => ({
  default: {
    access: accessMock
  }
}));

vi.mock('../../src/preview/buildHtml', () => ({
  buildHtml: buildHtmlMock
}));

vi.mock('playwright', () => ({
  chromium: {
    launch: launchMock
  }
}));

vi.mock('../../src/infra/config', () => ({
  getConfig: () => ({
    pageFormat: 'A4',
    blockExternalLinks: true,
    javaPath: 'java',
    plantUmlMode: 'bundled-jar'
  })
}));

import { exportToPdf } from '../../src/export/exportPdf';

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
