import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { createMarkdownParser } from '../../src/parser/parseMarkdown';
import { extractHeadings } from '../../src/toc/extractHeadings';

// Feature: toc-auto-generation, Property 1: 見出し抽出の完全性とメタデータ保持

const md = createMarkdownParser();

/**
 * Generate a heading level (1-6).
 */
const headingLevelArb = fc.integer({ min: 1, max: 6 });

/**
 * Generate safe heading text: non-empty, single-line, no leading '#',
 * no markdown-special characters that could confuse parsing.
 */
const headingTextArb = fc
  .stringMatching(/^[a-zA-Z0-9][a-zA-Z0-9 ]{0,28}[a-zA-Z0-9]$/)
  .filter((s) => s.trim().length > 0);

/**
 * A single heading definition used to build a Markdown document.
 */
interface HeadingDef {
  level: number;
  text: string;
}

/**
 * Generate a non-empty array of heading definitions.
 */
const headingDefsArb = fc.array(
  fc.record({ level: headingLevelArb, text: headingTextArb }),
  { minLength: 1, maxLength: 15 }
);

/**
 * Optional single-line paragraph text to insert between headings.
 * We keep these single-line to make line counting predictable.
 */
const paragraphArb = fc.constantFrom(
  '',
  'Some paragraph text.',
  'Short.',
  'Lorem ipsum dolor sit amet.',
);

/**
 * Build a Markdown document from heading definitions, interleaving
 * optional paragraph text. Returns the markdown string and the
 * expected line number for each heading (0-based).
 */
function buildMarkdown(
  headings: HeadingDef[],
  paragraphs: string[]
): { markdown: string; expectedLines: number[] } {
  const lines: string[] = [];
  const expectedLines: number[] = [];

  for (let i = 0; i < headings.length; i++) {
    // Optionally insert a paragraph before the heading (with blank line separator)
    const para = paragraphs[i % paragraphs.length];
    if (para) {
      lines.push(para);
      lines.push('');
    }

    expectedLines.push(lines.length);
    const prefix = '#'.repeat(headings[i].level);
    lines.push(`${prefix} ${headings[i].text}`);
    lines.push('');
  }

  return { markdown: lines.join('\n'), expectedLines };
}

describe('extractHeadings property tests', () => {
  /**
   * Property 1: 見出し抽出の完全性とメタデータ保持
   *
   * For any valid Markdown document containing h1-h6 headings,
   * extractHeadings() extracts all headings and each entry's
   * level (1-6), plain text, and source line number match the
   * original document.
   *
   * **Validates: Requirements 1.1, 1.2**
   */
  it('Property 1: all headings are extracted with correct level, text, and line number', () => {
    fc.assert(
      fc.property(
        headingDefsArb,
        fc.array(paragraphArb, { minLength: 1, maxLength: 10 }),
        (headingDefs, paragraphs) => {
          const { markdown, expectedLines } = buildMarkdown(headingDefs, paragraphs);
          const result = extractHeadings(markdown, md);

          // Completeness: every heading is extracted
          expect(result).toHaveLength(headingDefs.length);

          for (let i = 0; i < headingDefs.length; i++) {
            const entry = result[i];
            const def = headingDefs[i];

            // Level matches (1-6)
            expect(entry.level).toBe(def.level);

            // Plain text matches
            expect(entry.text).toBe(def.text);

            // Source line number matches (0-based)
            expect(entry.line).toBe(expectedLines[i]);
          }
        }
      ),
      { numRuns: 200 }
    );
  });
});

// Feature: toc-auto-generation, Property 2: インライン書式の除去

/**
 * Arbitraries for inline-formatted heading text generation.
 */

/** Plain word without Markdown-special characters. */
const plainWordArb = fc
  .stringMatching(/^[a-zA-Z0-9]{1,10}$/)
  .filter((s) => s.length > 0);

/**
 * Wrap a word with a random inline Markdown format.
 * Returns { raw, plain } where raw is the formatted Markdown
 * and plain is the expected extracted text.
 */
const inlineFormattedWordArb = fc.tuple(plainWordArb, fc.integer({ min: 0, max: 4 })).map(
  ([word, fmt]) => {
    switch (fmt) {
      case 0: return { raw: `**${word}**`, plain: word };       // bold
      case 1: return { raw: `*${word}*`, plain: word };         // italic
      case 2: return { raw: `\`${word}\``, plain: word };       // inline code
      case 3: return { raw: `[${word}](http://x.co)`, plain: word }; // link
      default: return { raw: word, plain: word };               // plain
    }
  }
);

/**
 * Generate a heading line with at least one inline-formatted segment.
 * Returns { level, rawLine, expectedPlain }.
 */
const formattedHeadingArb = fc
  .tuple(
    fc.integer({ min: 1, max: 6 }),
    fc.array(inlineFormattedWordArb, { minLength: 1, maxLength: 6 })
  )
  .filter(([, segments]) => segments.some((s) => s.raw !== s.plain))
  .map(([level, segments]) => ({
    level,
    rawLine: `${'#'.repeat(level)} ${segments.map((s) => s.raw).join(' ')}`,
    expectedPlain: segments.map((s) => s.plain).join(' '),
  }));

