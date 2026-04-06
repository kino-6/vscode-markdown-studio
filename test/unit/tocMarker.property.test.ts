import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { findTocMarker, replaceTocMarker } from '../../src/toc/tocMarker';

// ── Shared helpers & generators ─────────────────────────────────────

/** All recognized marker forms (both bracket styles). */
const MARKER_FORMS = ['[[toc]]', '[toc]'];

/**
 * Generate a random case variant of a marker string.
 * E.g. "[[toc]]" → "[[ToC]]", "[toc]" → "[TOC]", etc.
 */
const markerCaseArb = fc
  .tuple(
    fc.constantFrom(...MARKER_FORMS),
    fc.array(fc.boolean(), { minLength: 3, maxLength: 3 }),
  )
  .map(([marker, flags]) => {
    // Apply random upper/lower to the 't', 'o', 'c' characters
    const chars = marker.split('');
    let fi = 0;
    return chars
      .map((ch) => {
        if (/[a-z]/i.test(ch) && fi < flags.length) {
          return flags[fi++] ? ch.toUpperCase() : ch.toLowerCase();
        }
        return ch;
      })
      .join('');
  });

/** Wrap a marker in a `<p>` tag (as markdown-it renders it). */
function wrapInP(marker: string): string {
  return `<p>${marker}</p>`;
}

/** Generate safe HTML content that does NOT contain any TOC marker or nav. */
const safeHtmlFragmentArb = fc
  .stringMatching(/^[a-zA-Z0-9 .,!?]{0,40}$/)
  .map((s) => (s.length > 0 ? `<p>${s}</p>` : ''));

/** A realistic tocHtml string containing <nav class="ms-toc">. */
const tocHtmlArb = fc
  .stringMatching(/^[a-zA-Z0-9 ]{1,20}$/)
  .map(
    (text) =>
      `<nav class="ms-toc"><ul><li><a href="#heading">${text}</a></li></ul></nav>`,
  );


// ── Property 9: TOCマーカー置換（大文字小文字非区別） ────────────────
// Feature: toc-auto-generation, Property 9: TOCマーカー置換（大文字小文字非区別）

describe('tocMarker property tests – case-insensitive replacement', () => {
  /**
   * Property 9: TOCマーカー置換（大文字小文字非区別）
   *
   * For any document with `[[toc]]` or `[toc]` markers (any case combination),
   * replaceTocMarker() replaces the marker with TOC HTML containing
   * `<nav class="ms-toc">`.
   *
   * **Validates: Requirements 4.1, 4.2**
   */
  it('Property 9: replaceTocMarker replaces any-case marker with TOC HTML containing nav.ms-toc', () => {
    fc.assert(
      fc.property(
        markerCaseArb,
        safeHtmlFragmentArb,
        safeHtmlFragmentArb,
        tocHtmlArb,
        (marker, before, after, tocHtml) => {
          // Build an HTML document with a single marker wrapped in <p> tags
          const parts = [before, wrapInP(marker), after].filter(Boolean);
          const html = parts.join('\n');

          const result = replaceTocMarker(html, tocHtml);

          // The output must contain the TOC nav element
          expect(result).toContain('<nav class="ms-toc">');

          // The original marker paragraph should be gone
          expect(result).not.toMatch(/<p>\s*(\[\[?[tT][oO][cC]\]\]?)\s*<\/p>/);

          // The tocHtml should appear in the output
          expect(result).toContain(tocHtml);
        },
      ),
      { numRuns: 200 },
    );
  });
});


// ── Property 10: 複数マーカーの最初のみ置換 ─────────────────────────
// Feature: toc-auto-generation, Property 10: 複数マーカーの最初のみ置換

