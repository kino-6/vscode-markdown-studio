import { describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';

/**
 * PDF ToC Deduplication – Bug Condition Exploration Test
 *
 * This test encodes the EXPECTED behavior after the fix:
 * `renderMarkdownDocument()` should wrap `<!-- TOC -->` comment marker
 * ToC content in `<div class="ms-toc-comment">`.
 *
 * On UNFIXED code this test MUST FAIL — failure confirms the bug exists.
 */

// ── Mocks (same pattern as renderMarkdown.integration.test.ts) ─────

vi.mock('../../src/infra/config', () => ({
  getConfig: () => ({
    plantUmlMode: 'bundled-jar',
    javaPath: 'java',
    pageFormat: 'A4',
    externalResources: { mode: 'block-all', allowedDomains: [] },
    style: {
      fontFamily: 'sans-serif',
      fontSize: 14,
      lineHeight: 1.6,
      margin: '20mm',
      codeFontFamily: 'monospace',
      headingStyle: {
        h1FontWeight: 600, h1MarginTop: '24px', h1MarginBottom: '16px',
        h2MarginTop: '24px', h2MarginBottom: '16px',
      },
      codeBlockStyle: {
        background: '#f6f8fa', border: '1px solid #d0d7de',
        borderRadius: '6px', padding: '1em',
      },
      presetName: 'markdown-pdf',
    },
    toc: { minLevel: 1, maxLevel: 3, orderedList: false, pageBreak: false },
    codeBlock: { lineNumbers: false },
    pdfIndex: { enabled: true, title: 'Table of Contents' },
    theme: 'default',
    customCss: '',
  }),
}));

vi.mock('../../src/renderers/renderPlantUml', () => ({
  renderPlantUml: vi.fn().mockResolvedValue({ ok: true, svg: '' }),
}));

vi.mock('../../src/renderers/renderMermaid', () => ({
  renderMermaidBlock: vi.fn().mockResolvedValue({ ok: true, placeholder: '' }),
}));

vi.mock('../../src/infra/customCssLoader', () => ({
  loadCustomCss: vi.fn().mockResolvedValue({ css: '', warnings: [] }),
}));

import { renderMarkdownDocument } from '../../src/renderers/renderMarkdown';
import { buildHtml } from '../../src/preview/buildHtml';

// ── Generators ──────────────────────────────────────────────────────

/** Safe heading text for ToC links. */
const headingTextArb = fc
  .stringMatching(/^[A-Za-z][A-Za-z0-9 ]{0,19}$/)
  .filter((s) => s.trim().length > 0);

/** A single ToC list entry like `- [Heading](#heading)`. */
const tocEntryArb = headingTextArb.map((text) => {
  const anchor = text.toLowerCase().replace(/\s+/g, '-');
  return `- [${text}](#${anchor})`;
});

/**
 * Markdown document containing `<!-- TOC -->` comment markers with
 * 1-5 heading link entries between them.
 */
const markdownWithCommentTocArb = fc
  .array(tocEntryArb, { minLength: 1, maxLength: 5 })
  .map((entries) =>
    ['<!-- TOC -->', ...entries, '<!-- /TOC -->', '', '# Heading 1', '', 'Body text.'].join('\n'),
  );

// ── Bug Condition Exploration Test ──────────────────────────────────

describe('PDF ToC Dedup – Bug Condition Exploration', () => {
  const fakeContext = { extensionPath: '/tmp/ext' } as any;

  /**
   * Property 1: Bug Condition – コメントマーカーToCが `ms-toc-comment` でラップされる
   *
   * For any markdown input containing `<!-- TOC -->` comment markers with
   * ToC list content between them, `renderMarkdownDocument()` output HTML
   * SHALL contain `<div class="ms-toc-comment">` wrapping the comment
   * marker ToC content.
   *
   * On UNFIXED code this FAILS because the comment marker content renders
   * as plain `<ul><li>` without any identifying class.
   *
   * **Validates: Requirements 1.1, 2.1**
   */
  it('Property 1: comment marker ToC content is wrapped in ms-toc-comment div', () => {
    return fc.assert(
      fc.asyncProperty(markdownWithCommentTocArb, async (markdown) => {
        const result = await renderMarkdownDocument(markdown, fakeContext);
        expect(result.htmlBody).toContain('<div class="ms-toc-comment">');
      }),
      { numRuns: 50, seed: 42 },
    );
  });
});


// ── Preservation Generators ─────────────────────────────────────────

/** Heading level (1-6). */
const headingLevelArb = fc.integer({ min: 1, max: 6 });

/** Safe heading text without comment markers. */
const safeHeadingTextArb = fc
  .stringMatching(/^[A-Za-z][A-Za-z0-9 ]{0,29}$/)
  .filter((s) => s.trim().length > 0);

/** A markdown heading line like `## My Heading`. */
const headingLineArb = fc.tuple(headingLevelArb, safeHeadingTextArb).map(
  ([level, text]) => `${'#'.repeat(level)} ${text}`,
);

/** A paragraph of plain text. */
const paragraphArb = fc
  .stringMatching(/^[A-Za-z][A-Za-z0-9 .,!?]{0,49}$/)
  .filter((s) => s.trim().length > 0);

/**
 * Markdown document with headings but NO `<!-- TOC -->` comment markers
 * and NO `[toc]` markers. Guaranteed to not contain TOC-related markers.
 */
const markdownWithoutTocMarkersArb = fc
  .tuple(
    fc.array(headingLineArb, { minLength: 1, maxLength: 5 }),
    fc.array(paragraphArb, { minLength: 0, maxLength: 3 }),
  )
  .map(([headings, paragraphs]) => {
    const parts: string[] = [];
    for (let i = 0; i < headings.length; i++) {
      parts.push(headings[i]);
      parts.push('');
      if (paragraphs[i]) {
        parts.push(paragraphs[i]);
        parts.push('');
      }
    }
    return parts.join('\n');
  })
  .filter((md) => !md.includes('<!-- TOC') && !md.toLowerCase().includes('[toc]'));

/**
 * Markdown document with `[toc]` marker and at least one heading.
 */
const markdownWithTocMarkerArb = fc
  .tuple(
    fc.array(headingLineArb, { minLength: 1, maxLength: 5 }),
    fc.array(paragraphArb, { minLength: 0, maxLength: 3 }),
  )
  .map(([headings, paragraphs]) => {
    const parts: string[] = ['[toc]', ''];
    for (let i = 0; i < headings.length; i++) {
      parts.push(headings[i]);
      parts.push('');
      if (paragraphs[i]) {
        parts.push(paragraphs[i]);
        parts.push('');
      }
    }
    return parts.join('\n');
  });

/**
 * Any markdown document with headings (may or may not have [toc] marker).
 * Used for the buildHtml preview test.
 */
const anyMarkdownWithHeadingsArb = fc.oneof(
  markdownWithoutTocMarkersArb,
  markdownWithTocMarkerArb,
  markdownWithCommentTocArb,
);

// ── Preservation Property Tests ─────────────────────────────────────

describe('PDF ToC Dedup – Preservation Properties', () => {
  const fakeContext = { extensionPath: '/tmp/ext' } as any;

  /**
   * Property 2a: No ms-toc-comment class for markdown without comment markers
   *
   * For all markdown inputs WITHOUT `<!-- TOC -->` comment markers,
   * `renderMarkdownDocument()` output does NOT contain `ms-toc-comment` class.
   *
   * This captures the existing behavior: only comment-marker ToC content
   * should ever get the `ms-toc-comment` wrapper (once the fix is applied).
   * On unfixed code, `ms-toc-comment` never appears anywhere, so this passes.
   *
   * **Validates: Requirements 3.1, 3.2**
   */
  it('Property 2a: markdown without comment markers does not produce ms-toc-comment', () => {
    return fc.assert(
      fc.asyncProperty(markdownWithoutTocMarkersArb, async (markdown) => {
        const result = await renderMarkdownDocument(markdown, fakeContext);
        expect(result.htmlBody).not.toContain('ms-toc-comment');
      }),
      { numRuns: 50, seed: 42 },
    );
  });

  /**
   * Property 2b: [toc] marker produces nav.ms-toc
   *
   * For all markdown inputs with `[toc]` marker and at least one heading,
   * `renderMarkdownDocument()` output contains `<nav class="ms-toc">`.
   *
   * This captures the existing [toc] marker behavior that must be preserved.
   *
   * **Validates: Requirements 3.1, 3.4**
   */
  it('Property 2b: markdown with [toc] marker produces nav.ms-toc', () => {
    return fc.assert(
      fc.asyncProperty(markdownWithTocMarkerArb, async (markdown) => {
        const result = await renderMarkdownDocument(markdown, fakeContext);
        expect(result.htmlBody).toContain('<nav class="ms-toc"');
      }),
      { numRuns: 50, seed: 42 },
    );
  });

  /**
   * Property 2c: buildHtml (preview path) does NOT inject ToC-hiding CSS
   *
   * For all markdown inputs, `buildHtml()` (preview path with webview)
   * does NOT inject `.ms-toc { display: none` CSS. The ToC-hiding CSS
   * is only injected in the PDF export path (`exportToPdf`), not in preview.
   *
   * **Validates: Requirements 3.3**
   */
  it('Property 2c: buildHtml preview does not inject ToC-hiding CSS', () => {
    return fc.assert(
      fc.asyncProperty(anyMarkdownWithHeadingsArb, async (markdown) => {
        const html = await buildHtml(markdown, fakeContext);
        expect(html).not.toContain('.ms-toc { display: none');
        expect(html).not.toContain('.ms-toc{display:none');
      }),
      { numRuns: 50, seed: 42 },
    );
  });
});
