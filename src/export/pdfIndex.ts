/** Mapping between a heading and its PDF page number. */
export interface HeadingPageEntry {
  level: number;
  text: string;
  pageNumber: number;
  anchorId: string;
}

/** Escapes HTML-special characters. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Estimates the number of PDF index pages.
 * Assumes roughly 30 entries per page.
 */
export function estimateIndexPageCount(entryCount: number): number {
  if (entryCount === 0) return 0;
  return Math.ceil(entryCount / 30);
}

/**
 * Builds PDF index HTML with page numbers.
 */
export function buildPdfIndexHtml(
  entries: HeadingPageEntry[],
  title: string,
  pageOffset: number
): string {
  if (entries.length === 0) return '';

  const lines = entries.map((e) => {
    const indent = e.level - 1;
    const page = e.pageNumber + pageOffset;
    const href = e.anchorId ? ` href="#${e.anchorId}"` : '';
    return `<div class="ms-pdf-index-entry ms-pdf-index-level-${e.level}" style="padding-left: ${indent * 1.5}em;">` +
      `<a class="ms-pdf-index-text"${href}>${escapeHtml(e.text)}</a>` +
      `<span class="ms-pdf-index-dots"></span>` +
      `<span class="ms-pdf-index-page">p.${page}</span>` +
      `</div>`;
  });

  return `<div class="ms-pdf-index" style="page-break-after: always;">` +
    `<h1 class="ms-pdf-index-title">${escapeHtml(title)}</h1>` +
    `<div class="ms-pdf-index-entries">${lines.join('\n')}</div>` +
    `</div>`;
}
