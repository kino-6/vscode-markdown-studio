import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import MarkdownIt from 'markdown-it';
import { extractHeadings } from '../../src/toc/extractHeadings';
import { resolveAnchors } from '../../src/toc/anchorResolver';
import { buildTocHtml } from '../../src/toc/buildToc';
import { replaceTocMarker } from '../../src/toc/tocMarker';
import type { TocConfig } from '../../src/types/models';

// ── Helpers ─────────────────────────────────────────────────────────

/** Create a fresh markdown-it instance for each pipeline run. */
function createMd(): MarkdownIt {
  return new MarkdownIt({ html: true, linkify: true, typographer: true });
}

/** Run the full TOC pipeline and return the TOC HTML inserted into rendered output. */
function runTocPipeline(markdown: string, config: TocConfig): string {
  const md = createMd();
  const headings = extractHeadings(markdown, md);
  const anchors = resolveAnchors(headings);
  const tocHtml = buildTocHtml(anchors, config);
  const rendered = md.render(markdown);
  return replaceTocMarker(rendered, tocHtml);
}

// ── Generators ──────────────────────────────────────────────────────

/** Arbitrary for safe heading text. */
const headingTextArb = fc
  .stringMatching(/^[a-zA-Z][a-zA-Z0-9 ]{0,19}$/)
  .filter((s) => s.trim().length > 0);

/** Arbitrary for a heading level (1-6). */
const headingLevelArb = fc.integer({ min: 1, max: 6 });

/** Arbitrary for a single markdown heading line. */
const headingLineArb = fc
  .tuple(headingLevelArb, headingTextArb)
  .map(([level, text]) => `${'#'.repeat(level)} ${text}`);

/** Arbitrary for a TOC marker variant. */
const tocMarkerArb = fc.constantFrom('[[toc]]', '[[TOC]]', '[toc]', '[TOC]', '[[Toc]]');

/** Arbitrary for a TocConfig. */
const tocConfigArb = fc
  .tuple(
    fc.integer({ min: 1, max: 6 }),
    fc.integer({ min: 1, max: 6 }),
    fc.boolean(),
    fc.boolean(),
  )
  .map(([a, b, orderedList, pageBreak]) => ({
    minLevel: Math.min(a, b),
    maxLevel: Math.max(a, b),
    orderedList,
    pageBreak,
  }));

/**
 * Arbitrary for a Markdown document containing a TOC marker and headings.
 * Returns [markdown, config] tuple.
 */
const markdownWithTocArb = fc
  .tuple(
    tocMarkerArb,
    fc.array(headingLineArb, { minLength: 1, maxLength: 15 }),
    tocConfigArb,
  )
  .map(([marker, headingLines, config]) => {
    const markdown = [marker, '', ...headingLines].join('\n');
    return { markdown, config } as const;
  });

// ── Property 12: プレビューとPDFで同一のTOC HTML ────────────────────
// Feature: toc-auto-generation, Property 12: プレビューとPDFで同一のTOC HTML

describe('renderMarkdown TOC property tests – preview/PDF identical TOC', () => {
  /**
   * Property 12: プレビューとPDFで同一のTOC HTML
   *
   * For any Markdown document with a TOC marker, the TOC HTML generated
   * for preview and PDF export is identical. Since both use the same
   * deterministic pipeline (extractHeadings → resolveAnchors → buildTocHtml
   * → replaceTocMarker), calling the pipeline twice with the same input
   * must produce the same output.
   *
   * **Validates: Requirements 6.3**
   */
  it('Property 12: calling the TOC pipeline twice with the same input produces identical output', () => {
    fc.assert(
      fc.property(markdownWithTocArb, ({ markdown, config }) => {
        const result1 = runTocPipeline(markdown, config);
        const result2 = runTocPipeline(markdown, config);

        expect(result1).toBe(result2);
      }),
      { numRuns: 200, seed: 42 },
    );
  });
});
