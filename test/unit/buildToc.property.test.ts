import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { buildTocHtml } from '../../src/toc/buildToc';
import { resolveAnchors } from '../../src/toc/anchorResolver';
import type { AnchorMapping, HeadingEntry, TocConfig } from '../../src/types/models';

// ── Shared generators ──────────────────────────────────────────────

/** Generate a heading entry with a given level, text, and line. */
function makeHeading(level: number, text: string, line: number): HeadingEntry {
  return { level, text, line };
}

/** Arbitrary for heading text (safe ASCII, no empty). */
const headingTextArb = fc
  .stringMatching(/^[a-zA-Z][a-zA-Z0-9 ]{0,19}$/)
  .filter((s) => s.trim().length > 0);

/** Arbitrary for a single HeadingEntry. */
const headingEntryArb = fc
  .tuple(fc.integer({ min: 1, max: 6 }), headingTextArb, fc.integer({ min: 0, max: 500 }))
  .map(([level, text, line]) => makeHeading(level, text, line));

/** Arbitrary for a non-empty list of headings. */
const headingListArb = fc.array(headingEntryArb, { minLength: 1, maxLength: 20 });

/** Arbitrary for a (possibly empty) list of headings. */
const headingListWithEmptyArb = fc.array(headingEntryArb, { minLength: 0, maxLength: 20 });

/** Build AnchorMapping[] from HeadingEntry[] using the real resolveAnchors. */
function toAnchors(headings: HeadingEntry[]): AnchorMapping[] {
  return resolveAnchors(headings);
}

/** Default TocConfig for tests. */
const defaultConfig: TocConfig = {
  minLevel: 1,
  maxLevel: 6,
  orderedList: false,
  pageBreak: false,
};


// ── Property 7: TOC HTML構造の正確性 ────────────────────────────────
// Feature: toc-auto-generation, Property 7: TOC HTML構造の正確性

describe('buildToc property tests – HTML structure', () => {
  /**
   * Property 7: TOC HTML構造の正確性
   *
   * For any heading list, buildTocHtml() output is wrapped in
   * `<nav class="ms-toc">`, each entry has nested list structure
   * (`<ul>`/`<ol>` + `<li>`) based on heading level, and contains
   * anchor links (`<a href="#anchor-id">`).
   *
   * **Validates: Requirements 3.1, 3.2, 3.3**
   */
  it('Property 7: output is wrapped in nav.ms-toc, uses nested lists, and contains anchor links', () => {
    fc.assert(
      fc.property(headingListWithEmptyArb, (headings) => {
        const anchors = toAnchors(headings);
        const html = buildTocHtml(anchors, defaultConfig);

        // Wrapped in <nav class="ms-toc">...</nav>
        expect(html).toMatch(/^<nav class="ms-toc"[^>]*>/);
        expect(html).toMatch(/<\/nav>$/);

        // Filter to headings within configured range
        const filtered = headings.filter(
          (h) => h.level >= defaultConfig.minLevel && h.level <= defaultConfig.maxLevel,
        );

        if (filtered.length === 0) {
          // Empty nav container
          expect(html).toMatch(/^<nav class="ms-toc"[^>]*><\/nav>$/);
          return;
        }

        // Contains <ul> or <ol> list elements
        expect(html).toMatch(/<ul>|<ol>/);

        // Each anchor mapping within range has a corresponding <a href="#..."> link
        const filteredAnchors = anchors.filter(
          (a) =>
            a.heading.level >= defaultConfig.minLevel &&
            a.heading.level <= defaultConfig.maxLevel,
        );
        for (const { anchorId } of filteredAnchors) {
          expect(html).toContain(`<a href="#${anchorId}">`);
        }

        // Each anchor link is inside an <li>
        for (const { anchorId } of filteredAnchors) {
          const linkPattern = new RegExp(`<li><a href="#${anchorId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}">`);
          expect(html).toMatch(linkPattern);
        }

        // Balanced list tags: equal number of opening and closing
        const openUl = (html.match(/<ul>/g) || []).length;
        const closeUl = (html.match(/<\/ul>/g) || []).length;
        expect(openUl).toBe(closeUl);

        const openOl = (html.match(/<ol>/g) || []).length;
        const closeOl = (html.match(/<\/ol>/g) || []).length;
        expect(openOl).toBe(closeOl);

        const openLi = (html.match(/<li>/g) || []).length;
        const closeLi = (html.match(/<\/li>/g) || []).length;
        expect(openLi).toBe(closeLi);
      }),
      { numRuns: 200, seed: 42 },
    );
  });
});


// ── Property 8: TOCラウンドトリップ ─────────────────────────────────
// Feature: toc-auto-generation, Property 8: TOCラウンドトリップ

describe('buildToc property tests – round-trip', () => {
  /**
   * Property 8: TOCラウンドトリップ
   *
   * For any valid heading list, parsing the HTML output of buildTocHtml()
   * to re-extract link entries yields the same number of entries as the input.
   *
   * **Validates: Requirements 3.5**
   */
  it('Property 8: number of <a> links in output equals number of filtered input headings', () => {
    fc.assert(
      fc.property(headingListWithEmptyArb, (headings) => {
        const anchors = toAnchors(headings);
        const html = buildTocHtml(anchors, defaultConfig);

        // Count headings within configured range
        const filteredCount = headings.filter(
          (h) => h.level >= defaultConfig.minLevel && h.level <= defaultConfig.maxLevel,
        ).length;

        // Extract all <a href="#..."> links from the output
        const linkMatches = html.match(/<a href="#[^"]*">/g) || [];

        expect(linkMatches.length).toBe(filteredCount);
      }),
      { numRuns: 200, seed: 42 },
    );
  });
});


