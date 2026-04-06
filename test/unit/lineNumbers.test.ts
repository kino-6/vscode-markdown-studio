import { describe, it, expect } from 'vitest';
import { wrapWithLineNumbers } from '../../src/parser/lineNumbers';

/** Extract all line number values from the output HTML */
function extractLineNumbers(html: string): number[] {
  const matches = [...html.matchAll(/<span class="ms-line-number">(\d+)<\/span>/g)];
  return matches.map((m) => parseInt(m[1], 10));
}

describe('wrapWithLineNumbers', () => {
  // Requirement 1.3: empty code block produces no line number elements
  it('returns empty string for empty input (Req 1.3)', () => {
    const result = wrapWithLineNumbers('');
    expect(result).toBe('');
    expect(extractLineNumbers(result)).toHaveLength(0);
  });

  // Requirement 1.1: multi-line code produces sequential line numbers starting from 1
  it('generates sequential line numbers for multi-line code (Req 1.1)', () => {
    const code = 'line one\nline two\nline three';
    const result = wrapWithLineNumbers(code);
    const lineNums = extractLineNumbers(result);

    expect(lineNums).toEqual([1, 2, 3]);
  });

  it('wraps each line in ms-code-line span (Req 1.1)', () => {
    const code = 'a\nb';
    const result = wrapWithLineNumbers(code);

    expect(result).toContain('<span class="ms-code-line">');
    expect(result).toContain('<span class="ms-line-number">1</span>');
    expect(result).toContain('<span class="ms-line-number">2</span>');
  });

  it('handles single-line code correctly (Req 1.1)', () => {
    const result = wrapWithLineNumbers('hello');
    const lineNums = extractLineNumbers(result);

    expect(lineNums).toEqual([1]);
  });

  it('drops trailing empty line from trailing newline (Req 1.1)', () => {
    const code = 'first\nsecond\n';
    const result = wrapWithLineNumbers(code);
    const lineNums = extractLineNumbers(result);

    // Should have 2 lines, not 3 — trailing newline doesn't create an extra numbered line
    expect(lineNums).toEqual([1, 2]);
  });

  // Requirement 2.3: plain text (no language / no hljs spans) still gets line numbers
  it('adds line numbers to plain text without hljs spans (Req 2.3)', () => {
    const plainText = 'no highlighting here\njust plain text\nthird line';
    const result = wrapWithLineNumbers(plainText);
    const lineNums = extractLineNumbers(result);

    expect(lineNums).toEqual([1, 2, 3]);
    expect(result).toContain('no highlighting here');
    expect(result).toContain('just plain text');
    expect(result).toContain('third line');
  });

  it('preserves plain text content inside line wrappers (Req 2.3)', () => {
    const result = wrapWithLineNumbers('foo\nbar');

    expect(result).toContain(
      '<span class="ms-code-line"><span class="ms-line-number">1</span>foo</span>',
    );
    expect(result).toContain(
      '<span class="ms-code-line"><span class="ms-line-number">2</span>bar</span>',
    );
  });
});
