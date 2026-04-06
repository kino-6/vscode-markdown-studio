import type { AnchorMapping, TocConfig } from '../types/models';

/**
 * Build a TOC HTML string from anchor mappings and configuration.
 *
 * Uses a stack-based algorithm to produce properly nested list structures
 * that mirror the heading hierarchy. Headings outside the configured
 * minLevel–maxLevel range are filtered out.
 */
export function buildTocHtml(anchors: AnchorMapping[], config: TocConfig): string {
  const tag = config.orderedList ? 'ol' : 'ul';

  const pageBreakStyle = config.pageBreak
    ? ' style="page-break-before: always; page-break-after: always;"'
    : '';

  // Filter to configured level range
  const filtered = anchors.filter(
    (a) => a.heading.level >= config.minLevel && a.heading.level <= config.maxLevel,
  );

  if (filtered.length === 0) {
    return `<nav class="ms-toc"${pageBreakStyle}></nav>`;
  }

  const parts: string[] = [];
  // Stack tracks the nesting depth; each entry is the heading level that opened a list
  const stack: number[] = [];

  for (const { heading, anchorId } of filtered) {
    const level = heading.level;

    if (stack.length === 0) {
      // First item – open the root list
      parts.push(`<${tag}>`);
      stack.push(level);
    } else {
      const current = stack[stack.length - 1];

      if (level > current) {
        // Deeper heading – open nested list(s)
        // We only open one new list per step to keep the nesting correct
        parts.push(`<${tag}>`);
        stack.push(level);
      } else if (level < current) {
        // Shallower heading – close lists until we reach the right depth
        while (stack.length > 0 && stack[stack.length - 1] > level) {
          parts.push(`</li></${tag}>`);
          stack.pop();
        }
        // Close the previous <li> at this level
        parts.push('</li>');
      } else {
        // Same level – close previous <li>
        parts.push('</li>');
      }
    }

    parts.push(`<li><a href="#${anchorId}">${escapeHtml(heading.text)}</a>`);
  }

  // Close all remaining open tags
  while (stack.length > 0) {
    parts.push(`</li></${tag}>`);
    stack.pop();
  }

  return `<nav class="ms-toc"${pageBreakStyle}>${parts.join('')}</nav>`;
}

/** Minimal HTML escaping for heading text inserted into markup. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