// ── Property 15: 見出しレベルフィルタリング ──────────────────────────
// Feature: toc-auto-generation, Property 15: 見出しレベルフィルタリング

/** Arbitrary for a valid level range (minLevel <= maxLevel, both 1-6). */
const levelRangeArb = fc
  .tuple(fc.integer({ min: 1, max: 6 }), fc.integer({ min: 1, max: 6 }))
  .map(([a, b]) => (a <= b ? { min: a, max: b } : { min: b, max: a }));

describe('buildToc property tests – level filtering', () => {
  /**
   * Property 15: 見出しレベルフィルタリング
   *
   * For any heading list and level range config (minLevel~maxLevel),
   * buildTocHtml() output does not contain entries for headings
   * outside the configured range.
   *
   * **Validates: Requirements 9.1**
   */
  it('Property 15: output contains no links for headings outside minLevel-maxLevel', () => {
    fc.assert(
      fc.property(headingListArb, levelRangeArb, (headings, range) => {
        const anchors = toAnchors(headings);
        const config: TocConfig = {
          minLevel: range.min,
          maxLevel: range.max,
          orderedList: false,
          pageBreak: false,
        };
        const html = buildTocHtml(anchors, config);

        // Headings outside the range should NOT appear in the output
        const outsideAnchors = anchors.filter(
          (a) => a.heading.level < range.min || a.heading.level > range.max,
        );
        for (const { anchorId } of outsideAnchors) {
          expect(html).not.toContain(`href="#${anchorId}"`);
        }

        // Headings inside the range SHOULD appear
        const insideAnchors = anchors.filter(
          (a) => a.heading.level >= range.min && a.heading.level <= range.max,
        );
        for (const { anchorId } of insideAnchors) {
          expect(html).toContain(`href="#${anchorId}"`);
        }
      }),
      { numRuns: 200, seed: 42 },
    );
  });
});


// ── Property 16: 順序付き/順序なしリストの切り替え ──────────────────
// Feature: toc-auto-generation, Property 16: 順序付き/順序なしリストの切り替え

describe('buildToc property tests – ordered/unordered list toggle', () => {
  /**
   * Property 16: 順序付き/順序なしリストの切り替え
   *
   * For any heading list, when orderedList=true, buildTocHtml() uses
   * `<ol>` and not `<ul>`. When orderedList=false, uses `<ul>` and not `<ol>`.
   *
   * **Validates: Requirements 9.2**
   */
  it('Property 16: orderedList=true uses <ol> only, orderedList=false uses <ul> only', () => {
    fc.assert(
      fc.property(headingListArb, (headings) => {
        const anchors = toAnchors(headings);

        // orderedList = true → <ol> only
        const orderedHtml = buildTocHtml(anchors, {
          ...defaultConfig,
          orderedList: true,
        });
        expect(orderedHtml).not.toContain('<ul>');
        expect(orderedHtml).not.toContain('</ul>');
        expect(orderedHtml).toContain('<ol>');
        expect(orderedHtml).toContain('</ol>');

        // orderedList = false → <ul> only
        const unorderedHtml = buildTocHtml(anchors, {
          ...defaultConfig,
          orderedList: false,
        });
        expect(unorderedHtml).not.toContain('<ol>');
        expect(unorderedHtml).not.toContain('</ol>');
        expect(unorderedHtml).toContain('<ul>');
        expect(unorderedHtml).toContain('</ul>');
      }),
      { numRuns: 200, seed: 42 },
    );
  });
});


// ── Property 13: 改ページCSS注入のトグル ────────────────────────────
// Feature: toc-auto-generation, Property 13: 改ページCSS注入のトグル

describe('buildToc property tests – page-break CSS toggle', () => {
  /**
   * Property 13: 改ページCSS注入のトグル
   *
   * For any TOC HTML, when pageBreak=true, the nav container has
   * page-break-before and page-break-after CSS. When false, it does not.
   *
   * **Validates: Requirements 6.4, 9.3**
   */
  it('Property 13: pageBreak=true injects page-break CSS, false does not', () => {
    fc.assert(
      fc.property(headingListWithEmptyArb, (headings) => {
        const anchors = toAnchors(headings);

        // pageBreak = true → CSS present
        const withBreak = buildTocHtml(anchors, { ...defaultConfig, pageBreak: true });
        expect(withBreak).toContain('page-break-before: always');
        expect(withBreak).toContain('page-break-after: always');

        // pageBreak = false → no page-break CSS
        const withoutBreak = buildTocHtml(anchors, { ...defaultConfig, pageBreak: false });
        expect(withoutBreak).not.toContain('page-break-before');
        expect(withoutBreak).not.toContain('page-break-after');
      }),
      { numRuns: 200, seed: 42 },
    );
  });
});
