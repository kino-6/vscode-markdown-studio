/**
 * Demo GIF automation — anchor parser.
 *
 * Extracts `<!-- DEMO:XXXX -->` section anchors from a markdown string,
 * returning each anchor's name, full anchor text, and 1-based line number.
 */

import { ANCHOR_PATTERN, SectionAnchor } from './config.js';

/**
 * Parse all `<!-- DEMO:XXXX -->` anchors from the given content string.
 *
 * Processes the content line-by-line, matching each line against
 * {@link ANCHOR_PATTERN}. Returns an array of {@link SectionAnchor}
 * objects with 1-based line numbers.
 *
 * @param content - Raw file content (e.g. the contents of `examples/demo.md`)
 * @returns Array of section anchors found in the content
 */
export function parseAnchors(content: string): SectionAnchor[] {
  const lines = content.split('\n');
  const anchors: SectionAnchor[] = [];

  for (let i = 0; i < lines.length; i++) {
    const match = ANCHOR_PATTERN.exec(lines[i].trim());
    if (match) {
      anchors.push({
        name: match[1],
        anchor: match[0],
        line: i + 1,
      });
    }
  }

  return anchors;
}
