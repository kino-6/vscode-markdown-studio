import { describe, expect, it } from 'vitest';
import {
  getDefaultHeaderTemplate,
  getDefaultFooterTemplate,
  buildPdfOptions,
  injectPageBreakCss,
} from '../../src/export/pdfHeaderFooter';
import type { PdfHeaderFooterConfig } from '../../src/types/models';

describe('getDefaultHeaderTemplate', () => {
  it('returns HTML with empty span for empty title', () => {
    const result = getDefaultHeaderTemplate('');
    expect(result).toContain('<span></span>');
  });

  it('embeds a normal title in the HTML', () => {
    const result = getDefaultHeaderTemplate('My Report');
    expect(result).toContain('My Report');
  });

  it('escapes <script> tags to prevent XSS', () => {
    const result = getDefaultHeaderTemplate('<script>alert("xss")</script>');
    expect(result).toContain('&lt;script&gt;');
    expect(result).not.toContain('<script>');
  });

  it('escapes & to &amp;', () => {
    const result = getDefaultHeaderTemplate('A & B');
    expect(result).toContain('&amp;');
  });

  it("escapes ' to &#39;", () => {
    const result = getDefaultHeaderTemplate("it's");
    expect(result).toContain('&#39;');
  });

  it('contains font-size style', () => {
    const result = getDefaultHeaderTemplate('Title');
    expect(result).toContain('font-size');
  });

  it('spans full width (contains width:100%)', () => {
    const result = getDefaultHeaderTemplate('Title');
    expect(result).toContain('width:100%');
  });
});

describe('getDefaultFooterTemplate', () => {
  it('contains <span class="pageNumber"></span>', () => {
    const result = getDefaultFooterTemplate();
    expect(result).toContain('<span class="pageNumber"></span>');
  });

  it('contains <span class="totalPages"></span>', () => {
    const result = getDefaultFooterTemplate();
    expect(result).toContain('<span class="totalPages"></span>');
  });

  it('contains "Page" and "of" text', () => {
    const result = getDefaultFooterTemplate();
    expect(result).toContain('Page');
    expect(result).toContain('of');
  });

  it('contains font-size style', () => {
    const result = getDefaultFooterTemplate();
    expect(result).toContain('font-size');
  });
});

describe('buildPdfOptions', () => {
  it('both enabled with null templates → uses defaults, displayHeaderFooter=true, margins 20mm/20mm', () => {
    const config: PdfHeaderFooterConfig = {
      headerEnabled: true,
      headerTemplate: null,
      footerEnabled: true,
      footerTemplate: null,
      pageBreakEnabled: false,
    };

    const result = buildPdfOptions(config, 'Doc Title');

    expect(result.displayHeaderFooter).toBe(true);
    expect(result.headerTemplate).toContain('Doc Title');
    expect(result.footerTemplate).toContain('pageNumber');
    expect(result.margin.top).toBe('20mm');
    expect(result.margin.bottom).toBe('20mm');
    expect(result.margin.left).toBe('10mm');
    expect(result.margin.right).toBe('10mm');
  });

  it('header disabled, footer enabled → header is <span></span>, footer is default, top=10mm, bottom=20mm', () => {
    const config: PdfHeaderFooterConfig = {
      headerEnabled: false,
      headerTemplate: null,
      footerEnabled: true,
      footerTemplate: null,
      pageBreakEnabled: false,
    };

    const result = buildPdfOptions(config, 'Title');

    expect(result.displayHeaderFooter).toBe(true);
    expect(result.headerTemplate).toBe('<span></span>');
    expect(result.footerTemplate).toContain('pageNumber');
    expect(result.margin.top).toBe('10mm');
    expect(result.margin.bottom).toBe('20mm');
  });

  it('header enabled, footer disabled → header is default, footer is <span></span>, top=20mm, bottom=10mm', () => {
    const config: PdfHeaderFooterConfig = {
      headerEnabled: true,
      headerTemplate: null,
      footerEnabled: false,
      footerTemplate: null,
      pageBreakEnabled: false,
    };

    const result = buildPdfOptions(config, 'Title');

    expect(result.displayHeaderFooter).toBe(true);
    expect(result.headerTemplate).toContain('Title');
    expect(result.footerTemplate).toBe('<span></span>');
    expect(result.margin.top).toBe('20mm');
    expect(result.margin.bottom).toBe('10mm');
  });

  it('both disabled → displayHeaderFooter=false, both templates are <span></span>, margins 10mm/10mm', () => {
    const config: PdfHeaderFooterConfig = {
      headerEnabled: false,
      headerTemplate: null,
      footerEnabled: false,
      footerTemplate: null,
      pageBreakEnabled: false,
    };

    const result = buildPdfOptions(config, 'Title');

    expect(result.displayHeaderFooter).toBe(false);
    expect(result.headerTemplate).toBe('<span></span>');
    expect(result.footerTemplate).toBe('<span></span>');
    expect(result.margin.top).toBe('10mm');
    expect(result.margin.bottom).toBe('10mm');
    expect(result.margin.left).toBe('10mm');
    expect(result.margin.right).toBe('10mm');
  });

  it('custom header template passthrough', () => {
    const customHeader = '<div>Custom Header</div>';
    const config: PdfHeaderFooterConfig = {
      headerEnabled: true,
      headerTemplate: customHeader,
      footerEnabled: false,
      footerTemplate: null,
      pageBreakEnabled: false,
    };

    const result = buildPdfOptions(config, 'Title');

    expect(result.headerTemplate).toBe(customHeader);
  });

  it('custom footer template passthrough', () => {
    const customFooter = '<div>Custom Footer</div>';
    const config: PdfHeaderFooterConfig = {
      headerEnabled: false,
      headerTemplate: null,
      footerEnabled: true,
      footerTemplate: customFooter,
      pageBreakEnabled: false,
    };

    const result = buildPdfOptions(config, 'Title');

    expect(result.footerTemplate).toBe(customFooter);
  });
});

describe('injectPageBreakCss', () => {
  it('injects CSS style block before </head> in valid HTML', () => {
    const input = '<html><head></head><body></body></html>';
    const result = injectPageBreakCss(input);
    expect(result).toContain('page-break-before');
    expect(result).toContain('page-break-after');
    expect(result).toContain('</head>');
  });

  it('returns HTML unchanged when </head> is missing', () => {
    const input = '<html><body>no head</body></html>';
    const result = injectPageBreakCss(input);
    expect(result).toBe(input);
  });

  it('double-application produces same result (idempotency)', () => {
    const input = '<html><head></head><body></body></html>';
    const once = injectPageBreakCss(input);
    const twice = injectPageBreakCss(once);
    expect(twice).toBe(once);
  });

  it('style block appears before </head>', () => {
    const input = '<html><head><meta charset="UTF-8"></head><body></body></html>';
    const result = injectPageBreakCss(input);
    const styleIndex = result.indexOf('<style>');
    const headCloseIndex = result.indexOf('</head>');
    expect(styleIndex).toBeGreaterThan(-1);
    expect(styleIndex).toBeLessThan(headCloseIndex);
  });
});
