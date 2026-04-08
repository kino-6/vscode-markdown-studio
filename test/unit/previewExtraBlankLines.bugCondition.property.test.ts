import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { createMarkdownParser } from '../../src/parser/parseMarkdown';

// Feature: preview-extra-blank-lines, Property 1: Bug Condition
// フェンスドコードブロック末尾余分空行

/**
 * Generate random code content for fenced code blocks.
 * Produces 1 to 5 lines of printable ASCII text, optionally with a trailing newline.
 */
const codeContentArb = fc
  .array(
    fc.stringMatching(/^[a-zA-Z0-9_(){};=\- ."']+$/),
    { minLength: 1, maxLength: 5 }
  )
  .map((lines) => lines.join('\n'))
  .chain((code) =>
    fc.boolean().map((addTrailingNewline) =>
      addTrailingNewline ? code + '\n' : code
    )
  );

/**
 * Languages supported by highlight.js in this project.
 */
const languageArb = fc.constantFrom(
  'typescript', 'javascript', 'python', 'json', 'bash', 'go', 'rust', 'sql', ''
);

/**
 * Build a fenced markdown code block from language and code content.
 */
function buildFencedBlock(lang: string, code: string): string {
  return `\`\`\`${lang}\n${code}\n\`\`\`\n`;
}

/**
 * Extract the content between <code...> and </code> from rendered HTML.
 * Returns the inner text of the first <code> element found.
 */
function extractCodeInner(html: string): string | null {
  const match = html.match(/<code[^>]*>([\s\S]*?)<\/code>/);
  return match ? match[1] : null;
}

/**
 * Count the number of line-number entries in the rendered line-numbers column.
 */
function extractLineNumberCount(html: string): number {
  const match = html.match(/<div class="ms-line-numbers"[^>]*><pre>([\s\S]*?)<\/pre><\/div>/);
  if (!match) return 0;
  const nums = match[1].trim();
  if (nums === '') return 0;
  return nums.split('\n').length;
}

/**
 * Count the actual visible code lines from the <code> element content.
 * Strips HTML tags to get plain text, then counts non-trailing lines.
 */
function countVisibleCodeLines(codeInner: string): number {
  // Strip HTML tags (hljs spans etc.)
  const plain = codeInner.replace(/<[^>]*>/g, '');
  if (plain === '') return 0;
  const lines = plain.split('\n');
  // A trailing empty string from a trailing \n doesn't count as a visible line
  if (lines[lines.length - 1] === '') {
    return lines.length - 1;
  }
  return lines.length;
}

describe('previewExtraBlankLines bug condition – Property 1', () => {
  /**
   * Property 1: Bug Condition - フェンスドコードブロック末尾余分空行
   *
   * For any fenced code block rendered by createMarkdownParser(),
   * the <code> element MUST NOT contain a trailing \n before </code>.
   * This test encodes the EXPECTED (correct) behavior.
   * It is expected to FAIL on unfixed code, proving the bug exists.
   *
   * **Validates: Requirements 1.1, 1.2, 2.1, 2.2**
   */
  it('lineNumbers disabled: <code> must not end with trailing \\n', () => {
    const md = createMarkdownParser({ lineNumbers: false });

    fc.assert(
      fc.property(codeContentArb, languageArb, (code, lang) => {
        const markdown = buildFencedBlock(lang, code);
        const html = md.render(markdown);
        const codeInner = extractCodeInner(html);

        expect(codeInner).not.toBeNull();
        // The code content inside <code> must NOT end with \n
        expect(codeInner!.endsWith('\n')).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it('lineNumbers enabled: <code> must not end with trailing \\n', () => {
    const md = createMarkdownParser({ lineNumbers: true });

    fc.assert(
      fc.property(codeContentArb, languageArb, (code, lang) => {
        const markdown = buildFencedBlock(lang, code);
        const html = md.render(markdown);
        const codeInner = extractCodeInner(html);

        expect(codeInner).not.toBeNull();
        // The code content inside <code> must NOT end with \n
        expect(codeInner!.endsWith('\n')).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it('lineNumbers enabled: line number count must match actual code line count', () => {
    const md = createMarkdownParser({ lineNumbers: true });

    fc.assert(
      fc.property(codeContentArb, languageArb, (code, lang) => {
        const markdown = buildFencedBlock(lang, code);
        const html = md.render(markdown);

        const lineNumCount = extractLineNumberCount(html);
        const codeInner = extractCodeInner(html);
        expect(codeInner).not.toBeNull();

        const visibleLines = countVisibleCodeLines(codeInner!);

        // Line number column count must match visible code lines
        expect(lineNumCount).toBe(visibleLines);
      }),
      { numRuns: 100 }
    );
  });
});
