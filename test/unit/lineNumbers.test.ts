import { describe, it, expect } from 'vitest';
import { wrapWithLineNumbers, countLines } from '../../src/parser/lineNumbers';

describe('countLines', () => {
  it('returns 0 for empty string', () => {
    expect(countLines('')).toBe(0);
  });

  it('returns 1 for single-line string', () => {
    expect(countLines('hello')).toBe(1);
  });

  it('returns 3 for three-line string', () => {
    expect(countLines('a\nb\nc')).toBe(3);
  });

  it('trailing newline does not count as extra line', () => {
    expect(countLines('a\nb\n')).toBe(2);
  });

  it('returns 1 for single line with trailing newline', () => {
    expect(countLines('hello\n')).toBe(1);
  });
});

describe('wrapWithLineNumbers', () => {
  it('returns input unchanged when lineCount is 0', () => {
    const html = '<pre><code>hello</code></pre>';
    expect(wrapWithLineNumbers(html, 0)).toBe(html);
  });

  it('returns input unchanged when lineCount is negative', () => {
    const html = '<pre><code>hello</code></pre>';
    expect(wrapWithLineNumbers(html, -1)).toBe(html);
  });

  it('wraps code in table structure with line numbers', () => {
    const html = '<pre><code>a\nb</code></pre>';
    const result = wrapWithLineNumbers(html, 2);

    expect(result).toContain('class="ms-code-wrapper"');
    expect(result).toContain('class="ms-code-table"');
    expect(result).toContain('class="ms-line-numbers"');
    expect(result).toContain('class="ms-code-content"');
    expect(result).toContain('<pre>1\n2</pre>');
  });

  it('places code html inside ms-code-content div', () => {
    const html = '<pre><code>a\nb</code></pre>';
    const result = wrapWithLineNumbers(html, 2);

    expect(result).toContain(`<div class="ms-code-content">${html}</div>`);
  });

  it('generates correct line numbers for 3 lines', () => {
    const html = '<pre><code>a\nb\nc</code></pre>';
    const result = wrapWithLineNumbers(html, 3);

    expect(result).toContain('<pre>1\n2\n3</pre>');
  });

  it('is idempotent – already wrapped HTML is returned as-is', () => {
    const html = '<pre><code>a\nb</code></pre>';
    const once = wrapWithLineNumbers(html, 2);
    const twice = wrapWithLineNumbers(once, 2);

    expect(twice).toBe(once);
  });

  it('idempotency check uses ms-line-numbers class', () => {
    const alreadyWrapped = '<div class="ms-code-wrapper"><div class="ms-code-table">'
      + '<div class="ms-line-numbers" aria-hidden="true"><pre>1\n2</pre></div>'
      + '<div class="ms-code-content"><pre><code>a\nb</code></pre></div>'
      + '</div></div>';

    expect(wrapWithLineNumbers(alreadyWrapped, 2)).toBe(alreadyWrapped);
  });

  it('single line produces line number 1', () => {
    const html = '<pre><code>hello</code></pre>';
    const result = wrapWithLineNumbers(html, 1);

    expect(result).toContain('<pre>1</pre>');
    expect(result).toContain('class="ms-line-numbers"');
  });
});
