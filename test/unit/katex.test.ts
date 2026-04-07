import { describe, it, expect } from 'vitest';
import { createMarkdownParser } from '../../src/parser/parseMarkdown';

describe('KaTeX math rendering', () => {
  const md = createMarkdownParser();

  it('renders inline math $...$', () => {
    const html = md.render('Inline $E = mc^2$ here.');
    expect(html).toContain('katex');
    expect(html).toContain('E');
  });

  it('renders display math $$...$$', () => {
    const html = md.render('$$\n\\int_0^1 x^2 dx\n$$');
    expect(html).toContain('katex-display');
  });

  it('does not break regular dollar signs', () => {
    const html = md.render('Price is $5 and $10.');
    // Single $ with space after should not be treated as math
    expect(html).toContain('$5');
  });

  it('renders Greek letters', () => {
    const html = md.render('$\\alpha + \\beta = \\gamma$');
    expect(html).toContain('katex');
  });

  it('handles invalid LaTeX gracefully', () => {
    const html = md.render('$\\invalid{$');
    // Should not throw, should render something (error or raw)
    expect(html).toBeDefined();
  });
});
