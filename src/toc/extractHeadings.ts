import MarkdownIt from 'markdown-it';
import type { Token } from 'markdown-it';
import { HeadingEntry } from '../types/models';
import { scanFencedBlocks } from '../parser/scanFencedBlocks';

/**
 * Recursively extract plain text from an inline token's children,
 * stripping all inline formatting (bold, italic, code, links, etc.).
 */
function extractPlainText(children: Token[]): string {
  let result = '';
  for (const child of children) {
    if (child.type === 'text' || child.type === 'code_inline') {
      result += child.content;
    } else if (child.children && child.children.length > 0) {
      result += extractPlainText(child.children);
    }
  }
  return result;
}

/**
 * Check whether a given 0-based line number falls inside any fenced block range.
 */
function isInsideFencedBlock(
  line: number,
  fencedRanges: Array<{ startLine: number; endLine: number }>
): boolean {
  return fencedRanges.some(
    (range) => line >= range.startLine && line < range.endLine
  );
}

/**
 * Extract headings from a Markdown document using markdown-it's token stream.
 * Headings inside fenced code blocks (detected by scanFencedBlocks) are excluded.
 *
 * @param markdown - The raw Markdown source text
 * @param md - A configured MarkdownIt instance
 * @returns An array of HeadingEntry objects in document order
 */
export function extractHeadings(
  markdown: string,
  md: MarkdownIt
): HeadingEntry[] {
  const tokens = md.parse(markdown, {});
  const fencedBlocks = scanFencedBlocks(markdown);
  const fencedRanges = fencedBlocks.map((b) => ({
    startLine: b.startLine,
    endLine: b.endLine,
  }));

  const headings: HeadingEntry[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    if (token.type !== 'heading_open') {
      continue;
    }

    const level = parseInt(token.tag.slice(1), 10);
    const line = token.map ? token.map[0] : -1;

    // Skip headings inside fenced blocks
    if (line >= 0 && isInsideFencedBlock(line, fencedRanges)) {
      continue;
    }

    // Next token should be the inline content
    const inlineToken = i + 1 < tokens.length ? tokens[i + 1] : undefined;
    let text = '';
    if (inlineToken && inlineToken.type === 'inline') {
      text = inlineToken.children
        ? extractPlainText(inlineToken.children)
        : inlineToken.content;
    }

    headings.push({ level, text, line });
  }

  return headings;
}
