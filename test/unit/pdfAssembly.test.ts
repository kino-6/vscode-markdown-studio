import { describe, expect, it } from 'vitest';
import { PDFArray, PDFName, PDFDocument } from 'pdf-lib';
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

  it('rewrites named destination links to direct page destinations when merging', async () => {
    const cover = await makePdf(1);
    const body = await PDFDocument.create();
    const indexPage = body.addPage();
    const targetPage = body.addPage();
    const destName = PDFName.of('math-katex');

    const dests = body.context.obj({});
    dests.set(destName, body.context.obj([targetPage.ref, PDFName.of('XYZ'), 0, 700, 0]));
    body.catalog.set(PDFName.of('Dests'), body.context.register(dests));

    const link = body.context.obj({
      Type: 'Annot',
      Subtype: 'Link',
      Rect: [0, 0, 100, 20],
      Border: [0, 0, 0],
      Dest: destName,
    });
    indexPage.node.set(PDFName.of('Annots'), body.context.obj([body.context.register(link)]));

    const merged = await mergePdfBuffers([cover, Buffer.from(await body.save())]);
    const mergedDoc = await PDFDocument.load(merged);
    const annots = mergedDoc.getPage(1).node.Annots();
    expect(annots?.size()).toBe(1);

    const annot = mergedDoc.context.lookup(annots!.get(0)) as any;
    const dest = annot.get(PDFName.of('Dest'));
    expect(dest).toBeInstanceOf(PDFArray);
    expect((dest as PDFArray).get(0).toString()).toBe(mergedDoc.getPage(2).ref.toString());
    expect((dest as PDFArray).get(1).toString()).toBe('/XYZ');
    expect((dest as PDFArray).get(3).toString()).toBe('700');
  });
});