describe('tocMarker property tests – only first marker replaced', () => {
  /**
   * Property 10: 複数マーカーの最初のみ置換
   *
   * For any document with multiple TOC markers, replaceTocMarker() replaces
   * only the first marker with TOC HTML and removes the rest. Output contains
   * exactly one `<nav class="ms-toc">`.
   *
   * **Validates: Requirements 4.3**
   */
  it('Property 10: multiple markers → exactly one nav.ms-toc in output, rest removed', () => {
    fc.assert(
      fc.property(
        fc.array(markerCaseArb, { minLength: 2, maxLength: 5 }),
        tocHtmlArb,
        (markers, tocHtml) => {
          // Build HTML with multiple marker paragraphs separated by headings
          const htmlParts = markers.map(
            (m, i) => `<h${(i % 6) + 1}>Heading ${i}</h${(i % 6) + 1}>\n${wrapInP(m)}`,
          );
          const html = htmlParts.join('\n');

          const result = replaceTocMarker(html, tocHtml);

          // Exactly one <nav class="ms-toc"> in the output
          const navCount = (result.match(/<nav class="ms-toc">/g) || []).length;
          expect(navCount).toBe(1);

          // The tocHtml appears exactly once
          const tocCount = result.split(tocHtml).length - 1;
          expect(tocCount).toBe(1);

          // No remaining marker paragraphs
          expect(result).not.toMatch(/<p>\s*(\[\[?[tT][oO][cC]\]\]?)\s*<\/p>/);
        },
      ),
      { numRuns: 200 },
    );
  });
});


// ── Property 11: マーカー不在・コードブロック内マーカーの除外 ────────
// Feature: toc-auto-generation, Property 11: マーカー不在・コードブロック内マーカーの除外

describe('tocMarker property tests – no marker or code-block-only marker', () => {
  /**
   * Property 11: マーカー不在・コードブロック内マーカーの除外
   *
   * For any document without TOC markers, or with markers only inside code
   * blocks, the output does not contain `<nav class="ms-toc">`.
   *
   * **Validates: Requirements 4.4, 4.5**
   */
  it('Property 11a: no markers → no nav.ms-toc in output (replaceTocMarker)', () => {
    fc.assert(
      fc.property(
        fc.array(safeHtmlFragmentArb, { minLength: 1, maxLength: 5 }),
        tocHtmlArb,
        (fragments, tocHtml) => {
          // Build HTML with no TOC markers at all
          const html = fragments.filter(Boolean).join('\n');

          const result = replaceTocMarker(html, tocHtml);

          // No nav should be inserted
          expect(result).not.toContain('<nav class="ms-toc">');

          // Output should be unchanged
          expect(result).toBe(html);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('Property 11b: markers only inside code blocks → findTocMarker returns -1', () => {
    fc.assert(
      fc.property(
        markerCaseArb,
        fc.integer({ min: 0, max: 10 }),
        (marker, prefixLines) => {
          // Build a markdown document where the marker is only inside a fenced code block
          const prefix = Array.from({ length: prefixLines }, (_, i) => `Line ${i}`);
          const codeStart = prefixLines;
          const markerLine = prefixLines + 1;
          const codeEnd = prefixLines + 2;

          const lines = [
            ...prefix,
            '```',
            marker,
            '```',
          ];
          const markdown = lines.join('\n');

          // The fenced range covers from the opening ``` to the closing ```
          const fencedRanges = [{ startLine: codeStart, endLine: codeEnd + 1 }];

          const result = findTocMarker(markdown, fencedRanges);

          // Should not find any valid marker
          expect(result).toBe(-1);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('Property 11c: markers inside <code>/<pre> in HTML → replaceTocMarker does not insert nav', () => {
    fc.assert(
      fc.property(markerCaseArb, tocHtmlArb, (marker, tocHtml) => {
        // Markers inside <code> or <pre> blocks (not in <p> tags) should not be replaced
        const html = `<pre><code>${marker}</code></pre>`;

        const result = replaceTocMarker(html, tocHtml);

        // No nav should be inserted because the marker is not in a <p> tag
        expect(result).not.toContain('<nav class="ms-toc">');
      }),
      { numRuns: 200 },
    );
  });
});
