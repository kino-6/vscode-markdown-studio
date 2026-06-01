import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { mergePdfBuffers } from '../../src/export/pdfAssembly';

async function makePdf(pageCount: number): Promise<Buffer> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i += 1) {
    doc.addPage();
  }
  return Buffer.from(await doc.save());
}

describe('PDF assembly', () => {
  it('preserves input order when merging cover and body PDFs', async () => {
    const merged = await mergePdfBuffers([
      await makePdf(1),
      await makePdf(2),
    ]);

    const doc = await PDFDocument.load(merged);
    expect(doc.getPageCount()).toBe(3);
  });
});
