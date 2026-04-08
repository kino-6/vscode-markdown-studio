/** 見出しとページ番号のマッピング */
export interface HeadingPageEntry {
  level: number;
  text: string;
  pageNumber: number;
  anchorId: string;
}

/** HTML特殊文字のエスケープ */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * 目次ページ数を推定する。
 * 1ページあたり約30エントリと仮定。
 */
export function estimateIndexPageCount(entryCount: number): number {
  if (entryCount === 0) return 0;
  return Math.ceil(entryCount / 30);
}

/**
 * ページ番号付きPDF目次HTMLを生成する。
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
      `<span class="ms-pdf-index-page">${page}</span>` +
      `</div>`;
  });

  return `<div class="ms-pdf-index" style="page-break-after: always;">` +
    `<h1 class="ms-pdf-index-title">${escapeHtml(title)}</h1>` +
    `<div class="ms-pdf-index-entries">${lines.join('\n')}</div>` +
    `</div>`;
}