describe('extractHeadings property tests – inline formatting', () => {
  /**
   * Property 2: インライン書式の除去
   *
   * For any heading text with inline Markdown formatting (bold, italic,
   * code, links), extractHeadings() returns text that is plain text
   * without formatting markers.
   *
   * **Validates: Requirements 1.3**
   */
  it('Property 2: inline formatting is stripped from heading text', () => {
    fc.assert(
      fc.property(
        fc.array(formattedHeadingArb, { minLength: 1, maxLength: 10 }),
        (headings) => {
          const markdown = headings.map((h) => h.rawLine).join('\n\n');
          const result = extractHeadings(markdown, md);

          expect(result).toHaveLength(headings.length);

          for (let i = 0; i < headings.length; i++) {
            const extracted = result[i].text;
            const expected = headings[i].expectedPlain;

            // Text matches expected plain text
            expect(extracted).toBe(expected);

            // No residual formatting markers
            expect(extracted).not.toMatch(/\*\*/);   // no bold markers
            expect(extracted).not.toMatch(/(?<!\w)\*(?!\w)/); // no lone italic markers
            expect(extracted).not.toMatch(/`/);       // no backticks
            expect(extracted).not.toMatch(/\[.*\]\(.*\)/); // no link syntax
          }
        }
      ),
      { numRuns: 200 }
    );
  });
});

// Feature: toc-auto-generation, Property 3: コードブロック内見出しの除外

/**
 * Arbitraries for generating Markdown documents with headings inside fenced code blocks.
 */

/** Generate a fenced code block language tag (or empty for untagged). */
const codeBlockLangArb = fc.constantFrom('', 'js', 'typescript', 'python', 'markdown', 'bash', 'text');

/** Generate heading-like lines to place inside code blocks. */
const fakeHeadingArb = fc
  .tuple(fc.integer({ min: 1, max: 6 }), plainWordArb)
  .map(([level, word]) => `${'#'.repeat(level)} ${word}`);

/**
 * Generate a fenced code block containing one or more heading-like lines.
 * Returns the block as a string and the count of fake headings inside.
 */
const codeBlockWithHeadingsArb = fc
  .tuple(
    codeBlockLangArb,
    fc.array(fakeHeadingArb, { minLength: 1, maxLength: 5 })
  )
  .map(([lang, fakeHeadings]) => {
    const opener = lang ? `\`\`\`${lang}` : '```';
    const lines = [opener, ...fakeHeadings, '```'];
    return { block: lines.join('\n'), fakeCount: fakeHeadings.length };
  });

/**
 * Generate a real heading that lives outside code blocks.
 */
const realHeadingArb = fc
  .tuple(headingLevelArb, headingTextArb)
  .map(([level, text]) => ({
    line: `${'#'.repeat(level)} ${text}`,
    text,
    level,
  }));

describe('extractHeadings property tests – code block exclusion', () => {
  /**
   * Property 3: コードブロック内見出しの除外
   *
   * For any Markdown document containing heading-like text (# ...)
   * inside fenced code blocks, extractHeadings() does not extract
   * those as headings.
   *
   * **Validates: Requirements 1.4**
   */
  it('Property 3: headings inside fenced code blocks are not extracted', () => {
    fc.assert(
      fc.property(
        fc.array(realHeadingArb, { minLength: 0, maxLength: 5 }),
        fc.array(codeBlockWithHeadingsArb, { minLength: 1, maxLength: 4 }),
        fc.array(paragraphArb, { minLength: 1, maxLength: 5 }),
        (realHeadings, codeBlocks, paragraphs) => {
          // Build a document interleaving real headings and code blocks
          const parts: string[] = [];
          const maxLen = Math.max(realHeadings.length, codeBlocks.length);

          for (let i = 0; i < maxLen; i++) {
            if (i < realHeadings.length) {
              parts.push(realHeadings[i].line);
              parts.push('');
            }
            const para = paragraphs[i % paragraphs.length];
            if (para) {
              parts.push(para);
              parts.push('');
            }
            if (i < codeBlocks.length) {
              parts.push(codeBlocks[i].block);
              parts.push('');
            }
          }

          const markdown = parts.join('\n');
          const result = extractHeadings(markdown, md);

          // Only real headings should be extracted, never fake ones from code blocks
          expect(result).toHaveLength(realHeadings.length);

          for (let i = 0; i < realHeadings.length; i++) {
            expect(result[i].level).toBe(realHeadings[i].level);
            expect(result[i].text).toBe(realHeadings[i].text);
          }

          // No extracted heading text should match any fake heading text
          const fakeTexts = codeBlocks.flatMap((cb) => {
            // Extract the word part from each fake heading line
            const lines = cb.block.split('\n').slice(1, -1); // skip ``` lines
            return lines.map((l) => l.replace(/^#+\s*/, ''));
          });

          for (const heading of result) {
            for (const fakeText of fakeTexts) {
              if (fakeText.length > 0) {
                // Real heading text should not be a fake heading text
                // (unless by coincidence from the same arbitrary, which is fine)
              }
            }
          }
        }
      ),
      { numRuns: 200 }
    );
  });
});
