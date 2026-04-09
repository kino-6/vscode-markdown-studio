import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { buildTocMarkdown, parseTocLinks } from '../../src/toc/buildTocMarkdown';
import { resolveAnchors } from '../../src/toc/anchorResolver';
import type { AnchorMapping, HeadingEntry, TocConfig } from '../../src/types/models';

// ── Shared generators ──────────────────────────────────────────────

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

/** Arbitrary for a valid level range (minLevel <= maxLevel, both 1-6). */
const levelRangeArb = fc
  .tuple(fc.integer({ min: 1, max: 6 }), fc.integer({ min: 1, max: 6 }))
  .map(([a, b]) => (a <= b ? { min: a, max: b } : { min: b, max: a }));

/** Arbitrary for TocConfig with variable level range and orderedList. */
const tocConfigArb = fc
  .tuple(levelRangeArb, fc.boolean())
  .map(([range, orderedList]) => ({
    minLevel: range.min,
    maxLevel: range.max,
    orderedList,
    pageBreak: false,
  }));


// ── Property 1: TOC Markdownテキストのフォーマット正確性 ────────────
// Feature: toc-command-generation, Property 1: TOC Markdownテキストのフォーマット正確性

describe('buildTocMarkdown property tests – format correctness', () => {
  /**
   * Property 1: TOC Markdownテキストのフォーマット正確性
   *
   * For any valid heading list and TOC config, buildTocMarkdown() output satisfies:
   * - orderedList=false → each entry uses `- [text](#anchor-id)` format
   * - orderedList=true → each entry uses `1. [text](#anchor-id)` format
   * - Each entry is indented with 2 spaces per level relative to minLevel
   * - Headings outside minLevel~maxLevel are excluded
   *
   * **Validates: Requirements 1.4, 2.1, 2.2**
   */
  it('Property 1: each entry has correct prefix, indentation, and level filtering', () => {
    fc.assert(
      fc.property(headingListWithEmptyArb, tocConfigArb, (headings, config) => {
        const anchors = toAnchors(headings);
        const output = buildTocMarkdown(anchors, config);

        const filtered = anchors.filter(
          (a) => a.heading.level >= config.minLevel && a.heading.level <= config.maxLevel,
        );

        if (filtered.length === 0) {
          expect(output).toBe('');
          return;
        }

        const lines = output.split('\n');
        expect(lines).toHaveLength(filtered.length);

        for (let i = 0; i < filtered.length; i++) {
          const { heading, anchorId } = filtered[i];
          const line = lines[i];
          const depth = heading.level - config.minLevel;
          const expectedIndent = '  '.repeat(depth);

          if (config.orderedList) {
            expect(line).toBe(`${expectedIndent}1. [${heading.text}](#${anchorId})`);
          } else {
            expect(line).toBe(`${expectedIndent}- [${heading.text}](#${anchorId})`);
          }
        }
      }),
      { numRuns: 200, seed: 42 },
    );
  });
});


// ── Property 2: TOCテキストのラウンドトリップ ────────────────────────
// Feature: toc-command-generation, Property 2: TOCテキストのラウンドトリップ

describe('buildTocMarkdown property tests – round-trip', () => {
  /**
   * Property 2: TOCテキストのラウンドトリップ
   *
   * For any valid heading list (within config range), buildTocMarkdown() →
   * parseTocLinks() returns same number of entries with matching text and anchor.
   *
   * **Validates: Requirements 2.5**
   */
  it('Property 2: parseTocLinks round-trips text and anchor from buildTocMarkdown output', () => {
    fc.assert(
      fc.property(headingListWithEmptyArb, tocConfigArb, (headings, config) => {
        const anchors = toAnchors(headings);
        const output = buildTocMarkdown(anchors, config);
        const parsed = parseTocLinks(output);

        const filtered = anchors.filter(
          (a) => a.heading.level >= config.minLevel && a.heading.level <= config.maxLevel,
        );

        expect(parsed).toHaveLength(filtered.length);

        for (let i = 0; i < filtered.length; i++) {
          expect(parsed[i].text).toBe(filtered[i].heading.text);
          expect(parsed[i].anchor).toBe(filtered[i].anchorId);
        }
      }),
      { numRuns: 200, seed: 42 },
    );
  });
});


// ── Property 8: 順序付き/順序なしリストの切り替え ──────────────────
// Feature: toc-command-generation, Property 8: 順序付き/順序なしリストの切り替え

describe('buildTocMarkdown property tests – ordered/unordered list toggle', () => {
  /**
   * Property 8: 順序付き/順序なしリストの切り替え
   *
   * orderedList=true → output uses `1. [` prefix, no `- [`;
   * orderedList=false → vice versa.
   *
   * **Validates: Requirements 2.1, 8.2**
   */
  it('Property 8: orderedList=true uses "1. [" only, orderedList=false uses "- [" only', () => {
    fc.assert(
      fc.property(headingListArb, levelRangeArb, (headings, range) => {
        const anchors = toAnchors(headings);
        const baseConfig: TocConfig = {
          minLevel: range.min,
          maxLevel: range.max,
          orderedList: false,
          pageBreak: false,
        };

        const hasFiltered = anchors.some(
          (a) => a.heading.level >= range.min && a.heading.level <= range.max,
        );
        if (!hasFiltered) return;

        // orderedList = true → "1. [" present, no "- ["
        const ordered = buildTocMarkdown(anchors, { ...baseConfig, orderedList: true });
        const orderedLines = ordered.split('\n').filter((l) => l.trim().length > 0);
        for (const line of orderedLines) {
          const trimmed = line.trimStart();
          expect(trimmed.startsWith('1. [')).toBe(true);
          expect(trimmed.startsWith('- [')).toBe(false);
        }

        // orderedList = false → "- [" present, no "1. ["
        const unordered = buildTocMarkdown(anchors, { ...baseConfig, orderedList: false });
        const unorderedLines = unordered.split('\n').filter((l) => l.trim().length > 0);
        for (const line of unorderedLines) {
          const trimmed = line.trimStart();
          expect(trimmed.startsWith('- [')).toBe(true);
          expect(trimmed.startsWith('1. [')).toBe(false);
        }
      }),
      { numRuns: 200, seed: 42 },
    );
  });
});
