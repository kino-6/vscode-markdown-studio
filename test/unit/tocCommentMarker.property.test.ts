import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  findTocCommentMarkers,
  wrapWithMarkers,
  replaceTocContent,
} from '../../src/toc/tocCommentMarker';

// ── Shared generators ──────────────────────────────────────────────

/** Arbitrary for TOC-like text (lines of markdown list entries, no marker-like lines). */
const tocLineArb = fc
  .stringMatching(/^[a-zA-Z0-9 \-\[\]()#_.]{1,60}$/)
  .filter((s) => !s.includes('<!-- TOC') && !s.includes('<!-- /TOC'));

const tocTextArb = fc
  .array(tocLineArb, { minLength: 1, maxLength: 10 })
  .map((lines) => lines.join('\n'));

const tocTextWithEmptyArb = fc.oneof(fc.constant(''), tocTextArb);

/** Arbitrary for plain markdown lines that don't contain TOC markers. */
const plainLineArb = fc
  .stringMatching(/^[a-zA-Z0-9 #*_\-,.!?]{0,80}$/)
  .filter((s) => !s.includes('<!-- TOC') && !s.includes('<!-- /TOC'));

/** Arbitrary for a block of plain markdown lines. */
const plainBlockArb = fc
  .array(plainLineArb, { minLength: 0, maxLength: 5 })
  .map((lines) => lines.join('\n'));


// ── Property 3: コメントマーカーのラウンドトリップ ──────────────────
// Feature: toc-command-generation, Property 3

describe('tocCommentMarker property tests – comment marker round-trip', () => {
  /**
   * Property 3: コメントマーカーのラウンドトリップ
   *
   * For any valid TOC text, wrapWithMarkers() → findTocCommentMarkers() → content
   * returns the original TOC text.
   *
   * **Validates: Requirements 9.5**
   */
  it('Property 3: wrapWithMarkers → findTocCommentMarkers round-trips TOC text', () => {
    fc.assert(
      fc.property(tocTextWithEmptyArb, (tocText) => {
        const wrapped = wrapWithMarkers(tocText);
        const result = findTocCommentMarkers(wrapped);

        expect(result).toBeDefined();
        expect(result!.content).toBe(tocText);
      }),
      { numRuns: 200, seed: 42 },
    );
  });
});



// ── Property 4: コメントマーカー解析の正確性 ────────────────────────
// Feature: toc-command-generation, Property 4

describe('tocCommentMarker property tests – marker parsing accuracy', () => {
  /**
   * Property 4: コメントマーカー解析の正確性
   *
   * For any document with `<!-- TOC -->` and `<!-- /TOC -->` markers,
   * findTocCommentMarkers() returns only content between markers.
   * Code block markers are ignored.
   *
   * **Validates: Requirements 9.3, 9.4**
   */
  it('Property 4: findTocCommentMarkers returns only content between markers', () => {
    fc.assert(
      fc.property(plainBlockArb, tocTextWithEmptyArb, plainBlockArb, (before, tocText, after) => {
        const beforeLines = before ? before.split('\n') : [];
        const afterLines = after ? after.split('\n') : [];

        const docParts: string[] = [
          ...beforeLines,
          '<!-- TOC -->',
          ...(tocText ? tocText.split('\n') : []),
          '<!-- /TOC -->',
          ...afterLines,
        ];
        const doc = docParts.join('\n');

        const result = findTocCommentMarkers(doc);

        expect(result).toBeDefined();
        expect(result!.content).toBe(tocText);
        expect(result!.startLine).toBe(beforeLines.length);
        expect(result!.endLine).toBe(beforeLines.length + 1 + (tocText ? tocText.split('\n').length : 0));
      }),
      { numRuns: 200, seed: 42 },
    );
  });

  it('Property 4: markers inside code blocks are ignored', () => {
    fc.assert(
      fc.property(tocTextWithEmptyArb, (tocText) => {
        // Put markers inside a fenced code block
        const codeBlockLines = [
          '```',
          '<!-- TOC -->',
          ...(tocText ? tocText.split('\n') : []),
          '<!-- /TOC -->',
          '```',
        ];
        const doc = codeBlockLines.join('\n');

        // Provide fenced ranges covering the code block content
        const fencedRanges = [{ startLine: 0, endLine: codeBlockLines.length }];
        const result = findTocCommentMarkers(doc, fencedRanges);

        expect(result).toBeUndefined();
      }),
      { numRuns: 200, seed: 42 },
    );
  });
});


// ── Property 5: TOC更新時のマーカー位置保持と内容置換 ──────────────
// Feature: toc-command-generation, Property 5

describe('tocCommentMarker property tests – marker position preservation on update', () => {
  /**
   * Property 5: TOC更新時のマーカー位置保持と内容置換
   *
   * For any document with TOC markers and new heading structure,
   * replaceTocContent() preserves marker positions and only replaces
   * content between markers. Content outside markers is unchanged.
   *
   * **Validates: Requirements 1.5, 4.2**
   */
  it('Property 5: replaceTocContent preserves content outside markers and replaces only TOC', () => {
    fc.assert(
      fc.property(
        plainBlockArb,
        tocTextWithEmptyArb,
        plainBlockArb,
        tocTextWithEmptyArb,
        (before, oldToc, after, newToc) => {
          const beforeLines = before ? before.split('\n') : [];
          const afterLines = after ? after.split('\n') : [];

          const docParts: string[] = [
            ...beforeLines,
            '<!-- TOC -->',
            ...(oldToc ? oldToc.split('\n') : []),
            '<!-- /TOC -->',
            ...afterLines,
          ];
          const doc = docParts.join('\n');

          const markerRange = findTocCommentMarkers(doc);
          expect(markerRange).toBeDefined();

          const updated = replaceTocContent(doc, markerRange!, newToc);
          const updatedLines = updated.split('\n');

          // Content before start marker is unchanged
          for (let i = 0; i < beforeLines.length; i++) {
            expect(updatedLines[i]).toBe(beforeLines[i]);
          }

          // Start marker is preserved
          expect(updatedLines[beforeLines.length]).toBe('<!-- TOC -->');

          // New TOC content is between markers
          const newResult = findTocCommentMarkers(updated);
          expect(newResult).toBeDefined();
          expect(newResult!.content).toBe(newToc);

          // Content after end marker is unchanged
          const newEndLine = newResult!.endLine;
          const updatedAfterLines = updatedLines.slice(newEndLine + 1);
          expect(updatedAfterLines).toEqual(afterLines);
        },
      ),
      { numRuns: 200, seed: 42 },
    );
  });
});


// ── Property 6: 無変更時のTOC更新スキップ ──────────────────────────
// Feature: toc-command-generation, Property 6

describe('tocCommentMarker property tests – no-change skip', () => {
  /**
   * Property 6: 無変更時のTOC更新スキップ
   *
   * For any document with TOC markers, if current TOC text equals
   * regenerated TOC text, the content is identical (enabling skip logic).
   *
   * **Validates: Requirements 4.4**
   */
  it('Property 6: when TOC text is unchanged, replaceTocContent returns identical document', () => {
    fc.assert(
      fc.property(plainBlockArb, tocTextWithEmptyArb, plainBlockArb, (before, tocText, after) => {
        const beforeLines = before ? before.split('\n') : [];
        const afterLines = after ? after.split('\n') : [];

        const docParts: string[] = [
          ...beforeLines,
          '<!-- TOC -->',
          ...(tocText ? tocText.split('\n') : []),
          '<!-- /TOC -->',
          ...afterLines,
        ];
        const doc = docParts.join('\n');

        const markerRange = findTocCommentMarkers(doc);
        expect(markerRange).toBeDefined();

        // Same TOC text → content comparison enables skip
        expect(markerRange!.content).toBe(tocText);

        // Replacing with same text yields identical document
        const updated = replaceTocContent(doc, markerRange!, tocText);
        expect(updated).toBe(doc);
      }),
      { numRuns: 200, seed: 42 },
    );
  });
});
