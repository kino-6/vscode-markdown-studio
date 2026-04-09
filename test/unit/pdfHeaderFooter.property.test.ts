import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { buildPdfOptions, injectPageBreakCss } from '../../src/export/pdfHeaderFooter';
import type { PdfHeaderFooterConfig } from '../../src/types/models';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

describe('pdfHeaderFooter property tests', () => {
  /**
   * Property 1: Default header contains escaped document title
   *
   * For any string title, when headerEnabled=true and headerTemplate=null,
   * the default header HTML (from buildPdfOptions) contains the HTML-escaped title.
   *
   * **Validates: Requirements 2.1, 2.2, 8.1, 8.2, 8.3, 8.4, 8.5**
   */
  it('Property 1: default header contains escaped document title', () => {
    fc.assert(
      fc.property(fc.string(), (title) => {
        const config: PdfHeaderFooterConfig = {
          headerEnabled: true,
          headerTemplate: null,
          footerEnabled: false,
          footerTemplate: null,
          pageBreakEnabled: false,
        };

        const result = buildPdfOptions(config, title);
        const escaped = escapeHtml(title);

        expect(result.headerTemplate).toContain(escaped);
      }),
      { numRuns: 200, seed: 42 },
    );
  });

  /**
   * Property 2: Custom template passthrough
   *
   * For any non-null template string, buildPdfOptions returns it verbatim
   * as the header or footer template without modification.
   *
   * **Validates: Requirements 4.1, 4.2**
   */
  it('Property 2: custom header template passthrough', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (customTemplate) => {
        const config: PdfHeaderFooterConfig = {
          headerEnabled: true,
          headerTemplate: customTemplate,
          footerEnabled: false,
          footerTemplate: null,
          pageBreakEnabled: false,
        };

        const result = buildPdfOptions(config, 'any-title');

        expect(result.headerTemplate).toBe(customTemplate);
      }),
      { numRuns: 200, seed: 42 },
    );
  });

  it('Property 2: custom footer template passthrough', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (customTemplate) => {
        const config: PdfHeaderFooterConfig = {
          headerEnabled: false,
          headerTemplate: null,
          footerEnabled: true,
          footerTemplate: customTemplate,
          pageBreakEnabled: false,
        };

        const result = buildPdfOptions(config, 'any-title');

        expect(result.footerTemplate).toBe(customTemplate);
      }),
      { numRuns: 200, seed: 42 },
    );
  });

  /**
   * Property 3: displayHeaderFooter flag consistency
   *
   * For any PdfHeaderFooterConfig, the displayHeaderFooter field in the output
   * of buildPdfOptions equals (headerEnabled || footerEnabled).
   *
   * **Validates: Requirements 5.3, 5.4, 5.5**
   */
  it('Property 3: displayHeaderFooter flag consistency', () => {
    const configArb = fc.record({
      headerEnabled: fc.boolean(),
      headerTemplate: fc.option(fc.string(), { nil: null }),
      footerEnabled: fc.boolean(),
      footerTemplate: fc.option(fc.string(), { nil: null }),
      pageBreakEnabled: fc.boolean(),
    });

    fc.assert(
      fc.property(configArb, (config: PdfHeaderFooterConfig) => {
        const result = buildPdfOptions(config, 'any-title');

        expect(result.displayHeaderFooter).toBe(config.headerEnabled || config.footerEnabled);
      }),
      { numRuns: 200, seed: 42 },
    );
  });

  /**
   * Property 4: Margin consistency
   *
   * For any PdfHeaderFooterConfig, the output margins of buildPdfOptions satisfy:
   * top margin is '20mm' iff headerEnabled is true (otherwise '10mm'),
   * bottom margin is '20mm' iff footerEnabled is true (otherwise '10mm'),
   * and left and right margins are always '10mm'.
   *
   * **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6**
   */
  it('Property 4: margin consistency', () => {
    const configArb = fc.record({
      headerEnabled: fc.boolean(),
      headerTemplate: fc.option(fc.string(), { nil: null }),
      footerEnabled: fc.boolean(),
      footerTemplate: fc.option(fc.string(), { nil: null }),
      pageBreakEnabled: fc.boolean(),
    });

    fc.assert(
      fc.property(configArb, (config: PdfHeaderFooterConfig) => {
        const result = buildPdfOptions(config, 'any-title');

        expect(result.margin.top).toBe(config.headerEnabled ? '20mm' : '10mm');
        expect(result.margin.bottom).toBe(config.footerEnabled ? '20mm' : '10mm');
        expect(result.margin.left).toBe('10mm');
        expect(result.margin.right).toBe('10mm');
      }),
      { numRuns: 200, seed: 42 },
    );
  });

  /**
   * Property 5: Page break CSS injection idempotency
   *
   * For any HTML string containing a `</head>` tag, applying `injectPageBreakCss`
   * twice produces the same result as applying it once.
   *
   * **Validates: Requirement 7.4**
   */
  it('Property 5: page break CSS injection idempotency', () => {
    const htmlWithHeadArb = fc
      .tuple(fc.string(), fc.string())
      .map(([before, after]) => before + '</head>' + after);

    fc.assert(
      fc.property(htmlWithHeadArb, (html) => {
        const once = injectPageBreakCss(html);
        const twice = injectPageBreakCss(once);

        expect(twice).toBe(once);
      }),
      { numRuns: 200, seed: 42 },
    );
  });

  /**
   * Property 6: Page break injector no-op without head tag
   *
   * For any HTML string that does not contain `</head>`, `injectPageBreakCss`
   * returns the original string unchanged.
   *
   * **Validates: Requirement 7.3**
   */
  it('Property 6: page break injector no-op without head tag', () => {
    fc.assert(
      fc.property(
        fc.string().filter((s) => !s.includes('</head>')),
        (html) => {
          expect(injectPageBreakCss(html)).toBe(html);
        },
      ),
      { numRuns: 200, seed: 42 },
    );
  });
});
