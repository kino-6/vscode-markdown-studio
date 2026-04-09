import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { buildBookmarkTree, type BookmarkNode } from '../../src/export/pdfBookmarks';
import type { BookmarkEntry } from '../../src/types/models';

// ── Shared generators ──────────────────────────────────────────────

/** Arbitrary for bookmark entry text (safe ASCII, non-empty). */
const bookmarkTextArb = fc
  .stringMatching(/^[a-zA-Z][a-zA-Z0-9 ]{0,19}$/)
  .filter((s) => s.trim().length > 0);

/** Arbitrary for a single BookmarkEntry. */
const bookmarkEntryArb = fc
  .tuple(
    fc.integer({ min: 1, max: 6 }),
    bookmarkTextArb,
    fc.integer({ min: 1, max: 100 }),
  )
  .map(([level, text, pageNumber]) => ({ level, text, pageNumber }));

/** Arbitrary for a (possibly empty) list of BookmarkEntry. */
const bookmarkListArb = fc.array(bookmarkEntryArb, { minLength: 0, maxLength: 20 });

/** Arbitrary for a valid level range (min <= max, both 1-6). */
const levelRangeArb = fc
  .tuple(fc.integer({ min: 1, max: 6 }), fc.integer({ min: 1, max: 6 }))
  .map(([a, b]) => (a <= b ? { min: a, max: b } : { min: b, max: a }));

// ── Helpers ────────────────────────────────────────────────────────

/** Recursively count all nodes in a bookmark tree. */
function countNodes(nodes: BookmarkNode[]): number {
  let count = 0;
  for (const n of nodes) {
    count += 1 + countNodes(n.children);
  }
  return count;
}

/** Recursively collect all nodes via depth-first traversal. */
function dfs(nodes: BookmarkNode[]): BookmarkNode[] {
  const result: BookmarkNode[] = [];
  for (const n of nodes) {
    result.push(n);
    result.push(...dfs(n.children));
  }
  return result;
}

// ── Property 1: ブックマークツリーのノード数保存 ────────────────────
// Feature: pdf-bookmarks, Property 1: ブックマークツリーのノード数保存

describe('pdfBookmarks property tests – node count preservation', () => {
  /**
   * Property 1: ブックマークツリーのノード数保存
   *
   * For any BookmarkEntry[] array and valid minLevel/maxLevel,
   * the total node count of the tree returned by buildBookmarkTree
   * (counted recursively) equals the number of input entries
   * within the minLevel~maxLevel range.
   *
   * **Validates: Requirements 2.2**
   */
  it('Property 1: total tree node count equals filtered input entry count', () => {
    fc.assert(
      fc.property(bookmarkListArb, levelRangeArb, (entries, range) => {
        const tree = buildBookmarkTree(entries, range.min, range.max);

        const filteredCount = entries.filter(
          (e) => e.level >= range.min && e.level <= range.max,
        ).length;

        expect(countNodes(tree)).toBe(filteredCount);
      }),
      { numRuns: 200, seed: 42 },
    );
  });
});


// ── Property 2: ブックマークツリーの深さ優先走査順序 ────────────────
// Feature: pdf-bookmarks, Property 2: ブックマークツリーの深さ優先走査順序

describe('pdfBookmarks property tests – DFS traversal order preservation', () => {
  /**
   * Property 2: ブックマークツリーの深さ優先走査順序
   *
   * For any BookmarkEntry[] array and valid minLevel/maxLevel,
   * a depth-first traversal of the tree returned by buildBookmarkTree
   * yields nodes whose titles match the filtered input entries' text
   * values in the same order.
   *
   * **Validates: Requirements 2.3**
   */
  it('Property 2: DFS traversal order matches filtered input order', () => {
    fc.assert(
      fc.property(bookmarkListArb, levelRangeArb, (entries, range) => {
        const tree = buildBookmarkTree(entries, range.min, range.max);

        const filtered = entries.filter(
          (e) => e.level >= range.min && e.level <= range.max,
        );

        const traversed = dfs(tree);

        expect(traversed.map((n) => n.title)).toEqual(filtered.map((e) => e.text));
      }),
      { numRuns: 200, seed: 42 },
    );
  });
});


// ── Property 3: ページインデックスの範囲制約 ────────────────────────
// Feature: pdf-bookmarks, Property 3: ページインデックスの範囲制約

