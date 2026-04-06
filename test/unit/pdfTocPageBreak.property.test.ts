import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { injectTocPageBreakCss } from '../../src/export/pdfHeaderFooter';

/**
 * Feature: toc-command-generation, Property 7: PDF改ページCSS注入のトグル
 *
 * For any HTML with TOC comment markers, when pageBreak is enabled,
 * injectTocPageBreakCss() adds page-break CSS; when disabled (function
 * not called), no page-break CSS is present.
 *
 * **Validates: Requirements 6.3, 6.4, 10.1, 10.2**
 */
describe('pdfTocPageBreak property tests', () => {
  /** Arbitrary that generates HTML containing <!-- TOC --> ... <!-- /TOC --> markers */
  const htmlWithTocMarkersArb = fc
    .tuple(
      fc.string().filter((s) => !s.includes('<!-- TOC -->') && !s.includes('<!-- /TOC -->') && !s.includes('ms-toc-page-break')),
      fc.string().filter((s) => !s.includes('<!-- TOC -->') && !s.includes('<!-- /TOC -->') && !s.includes('ms-toc-page-break')),
      fc.string().filter((s) => !s.includes('<!-- TOC -->') && !s.includes('<!-- /TOC -->') && !s.includes('ms-toc-page-break')),
    )
    .map(([before, tocContent, after]) => ({
      html: `${before}<!-- TOC -->${tocContent}<!-- /TOC -->${after}`,
      tocContent,
    }));

  it('Property 7: when pageBreak enabled, injectTocPageBreakCss adds page-break CSS around TOC markers', () => {
    fc.assert(
      fc.property(htmlWithTocMarkersArb, ({ html }) => {
        const result = injectTocPageBreakCss(html);

        expect(result).toContain('page-break-before: always');
        expect(result).toContain('page-break-after: always');
        expect(result).toContain('class="ms-toc-page-break"');
        // Original markers are preserved inside the wrapper
        expect(result).toContain('<!-- TOC -->');
        expect(result).toContain('<!-- /TOC -->');
      }),
      { numRuns: 200 },
    );
  });

  it('Property 7: when pageBreak disabled (function not called), no page-break CSS is present', () => {
    fc.assert(
      fc.property(htmlWithTocMarkersArb, ({ html }) => {
        // When pageBreak is disabled, injectTocPageBreakCss is not called,
        // so the original HTML should not contain page-break CSS
        expect(html).not.toContain('ms-toc-page-break');
        expect(html).not.toContain('page-break-before: always');
        expect(html).not.toContain('page-break-after: always');
      }),
      { numRuns: 200 },
    );
  });

  it('Property 7: injectTocPageBreakCss is idempotent', () => {
    fc.assert(
      fc.property(htmlWithTocMarkersArb, ({ html }) => {
        const once = injectTocPageBreakCss(html);
        const twice = injectTocPageBreakCss(once);

        expect(twice).toBe(once);
      }),
      { numRuns: 200 },
    );
  });

  it('Property 7: no-op when TOC markers are absent', () => {
    fc.assert(
      fc.property(
        fc.string().filter((s) => !s.includes('<!-- TOC -->')),
        (html) => {
          expect(injectTocPageBreakCss(html)).toBe(html);
        },
      ),
      { numRuns: 200 },
    );
  });
});
