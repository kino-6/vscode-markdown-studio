import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { wrapWithLineNumbers, countLines, extractCodeContent } from '../../src/parser/lineNumbers';

// Feature: code-block-line-numbers, Property 1: Line count and line number correctness

/**
 * Property 1: For any code string, countLines matches expected line count,
 * and wrapWithLineNumbers produces correct number of lines in the line-numbers column.
 */

/** Extract line numbers from the div-based line-numbers pre element */
function extractLineNumbers(html: string): number[] {
  const match = html.match(/<div class="ms-line-numbers"[^>]*><pre>([\s\S]*?)<\/pre><\/div>/);
  if (!match) return [];
  return match[1].split('\n').map((n) => parseInt(n, 10));
}

describe('lineNumbers property tests – Property 1: line count correctness', () => {
  it('Property 1: countLines matches expected count and wrapWithLineNumbers produces correct line numbers', () => {
    const multiLineCodeArb = fc
      .array(fc.string(), { minLength: 1, maxLength: 50 })
      .map((lines) => lines.join('\n'))
      .filter((code) => code !== '');

    fc.assert(
      fc.property(multiLineCodeArb, (code) => {
        const lineCount = countLines(code);
        const html = `<pre><code>${code}</code></pre>`;
        const result = wrapWithLineNumbers(html, lineCount);

        if (lineCount === 0) {
          expect(result).toBe(html);
          return;
        }

        const lineNums = extractLineNumbers(result);

        // Line number count must match countLines
        expect(lineNums.length).toBe(lineCount);

        // Each line number must be sequential from 1 to N
        for (let i = 0; i < lineNums.length; i++) {
          expect(lineNums[i]).toBe(i + 1);
        }
      }),
      { numRuns: 200 },
    );
  });

  it('Property 1: countLines for empty string returns 0', () => {
    expect(countLines('')).toBe(0);
  });

  it('Property 1: trailing newline does not add extra line', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 20 }),
        (lines) => {
          const withTrailing = lines.join('\n') + '\n';
          const withoutTrailing = lines.join('\n');
          expect(countLines(withTrailing)).toBe(countLines(withoutTrailing));
        },
      ),
      { numRuns: 200 },
    );
  });
});

// Feature: code-block-line-numbers, Property 3: Round-trip preservation

/**
 * Property 3: extractCodeContent(wrapWithLineNumbers(html, n)) === html
 */
describe('lineNumbers property tests – Property 3: round-trip preservation', () => {
  it('Property 3: round-trip through wrapWithLineNumbers → extractCodeContent preserves HTML (after trailing newline trim)', () => {
    const codeHtmlArb = fc
      .array(fc.string(), { minLength: 1, maxLength: 30 })
      .map((lines) => `<pre><code>${lines.join('\n')}</code></pre>`)
      .filter((html) => !html.includes('ms-line-numbers'));

    fc.assert(
      fc.property(
        codeHtmlArb,
        fc.integer({ min: 1, max: 100 }),
        (html, lineCount) => {
          const wrapped = wrapWithLineNumbers(html, lineCount);
          const extracted = extractCodeContent(wrapped);

          // wrapWithLineNumbers strips a trailing \n before </code></pre>
          // to prevent an extra blank line in the browser, so the round-trip
          // result matches the trimmed version of the original HTML.
          const expected = html.replace(/\n<\/code><\/pre>/, '</code></pre>');
          expect(extracted).toBe(expected);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('Property 3: extractCodeContent on unwrapped HTML returns it unchanged', () => {
    const html = '<pre><code>hello</code></pre>';
    expect(extractCodeContent(html)).toBe(html);
  });
});

// Feature: code-block-line-numbers, Property 4: Idempotency

/**
 * Property 4: wrapWithLineNumbers(wrapWithLineNumbers(html, n), n) === wrapWithLineNumbers(html, n)
 */
describe('lineNumbers property tests – Property 4: idempotency', () => {
  it('Property 4: applying wrapWithLineNumbers twice equals applying it once', () => {
    const codeHtmlArb = fc
      .array(fc.string(), { minLength: 1, maxLength: 30 })
      .map((lines) => `<pre><code>${lines.join('\n')}</code></pre>`);

    fc.assert(
      fc.property(
        codeHtmlArb,
        fc.integer({ min: 1, max: 100 }),
        (html, lineCount) => {
          const once = wrapWithLineNumbers(html, lineCount);
          const twice = wrapWithLineNumbers(once, lineCount);

          expect(twice).toBe(once);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('Property 4: zero lineCount is idempotent (returns input unchanged)', () => {
    fc.assert(
      fc.property(fc.string(), (html) => {
        const once = wrapWithLineNumbers(html, 0);
        const twice = wrapWithLineNumbers(once, 0);

        expect(once).toBe(html);
        expect(twice).toBe(html);
      }),
      { numRuns: 200 },
    );
  });
});
