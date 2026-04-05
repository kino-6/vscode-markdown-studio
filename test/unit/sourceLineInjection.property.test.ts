import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import MarkdownIt from 'markdown-it';
import { createMarkdownParser } from '../../src/parser/parseMarkdown';

/**
 * Property 1: Source line injection correctness
 *
 * For any valid markdown string, every block-level token that markdown-it
 * assigns a source map (token.map) SHALL produce an HTML element with a
 * data-source-line attribute equal to map[0], and every token without a
 * map property SHALL produce an HTML element without a data-source-line
 * attribute.
 *
 * **Validates: Requirements 1.1, 1.2, 1.4**
 */

/**
 * The block-level token types that the source line injector patches.
 */
const BLOCK_TOKEN_TYPES = new Set([
  'paragraph_open', 'heading_open', 'blockquote_open',
  'list_item_open', 'bullet_list_open', 'ordered_list_open',
  'table_open', 'thead_open', 'tbody_open', 'tr_open',
  'hr', 'code_block', 'fence', 'html_block',
]);

/** Simple word arbitrary using constantFrom. */
const wordArb = fc.constantFrom(
  'hello', 'world', 'foo', 'bar', 'test', 'markdown', 'line',
  'alpha', 'beta', 'gamma', 'delta', 'quick', 'brown', 'fox',
);

/** A short phrase of 1-4 words. */
const phraseArb = fc.array(wordArb, { minLength: 1, maxLength: 4 })
  .map((words) => words.join(' '));

/** Arbitrary that generates markdown fragments covering various block types. */
const markdownBlockArb = fc.oneof(
  // Headings (h1-h6)
  fc.tuple(fc.integer({ min: 1, max: 6 }), phraseArb)
    .map(([level, text]) => `${'#'.repeat(level)} ${text}`),
  // Paragraphs
  phraseArb,
  // Unordered list items
  fc.array(phraseArb, { minLength: 1, maxLength: 4 })
    .map((items) => items.map((item) => `- ${item}`).join('\n')),
  // Ordered list items
  fc.array(phraseArb, { minLength: 1, maxLength: 4 })
    .map((items) => items.map((item, i) => `${i + 1}. ${item}`).join('\n')),
  // Blockquotes
  phraseArb.map((text) => `> ${text}`),
  // Horizontal rules
  fc.constant('---'),
  // Fenced code blocks
  phraseArb.map((code) => `\`\`\`\n${code}\n\`\`\``),
  // Tables
  fc.constant('| A | B |\n| --- | --- |\n| 1 | 2 |'),
);

/** Compose multiple blocks separated by blank lines into a full markdown doc. */
const markdownDocArb = fc.array(markdownBlockArb, { minLength: 1, maxLength: 6 })
  .map((blocks) => blocks.join('\n\n'));

/**
 * Extract all data-source-line attribute values from an HTML string.
 * Returns an array of parsed integer values.
 */
function extractSourceLineAttrs(html: string): number[] {
  const regex = /data-source-line="(\d+)"/g;
  const values: number[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    values.push(parseInt(match[1], 10));
  }
  return values;
}

/**
 * Collect the set of map[0] values from block-level tokens that have maps,
 * using a plain markdown-it instance (no custom rules) to get the raw tokens.
 */
function getExpectedSourceLines(markdown: string): Set<number> {
  const rawMd = new MarkdownIt({ html: true, linkify: true, typographer: true });
  const tokens = rawMd.parse(markdown, {});
  const lines = new Set<number>();
  for (const token of tokens) {
    if (BLOCK_TOKEN_TYPES.has(token.type) && token.map && token.map.length >= 2) {
      lines.add(token.map[0]);
    }
  }
  return lines;
}

describe('Property 1: Source line injection correctness', () => {
  const parser = createMarkdownParser();

  it('every block token with a source map produces a data-source-line attribute with the correct value', () => {
    fc.assert(
      fc.property(markdownDocArb, (markdown) => {
        const html = parser.render(markdown);
        const injectedLines = extractSourceLineAttrs(html);
        const expectedLines = getExpectedSourceLines(markdown);

        // Every expected source line from tokens with maps must appear in the HTML
        for (const line of expectedLines) {
          expect(injectedLines).toContain(line);
        }

        // Every injected data-source-line value must be a non-negative integer
        for (const line of injectedLines) {
          expect(Number.isInteger(line)).toBe(true);
          expect(line).toBeGreaterThanOrEqual(0);
        }

        // Every injected line must correspond to a token that had a source map
        for (const line of injectedLines) {
          expect(expectedLines.has(line)).toBe(true);
        }
      }),
      { numRuns: 300 },
    );
  });

  it('data-source-line values are within the source line range of the markdown', () => {
    fc.assert(
      fc.property(markdownDocArb, (markdown) => {
        const html = parser.render(markdown);
        const injectedLines = extractSourceLineAttrs(html);
        const totalLines = markdown.split('\n').length;

        for (const line of injectedLines) {
          expect(line).toBeGreaterThanOrEqual(0);
          expect(line).toBeLessThan(totalLines);
        }
      }),
      { numRuns: 300 },
    );
  });

  it('tokens without source maps do not produce data-source-line attributes', () => {
    fc.assert(
      fc.property(markdownDocArb, (markdown) => {
        const rawMd = new MarkdownIt({ html: true, linkify: true, typographer: true });
        const tokens = rawMd.parse(markdown, {});

        const totalBlockTokensWithMaps = tokens.filter(
          (t) => BLOCK_TOKEN_TYPES.has(t.type) && t.map && t.map.length >= 2,
        ).length;

        const html = parser.render(markdown);
        const injectedLines = extractSourceLineAttrs(html);

        // The number of injected attributes should not exceed the number of
        // block tokens that have source maps
        expect(injectedLines.length).toBeLessThanOrEqual(totalBlockTokensWithMaps);
      }),
      { numRuns: 300 },
    );
  });
});
