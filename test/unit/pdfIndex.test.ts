import { describe, it, expect } from 'vitest';
import { buildPdfIndexHtml, estimateIndexPageCount, HeadingPageEntry } from '../../src/export/pdfIndex';

describe('buildPdfIndexHtml', () => {
  it('returns empty string for no entries', () => {
    expect(buildPdfIndexHtml([], 'TOC', 0)).toBe('');
  });

  it('generates HTML with title and entries', () => {
    const entries: HeadingPageEntry[] = [
      { level: 1, text: 'Introduction', pageNumber: 1 },
      { level: 2, text: 'Background', pageNumber: 2 },
    ];
    const html = buildPdfIndexHtml(entries, 'Table of Contents', 1);
    expect(html).toContain('ms-pdf-index');
    expect(html).toContain('Table of Contents');
    expect(html).toContain('Introduction');
    expect(html).toContain('Background');
    // Page numbers should include offset
    expect(html).toContain('>2<');  // 1 + 1
    expect(html).toContain('>3<');  // 2 + 1
  });

  it('applies level-based CSS classes', () => {
    const entries: HeadingPageEntry[] = [
      { level: 1, text: 'H1', pageNumber: 1 },
      { level: 3, text: 'H3', pageNumber: 2 },
    ];
    const html = buildPdfIndexHtml(entries, 'TOC', 0);
    expect(html).toContain('ms-pdf-index-level-1');
    expect(html).toContain('ms-pdf-index-level-3');
  });

  it('escapes HTML in heading text', () => {
    const entries: HeadingPageEntry[] = [
      { level: 1, text: '<script>alert(1)</script>', pageNumber: 1 },
    ];
    const html = buildPdfIndexHtml(entries, 'TOC', 0);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('includes page-break-after style', () => {
    const entries: HeadingPageEntry[] = [
      { level: 1, text: 'Test', pageNumber: 1 },
    ];
    const html = buildPdfIndexHtml(entries, 'TOC', 0);
    expect(html).toContain('page-break-after: always');
  });
});

describe('estimateIndexPageCount', () => {
  it('returns 0 for no entries', () => {
    expect(estimateIndexPageCount(0)).toBe(0);
  });

  it('returns 1 for small number of entries', () => {
    expect(estimateIndexPageCount(10)).toBe(1);
  });

  it('returns 1 for exactly 30 entries', () => {
    expect(estimateIndexPageCount(30)).toBe(1);
  });

  it('returns 2 for 31 entries', () => {
    expect(estimateIndexPageCount(31)).toBe(2);
  });
});
