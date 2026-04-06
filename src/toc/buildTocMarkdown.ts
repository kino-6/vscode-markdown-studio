import type { AnchorMapping, TocConfig } from '../types/models';

/**
 * Build a Markdown-formatted TOC string from anchor mappings and configuration.
 *
 * Each entry is formatted as `- [text](#anchor-id)` (unordered) or
 * `1. [text](#anchor-id)` (ordered), indented with 2 spaces per level
 * based on relative depth from minLevel.
 *
 * Headings outside the minLevel–maxLevel range are filtered out.
 * Returns an empty string when no headings match.
 */
export function buildTocMarkdown(
  anchors: AnchorMapping[],
  config: TocConfig,
): string {
  const filtered = anchors.filter(
    (a) => a.heading.level >= config.minLevel && a.heading.level <= config.maxLevel,
  );

  if (filtered.length === 0) {
    return '';
  }

  const prefix = config.orderedList ? '1.' : '-';
  const lines: string[] = [];

  for (const { heading, anchorId } of filtered) {
    const depth = heading.level - config.minLevel;
    const indent = '  '.repeat(depth);
    lines.push(`${indent}${prefix} [${heading.text}](#${anchorId})`);
  }

  return lines.join('\n');
}

/**
 * Parse Markdown link entries from TOC text for round-trip verification.
 *
 * Extracts `[text](#anchor)` patterns from each line, returning an array
 * of {text, anchor} objects.
 */
export function parseTocLinks(
  tocText: string,
): Array<{ text: string; anchor: string }> {
  if (!tocText) {
    return [];
  }

  const results: Array<{ text: string; anchor: string }> = [];
  const linkPattern = /\[([^\]]*)\]\(#([^)]*)\)/;

  for (const line of tocText.split('\n')) {
    const match = linkPattern.exec(line);
    if (match) {
      results.push({ text: match[1], anchor: match[2] });
    }
  }

  return results;
}
