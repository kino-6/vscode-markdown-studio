import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { validateAnchors } from '../../src/toc/tocValidator';
import type { AnchorMapping, HeadingEntry } from '../../src/types/models';

// Feature: toc-auto-generation, Property 14: アンカー検証の正確性

/**
 * Build a HeadingEntry helper.
 */
function makeHeading(level: number, text: string, line: number): HeadingEntry {
  return { level, text, line };
}

/**
 * Arbitrary for a simple anchor ID (lowercase slug-like string).
 */
const anchorIdArb = fc
  .stringMatching(/^[a-z][a-z0-9-]{0,19}$/)
  .filter((s) => s.length > 0);

/**
 * Arbitrary for heading text.
 */
const headingTextArb = fc
  .stringMatching(/^[A-Za-z][A-Za-z0-9 ]{0,19}$/)
  .filter((s) => s.trim().length > 0);

/**
 * Arbitrary for a single AnchorMapping with a given anchorId.
 */
function anchorMappingArb(idArb: fc.Arbitrary<string>): fc.Arbitrary<AnchorMapping> {
  return fc.tuple(
    fc.integer({ min: 1, max: 6 }),
    headingTextArb,
    fc.integer({ min: 0, max: 500 }),
    idArb,
  ).map(([level, text, line, anchorId]) => ({
    heading: makeHeading(level, text, line),
    anchorId,
  }));
}

/**
 * Generate a test scenario with:
 * - A pool of unique anchor IDs
 * - A subset designated as "valid" (present in headingIds)
 * - The rest designated as "invalid" (missing from headingIds)
 * - An array of AnchorMappings using those IDs
 */
const scenarioArb = fc
  .uniqueArray(anchorIdArb, { minLength: 1, maxLength: 20 })
  .chain((allIds) => {
    // Pick a random split point to divide into valid and invalid sets
    return fc.integer({ min: 0, max: allIds.length }).chain((splitAt) => {
      const validIds = allIds.slice(0, splitAt);
      const invalidIds = allIds.slice(splitAt);

      // Generate anchors that use IDs from the full pool
      const anchorArbs = allIds.map((id) =>
        anchorMappingArb(fc.constant(id))
      );

      return fc.tuple(...anchorArbs).map((anchors) => ({
        anchors,
        validIds: new Set(validIds),
        invalidIds: new Set(invalidIds),
        headingIds: new Set(validIds),
      }));
    });
  });

describe('tocValidator property tests – anchor validation accuracy', () => {
  /**
   * Property 14: アンカー検証の正確性
   *
   * For any heading list and anchor mapping, validateAnchors() detects
   * only anchors whose IDs are not found in headingIds, and each
   * diagnostic message includes the invalid anchor ID and expected
   * heading text.
   *
   * **Validates: Requirements 8.1, 8.2, 8.4**
   */
  it('Property 14: detects exactly the anchors missing from headingIds, diagnostics contain anchorId and heading text', () => {
    fc.assert(
      fc.property(scenarioArb, ({ anchors, headingIds, invalidIds }) => {
        const diagnostics = validateAnchors(anchors, headingIds);

        // Collect which anchors should be flagged
        const expectedInvalid = anchors.filter((a) => !headingIds.has(a.anchorId));

        // 8.1 & 8.2: Exactly the invalid anchors are detected — no false positives, no misses
        expect(diagnostics).toHaveLength(expectedInvalid.length);

        const diagAnchorIds = new Set(diagnostics.map((d) => d.anchorId));
        for (const anchor of expectedInvalid) {
          expect(diagAnchorIds.has(anchor.anchorId)).toBe(true);
        }

        // No valid anchor should appear in diagnostics
        for (const d of diagnostics) {
          expect(headingIds.has(d.anchorId)).toBe(false);
        }

        // 8.4: Each diagnostic message includes the invalid anchor ID and expected heading text
        for (const d of diagnostics) {
          const matchingAnchor = anchors.find((a) => a.anchorId === d.anchorId);
          expect(matchingAnchor).toBeDefined();
          expect(d.message).toContain(d.anchorId);
          expect(d.message).toContain(d.expectedHeading);
          expect(d.expectedHeading).toBe(matchingAnchor!.heading.text);
          expect(d.line).toBe(matchingAnchor!.heading.line);
        }
      }),
      { numRuns: 200 },
    );
  });
});
