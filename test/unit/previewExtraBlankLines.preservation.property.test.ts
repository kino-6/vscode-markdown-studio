import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { countLines, wrapWithLineNumbers } from '../../src/parser/lineNumbers';
import { createMarkdownParser } from '../../src/parser/parseMarkdown';

// Feature: preview-extra-blank-lines, Property 2: Preservation
// 行番号正確性・シンタックスハイライト・単一行表示の保存

/**
 * Generate random code content: 1–5 lines of printable ASCII text.
 */
const codeContentArb = fc
  .array(
    fc.stringMatching(/^[a-zA-Z0-9_(){};=\- ."']+$/),
    { minLength: 1, maxLength: 5 }
  )
  .map((lines) => lines.join('\n'));

/**
 * Single-line code content (no newlines).
 */
const singleLineArb = fc.stringMatching(/^[a-zA-Z0-9_(){};=\-."']{1,40}$/).filter((s) => s.trim().length > 0);

/**
 * Languages that highlight.js recognises in this project.
 */
const highlightableLanguageArb = fc.constantFrom(
  'typescript', 'python', 'json', 'bash'
);

/**
 * Build a fenced markdown code block.
 */
function buildFencedBlock(lang: string, code: string): string {
  return `\`\`\`${lang}\n${code}\n\`\`\`\n`;
}

/**
 * Extract the content between <code...> and </code>.
 */
function extractCodeInner(html: string): string | null {
  const match = html.match(/<code[^>]*>([\s\S]*?)<\/code>/);
  return match ? match[1] : null;
}

/**
 * Count line-number entries in the rendered line-numbers column.
 */
function extractLineNumberCount(html: string): number {
  const match = html.match(/<div class="ms-line-numbers"[^>]*><pre>([\s\S]*?)<\/pre><\/div>/);
  if (!match) return 0;
  const nums = match[1].trim();
  if (nums === '') return 0;
  return nums.split('\n').length;
}

describe('previewExtraBlankLines preservation – Property 2', () => {

  /**
   * Property 2a: countLines() returns correct line count for random code strings.
   *
   * For any non-empty code string, countLines() equals the number of '\n'
   * characters when the string does NOT end with '\n', or one less when it does.
   * Empty string returns 0.
   *
   * **Validates: Requirements 3.1, 3.2**
   */
  it('countLines returns correct line count for random code strings', () => {
    fc.assert(
      fc.property(codeContentArb, (code) => {
        const result = countLines(code);

        if (code === '') {
          expect(result).toBe(0);
          return;
        }

        const newlineCount = (code.match(/\n/g) || []).length;
        if (code.endsWith('\n')) {
          // Trailing newline does not count as extra line
          expect(result).toBe(newlineCount);
        } else {
          expect(result).toBe(newlineCount + 1);
        }
      }),
      { numRuns: 200 }
    );
  });

  /**
   * Property 2b: wrapWithLineNumbers() generates the correct number of
   * line numbers in the line-number column.
   *
   * **Validates: Requirements 3.2**
   */
  it('wrapWithLineNumbers generates lineCount line numbers', () => {
    const lineCountArb = fc.integer({ min: 1, max: 20 });
    const codeHtmlArb = fc.stringMatching(/^[a-zA-Z0-9 ]+$/).map(
      (text) => `<pre><code>${text}</code></pre>`
    );

    fc.assert(
      fc.property(codeHtmlArb, lineCountArb, (codeHtml, lineCount) => {
        const result = wrapWithLineNumbers(codeHtml, lineCount);

        // Should contain the line-numbers column
        expect(result).toContain('class="ms-line-numbers"');

        const numCount = extractLineNumberCount(result);
        expect(numCount).toBe(lineCount);
      }),
      { numRuns: 200 }
    );
  });

  /**
   * Property 2c: Single-line code blocks render as 1 line (line doesn't disappear).
   *
   * **Validates: Requirements 3.5**
   */
  it('single-line code blocks render with line number 1', () => {
    const md = createMarkdownParser({ lineNumbers: true });

    fc.assert(
      fc.property(singleLineArb, (code) => {
        const markdown = buildFencedBlock('typescript', code);
        const html = md.render(markdown);

        // Line-number column must exist and show exactly 1
        const numCount = extractLineNumberCount(html);
        expect(numCount).toBe(1);

        // Code content must not be empty
        const codeInner = extractCodeInner(html);
        expect(codeInner).not.toBeNull();
        expect(codeInner!.replace(/<[^>]*>/g, '').trim().length).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2d: Syntax highlighting <span> tags are preserved for
   * known languages.
   *
   * **Validates: Requirements 3.4**
   */
  it('syntax highlighting span tags are preserved for known languages', () => {
    const md = createMarkdownParser({ lineNumbers: true });

    // Use code snippets that are guaranteed to produce highlighting
    const codeSnippets: Record<string, string> = {
      typescript: 'const x: number = 42;',
      python: 'def hello():\n    return True',
      json: '{"key": "value"}',
      bash: 'echo "hello world"',
    };

    for (const [lang, code] of Object.entries(codeSnippets)) {
      const markdown = buildFencedBlock(lang, code);
      const html = md.render(markdown);
      const codeInner = extractCodeInner(html);

      expect(codeInner).not.toBeNull();
      // Highlighted code must contain hljs span tags
      expect(codeInner).toMatch(/<span class="hljs-/);
    }
  });

  /**
   * Property 2e: Different languages get highlighting applied
   * (property-based across random language selection).
   *
   * **Validates: Requirements 3.4**
   */
  it('different languages get highlighting applied', () => {
    const md = createMarkdownParser({ lineNumbers: true });

    // Map languages to code that reliably triggers highlighting
    const langCodeMap: Record<string, string> = {
      typescript: 'const x: number = 42;',
      python: 'def hello():\n    return True',
      json: '{"key": "value"}',
      bash: 'echo "hello world"',
    };

    fc.assert(
      fc.property(highlightableLanguageArb, (lang) => {
        const code = langCodeMap[lang];
        const markdown = buildFencedBlock(lang, code);
        const html = md.render(markdown);
        const codeInner = extractCodeInner(html);

        expect(codeInner).not.toBeNull();
        expect(codeInner).toMatch(/<span class="hljs-/);
      }),
      { numRuns: 100 }
    );
  });
});
