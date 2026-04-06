/**
 * TOC marker detection and replacement.
 *
 * Detects `[[toc]]` / `[toc]` markers (case-insensitive) in Markdown source
 * and replaces them in the rendered HTML output.
 */

/** Regex matching both `[[toc]]` and `[toc]` forms, case-insensitive. */
const TOC_MARKER_RE = /\[\[toc\]\]|\[toc\]/gi;

/**
 * Find the first valid TOC marker in Markdown source text.
 * Markers inside fenced code blocks are excluded.
 *
 * @param markdown - Raw Markdown source
 * @param fencedRanges - Line ranges of fenced code blocks (from scanFencedBlocks)
 * @returns 0-based line number of the first valid marker, or -1 if none found
 */
export function findTocMarker(
  markdown: string,
  fencedRanges: Array<{ startLine: number; endLine: number }>,
): number {
  const lines = markdown.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    if (!TOC_MARKER_RE.test(lines[i])) {
      continue;
    }
    // Reset lastIndex since we use the `g` flag
    TOC_MARKER_RE.lastIndex = 0;

    // Skip lines inside fenced code blocks
    const insideFenced = fencedRanges.some(
      (range) => i >= range.startLine && i < range.endLine,
    );
    if (insideFenced) {
      continue;
    }

    return i;
  }

  return -1;
}

/**
 * Replace TOC markers in rendered HTML with the generated TOC HTML.
 *
 * markdown-it renders markers as plain text inside `<p>` tags, e.g.
 * `<p>[[toc]]</p>` or `<p>[toc]</p>`.
 *
 * The first marker is replaced with tocHtml; all subsequent markers are removed.
 *
 * @param html - Rendered HTML string
 * @param tocHtml - Generated TOC HTML to insert
 * @returns HTML with markers replaced
 */
export function replaceTocMarker(html: string, tocHtml: string): string {
  // Match <p> tags (with optional attributes) whose only meaningful content is a TOC marker
  const markerInParagraph = /<p[^>]*>\s*(\[\[toc\]\]|\[toc\])\s*<\/p>/gi;

  let replaced = false;

  return html.replace(markerInParagraph, () => {
    if (!replaced) {
      replaced = true;
      return tocHtml;
    }
    return '';
  });
}
