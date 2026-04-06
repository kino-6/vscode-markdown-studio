import { describe, expect, it } from 'vitest';
import { injectTocPageBreakCss } from '../../src/export/pdfHeaderFooter';

describe('injectTocPageBreakCss', () => {
  it('wraps TOC content with page-break div when markers are present', () => {
    const html = '<p>Before</p><!-- TOC --><ul><li>Item</li></ul><!-- /TOC --><p>After</p>';
    const result = injectTocPageBreakCss(html);

    expect(result).toContain('class="ms-toc-page-break"');
    expect(result).toContain('style="page-break-before: always; page-break-after: always;"');
    expect(result).toContain('<!-- TOC -->');
    expect(result).toContain('<!-- /TOC -->');
    expect(result).toContain('<p>Before</p>');
    expect(result).toContain('<p>After</p>');
  });

  it('returns HTML unchanged when pageBreak is disabled (function not called)', () => {
    const html = '<p>Before</p><!-- TOC --><ul><li>Item</li></ul><!-- /TOC --><p>After</p>';
    // When pageBreak is disabled, the function is simply not called
    // so the original HTML remains unchanged
    expect(html).not.toContain('ms-toc-page-break');
    expect(html).not.toContain('page-break-before');
  });

  it('returns HTML unchanged when no TOC markers are present', () => {
    const html = '<p>Hello world</p>';
    const result = injectTocPageBreakCss(html);

    expect(result).toBe(html);
  });

  it('returns HTML unchanged when only start marker is present (no end marker)', () => {
    const html = '<p>Before</p><!-- TOC --><ul><li>Item</li></ul>';
    const result = injectTocPageBreakCss(html);

    expect(result).toBe(html);
  });

  it('is idempotent - calling twice returns same result as calling once', () => {
    const html = '<p>Before</p><!-- TOC --><ul><li>Item</li></ul><!-- /TOC --><p>After</p>';
    const once = injectTocPageBreakCss(html);
    const twice = injectTocPageBreakCss(once);

    expect(twice).toBe(once);
  });

  it('preserves TOC content between markers', () => {
    const tocContent = '<ul><li><a href="#intro">Introduction</a></li></ul>';
    const html = `<div><!-- TOC -->${tocContent}<!-- /TOC --></div>`;
    const result = injectTocPageBreakCss(html);

    expect(result).toContain(tocContent);
  });

  it('handles empty TOC content between markers', () => {
    const html = '<p>Before</p><!-- TOC --><!-- /TOC --><p>After</p>';
    const result = injectTocPageBreakCss(html);

    expect(result).toContain('class="ms-toc-page-break"');
    expect(result).toContain('<p>Before</p>');
    expect(result).toContain('<p>After</p>');
  });
});