describe('pdfBookmarks property tests – page index range constraint', () => {
  /**
   * Property 3: ページインデックスの範囲制約
   *
   * For any BookmarkEntry[] array and valid minLevel/maxLevel,
   * all nodes in the tree returned by buildBookmarkTree have
   * pageIndex >= 0, and each node's pageIndex equals the
   * corresponding filtered entry's pageNumber - 1.
   *
   * **Validates: Requirements 2.4**
   */
  it('Property 3: all nodes have pageIndex >= 0 and pageIndex === pageNumber - 1', () => {
    fc.assert(
      fc.property(bookmarkListArb, levelRangeArb, (entries, range) => {
        const tree = buildBookmarkTree(entries, range.min, range.max);

        const filtered = entries.filter(
          (e) => e.level >= range.min && e.level <= range.max,
        );

        const traversed = dfs(tree);

        // Every node must have pageIndex >= 0
        for (const node of traversed) {
          expect(node.pageIndex).toBeGreaterThanOrEqual(0);
        }

        // Each DFS node must match the corresponding filtered entry: pageIndex === pageNumber - 1
        expect(traversed.length).toBe(filtered.length);
        for (let i = 0; i < traversed.length; i++) {
          expect(traversed[i].pageIndex).toBe(filtered[i].pageNumber - 1);
        }
      }),
      { numRuns: 200, seed: 42 },
    );
  });
});


// ── Property 4: ルートノードのレベル制約 ────────────────────────────
// Feature: pdf-bookmarks, Property 4: ルートノードのレベル制約

describe('pdfBookmarks property tests – root node level constraint', () => {
  /**
   * Property 4: ルートノードのレベル制約
   *
   * For any BookmarkEntry[] array and valid minLevel/maxLevel,
   * every root node in the tree returned by buildBookmarkTree has a
   * level that is less than or equal to the minimum level seen among
   * all preceding filtered entries (or it is the very first entry).
   *
   * This ensures no node that should be a child of a preceding
   * lower-level heading is incorrectly promoted to root.
   *
   * **Validates: Requirements 2.1**
   */
  it('Property 4: root nodes have level <= min level of all preceding filtered entries', () => {
    fc.assert(
      fc.property(bookmarkListArb, levelRangeArb, (entries, range) => {
        const tree = buildBookmarkTree(entries, range.min, range.max);

        const filtered = entries.filter(
          (e) => e.level >= range.min && e.level <= range.max,
        );

        if (filtered.length === 0) {
          expect(tree).toEqual([]);
          return;
        }

        // Collect the levels of root nodes from the tree
        const rootLevels = tree.map((r) => r.level);

        // Walk filtered entries and replicate the stack-based root detection.
        // A filtered entry becomes a root when the stack is empty, which
        // happens when its level is <= all levels currently on the stack.
        // Equivalently, a root entry's level is <= the minimum level seen
        // among all entries that appeared before it in the filtered list.
        const observedRootLevels: number[] = [];
        let minLevelSoFar = Infinity;
        for (const entry of filtered) {
          if (entry.level <= minLevelSoFar) {
            observedRootLevels.push(entry.level);
          }
          minLevelSoFar = Math.min(minLevelSoFar, entry.level);
        }

        // The actual root levels must be a superset of the "guaranteed" roots
        // (entries whose level <= all preceding levels), and every actual root
        // must have level <= minLevelSoFar at the point it appears.
        // Simplest correct check: verify root count and that each root level
        // appears at a valid position in the filtered sequence.

        // Direct verification: walk the algorithm's stack logic to determine
        // exactly which entries become roots, then compare.
        const expectedRootLevels: number[] = [];
        const stack: number[] = []; // stack of levels
        for (const entry of filtered) {
          while (stack.length > 0 && stack[stack.length - 1] >= entry.level) {
            stack.pop();
          }
          if (stack.length === 0) {
            expectedRootLevels.push(entry.level);
          }
          stack.push(entry.level);
        }

        expect(rootLevels).toEqual(expectedRootLevels);
      }),
      { numRuns: 200, seed: 42 },
    );
  });
});


// ── Property 5: 空入力に対する安全性 ────────────────────────────────
// Feature: pdf-bookmarks, Property 5: 空入力に対する安全性

describe('pdfBookmarks property tests – empty input safety', () => {
  /**
   * Property 5: 空入力に対する安全性
   *
   * For any valid minLevel/maxLevel range,
   * buildBookmarkTree([], minLevel, maxLevel) returns an empty array.
   *
   * **Validates: Requirements 1.3**
   */
  it('Property 5: buildBookmarkTree([], minLevel, maxLevel) returns []', () => {
    fc.assert(
      fc.property(levelRangeArb, (range) => {
        const tree = buildBookmarkTree([], range.min, range.max);
        expect(tree).toEqual([]);
      }),
      { numRuns: 200, seed: 42 },
    );
  });
});
