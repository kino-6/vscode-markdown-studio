import { PdfHeaderFooterConfig, PdfTemplateOptions } from '../types/models';

/**
 * Escapes HTML special characters in a string to prevent injection.
 * IMPORTANT: `&` is escaped first to avoid double-escaping.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Returns a default Playwright-compatible header template HTML string
 * containing the HTML-escaped document title, styled with inline CSS,
 * font-size ≤ 12px, spanning full page width.
 */
export function getDefaultHeaderTemplate(documentTitle: string): string {
  const escaped = escapeHtml(documentTitle);
  return `<div style="font-size:10px;width:100%;text-align:center;"><span>${escaped}</span></div>`;
}

/**
 * Returns a default Playwright-compatible footer template HTML string
 * displaying "Page X of Y" using Playwright's special CSS classes
 * `pageNumber` and `totalPages`, styled with inline CSS, font-size ≤ 12px.
 */
export function getDefaultFooterTemplate(): string {
  return '<div style="font-size:10px;width:100%;text-align:center;">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>';
}

/** Unique marker comment used to detect if page-break CSS has already been injected. */
const PAGE_BREAK_MARKER = '/* md-studio-page-break */';

const PAGE_BREAK_STYLE_BLOCK = `<style>${PAGE_BREAK_MARKER}
[style*="page-break-before"] { page-break-before: always; }
[style*="page-break-after"] { page-break-after: always; }
</style>`;

/**
 * Injects a `<style>` block with page-break CSS rules before `</head>`.
 * Returns the HTML unchanged if `</head>` is not found or if the
 * style block has already been injected (idempotent).
 */
export function injectPageBreakCss(html: string): string {
  if (html.includes(PAGE_BREAK_MARKER)) {
    return html;
  }
  const headCloseIndex = html.indexOf('</head>');
  if (headCloseIndex === -1) {
    return html;
  }
  return html.slice(0, headCloseIndex) + PAGE_BREAK_STYLE_BLOCK + html.slice(headCloseIndex);
}

/**
 * Translates a PdfHeaderFooterConfig and document title into
 * Playwright-compatible page.pdf() options including header/footer
 * templates and margins.
 */
export function buildPdfOptions(config: PdfHeaderFooterConfig, documentTitle: string, customMargin?: string): PdfTemplateOptions {
  const displayHeaderFooter = config.headerEnabled || config.footerEnabled;

  let headerTemplate: string;
  if (config.headerEnabled) {
    headerTemplate = config.headerTemplate ?? getDefaultHeaderTemplate(documentTitle);
  } else {
    headerTemplate = '<span></span>';
  }

  let footerTemplate: string;
  if (config.footerEnabled) {
    footerTemplate = config.footerTemplate ?? getDefaultFooterTemplate();
  } else {
    footerTemplate = '<span></span>';
  }

  let margin: { top: string; bottom: string; left: string; right: string };

  if (customMargin) {
    if (displayHeaderFooter) {
      // When header/footer enabled: use customMargin for left/right,
      // ensure top/bottom are at least customMargin
      const topBase = config.headerEnabled ? '20mm' : customMargin;
      const bottomBase = config.footerEnabled ? '20mm' : customMargin;
      margin = {
        top: topBase,
        bottom: bottomBase,
        left: customMargin,
        right: customMargin,
      };
    } else {
      // When header/footer disabled: use customMargin for all sides
      margin = {
        top: customMargin,
        bottom: customMargin,
        left: customMargin,
        right: customMargin,
      };
    }
  } else {
    margin = {
      top: config.headerEnabled ? '20mm' : '10mm',
      bottom: config.footerEnabled ? '20mm' : '10mm',
      left: '10mm',
      right: '10mm',
    };
  }

  return {
    displayHeaderFooter,
    headerTemplate,
    footerTemplate,
    margin,
  };
}
