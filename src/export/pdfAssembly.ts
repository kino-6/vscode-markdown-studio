import { PDFArray, PDFDict, PDFDocument, PDFName, type PDFPage } from 'pdf-lib';

type NamedDestination = {
  pageIndex: number;
  destination: PDFArray;
};

function destinationKeys(name: PDFName): string[] {
  return [
    name.decodeText(),
    name.toString(),
    name.toString().replace(/^\//, ''),
  ];
}

function collectNamedDestinations(source: PDFDocument): Map<string, NamedDestination> {
  const destinations = new Map<string, NamedDestination>();
  const pageRefToIndex = new Map<string, number>();
  source.getPages().forEach((page, index) => {
    pageRefToIndex.set(page.ref.toString(), index);
  });

  const destsRef = source.catalog.get(PDFName.of('Dests'));
  const dests = destsRef ? source.context.lookup(destsRef) : undefined;
  if (!(dests instanceof PDFDict)) {
    return destinations;
  }

  for (const key of dests.keys()) {
    const destination = source.context.lookup(dests.get(key));
    if (!(destination instanceof PDFArray) || destination.size() === 0) {
      continue;
    }

    const pageRef = destination.get(0);
    const pageIndex = pageRefToIndex.get(pageRef.toString());
    if (pageIndex === undefined) {
      continue;
    }

    const value = { pageIndex, destination };
    for (const candidate of destinationKeys(key)) {
      destinations.set(candidate, value);
    }
  }

  return destinations;
}

function clonePdfObjectForDestination(value: any, merged: PDFDocument): any {
  if (typeof value?.clone !== 'function') {
    return value;
  }

  try {
    return value.clone(merged.context);
  } catch {
    return value.clone();
  }
}

function buildMergedDestinationArray(
  merged: PDFDocument,
  targetPage: PDFPage,
  sourceDestination: PDFArray,
): PDFArray {
  const destination: any[] = [targetPage.ref];
  for (let i = 1; i < sourceDestination.size(); i += 1) {
    destination.push(clonePdfObjectForDestination(sourceDestination.get(i), merged));
  }
  return merged.context.obj(destination);
}

function rewriteNamedDestinationLinks(
  merged: PDFDocument,
  copiedPages: PDFPage[],
  destinations: Map<string, NamedDestination>,
): void {
  if (destinations.size === 0) {
    return;
  }

  for (const page of copiedPages) {
    const annots = page.node.Annots();
    if (!annots) {
      continue;
    }

    for (let i = 0; i < annots.size(); i += 1) {
      const annot = merged.context.lookup(annots.get(i));
      if (!(annot instanceof PDFDict)) {
        continue;
      }

      const dest = annot.get(PDFName.of('Dest'));
      if (!(dest instanceof PDFName)) {
        continue;
      }

      const namedDestination = destinationKeys(dest)
        .map((candidate) => destinations.get(candidate))
        .find((item): item is NamedDestination => Boolean(item));
      if (!namedDestination) {
        continue;
      }

      const targetPage = copiedPages[namedDestination.pageIndex];
      if (!targetPage) {
        continue;
      }

      annot.set(PDFName.of('Dest'), buildMergedDestinationArray(merged, targetPage, namedDestination.destination));
    }
  }
}

export async function mergePdfBuffers(buffers: Buffer[]): Promise<Buffer> {
  const merged = await PDFDocument.create();

  for (const buffer of buffers) {
    const source = await PDFDocument.load(buffer, { ignoreEncryption: true });
    const namedDestinations = collectNamedDestinations(source);
    const pages = await merged.copyPages(source, source.getPageIndices());
    rewriteNamedDestinationLinks(merged, pages, namedDestinations);
    for (const page of pages) {
      merged.addPage(page);
    }
  }

  return Buffer.from(await merged.save());
}
