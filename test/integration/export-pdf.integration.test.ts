import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createVscodeMock } from '../helpers/vscodeMock';

describe('exportToPdf integration smoke', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('uses shared HTML composer and requests PDF write', async () => {
    const setContent = vi.fn().mockResolvedValue(undefined);
    const pdf = vi.fn().mockResolvedValue(undefined);
    const close = vi.fn().mockResolvedValue(undefined);

    const { module } = createVscodeMock({
      'markdownStudio.export.pageFormat': 'A4',
      'markdownStudio.security.blockExternalLinks': true
    });

    vi.doMock('vscode', () => module);
    vi.doMock('playwright', () => ({
      chromium: {
        launch: vi.fn().mockResolvedValue({
          newPage: vi.fn().mockResolvedValue({ setContent, pdf }),
          close
        })
      }
    }));

    const buildHtmlSpy = vi.fn().mockResolvedValue('<html><body>shared pipeline</body></html>');
    vi.doMock('../../src/preview/buildHtml', () => ({ buildHtml: buildHtmlSpy }));

    vi.doMock('node:fs/promises', () => ({
      default: {
        access: vi.fn().mockResolvedValue(undefined)
      },
      access: vi.fn().mockResolvedValue(undefined)
    }));

    const { exportToPdf } = await import('../../src/export/exportPdf');
    const output = await exportToPdf(
      {
        getText: () => '# Doc',
        uri: { fsPath: '/tmp/doc.md' }
      } as any,
      { extensionPath: '/ext' } as any
    );

    expect(buildHtmlSpy).toHaveBeenCalledTimes(1);
    expect(setContent).toHaveBeenCalledWith('<html><body>shared pipeline</body></html>', { waitUntil: 'networkidle' });
    expect(pdf).toHaveBeenCalledTimes(1);
    expect(output).toContain('/tmp/doc.pdf');
    expect(close).toHaveBeenCalled();
  });
});
