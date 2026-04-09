import { describe, it, expect } from 'vitest';
import { buildBookmarkTree, BookmarkNode } from '../../src/export/pdfBookmarks';
import type { BookmarkEntry } from '../../src/types/models';

/** Helper: recursively count all nodes in a tree */
function countNodes(nodes: BookmarkNode[]): number {
  let count = 0;
  for (const n of nodes) {
    count += 1 + countNodes(n.children);
  }
  return count;
}

/** Helper: collect all nodes via DFS */
function dfs(nodes: BookmarkNode[]): BookmarkNode[] {
  const result: BookmarkNode[] = [];
  for (const n of nodes) {
    result.push(n);
    result.push(...dfs(n.children));
  }
  return result;
}

describe('buildBookmarkTree', () => {
  it('returns empty array for empty input (AC 1.3)', () => {
    expect(buildBookmarkTree([], 1, 6)).toEqual([]);
  });

  it('converts a basic H1→H2→H3 hierarchy (AC 2.1)', () => {
    const entries: BookmarkEntry[] = [
      { level: 1, text: 'Chapter 1', pageNumber: 1 },
      { level: 2, text: 'Section 1.1', pageNumber: 2 },
      { level: 3, text: 'Sub 1.1.1', pageNumber: 3 },
      { level: 2, text: 'Section 1.2', pageNumber: 4 },
      { level: 1, text: 'Chapter 2', pageNumber: 5 },
    ];
    const tree = buildBookmarkTree(entries, 1, 6);

    expect(tree).toHaveLength(2);
    // Chapter 1
    expect(tree[0].title).toBe('Chapter 1');
    expect(tree[0].children).toHaveLength(2);
    // Section 1.1
    expect(tree[0].children[0].title).toBe('Section 1.1');
    expect(tree[0].children[0].children).toHaveLength(1);
    // Sub 1.1.1
    expect(tree[0].children[0].children[0].title).toBe('Sub 1.1.1');
    expect(tree[0].children[0].children[0].children).toHaveLength(0);
    // Section 1.2
    expect(tree[0].children[1].title).toBe('Section 1.2');
    expect(tree[0].children[1].children).toHaveLength(0);
    // Chapter 2
    expect(tree[1].title).toBe('Chapter 2');
    expect(tree[1].children).toHaveLength(0);
  });

  it('filters entries by minLevel/maxLevel (AC 3.1)', () => {
    const entries: BookmarkEntry[] = [
      { level: 1, text: 'H1 - excluded', pageNumber: 1 },
      { level: 2, text: 'H2 - included', pageNumber: 2 },
      { level: 3, text: 'H3 - included', pageNumber: 3 },
      { level: 4, text: 'H4 - included', pageNumber: 4 },
      { level: 5, text: 'H5 - excluded', pageNumber: 5 },
    ];
    const tree = buildBookmarkTree(entries, 2, 4);

    // Only H2, H3, H4 should be present
    const allNodes = dfs(tree);
    expect(allNodes).toHaveLength(3);
    expect(allNodes.map(n => n.title)).toEqual([
      'H2 - included',
      'H3 - included',
      'H4 - included',
    ]);
  });

  it('returns all entries as roots for single-level input', () => {
    const entries: BookmarkEntry[] = [
      { level: 2, text: 'A', pageNumber: 1 },
      { level: 2, text: 'B', pageNumber: 2 },
      { level: 2, text: 'C', pageNumber: 3 },
    ];
    const tree = buildBookmarkTree(entries, 1, 6);

    expect(tree).toHaveLength(3);
    for (const node of tree) {
      expect(node.children).toHaveLength(0);
    }
  });

  it('handles deep nesting H1→H2→H3→H4', () => {
    const entries: BookmarkEntry[] = [
      { level: 1, text: 'L1', pageNumber: 1 },
      { level: 2, text: 'L2', pageNumber: 2 },
      { level: 3, text: 'L3', pageNumber: 3 },
      { level: 4, text: 'L4', pageNumber: 4 },
    ];
    const tree = buildBookmarkTree(entries, 1, 6);

    expect(tree).toHaveLength(1);
    expect(tree[0].title).toBe('L1');
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children[0].title).toBe('L2');
    expect(tree[0].children[0].children).toHaveLength(1);
    expect(tree[0].children[0].children[0].title).toBe('L3');
    expect(tree[0].children[0].children[0].children).toHaveLength(1);
    expect(tree[0].children[0].children[0].children[0].title).toBe('L4');
    expect(tree[0].children[0].children[0].children[0].children).toHaveLength(0);
  });

  it('handles level skip H1→H3 with no H2 (AC 2.5)', () => {
    const entries: BookmarkEntry[] = [
      { level: 1, text: 'Chapter', pageNumber: 1 },
      { level: 3, text: 'Subsection', pageNumber: 2 },
    ];
    const tree = buildBookmarkTree(entries, 1, 6);

    expect(tree).toHaveLength(1);
    expect(tree[0].title).toBe('Chapter');
    // H3 becomes child of H1 (since there's no H2)
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children[0].title).toBe('Subsection');
  });

  it('converts pageNumber to 0-based pageIndex (AC 2.4)', () => {
    const entries: BookmarkEntry[] = [
      { level: 1, text: 'Page 1', pageNumber: 1 },
      { level: 1, text: 'Page 5', pageNumber: 5 },
      { level: 2, text: 'Page 10', pageNumber: 10 },
    ];
    const tree = buildBookmarkTree(entries, 1, 6);
    const allNodes = dfs(tree);

    expect(allNodes[0].pageIndex).toBe(0);  // 1 - 1
    expect(allNodes[1].pageIndex).toBe(4);  // 5 - 1
    expect(allNodes[2].pageIndex).toBe(9);  // 10 - 1
  });

  it('preserves node count after tree construction', () => {
    const entries: BookmarkEntry[] = [
      { level: 1, text: 'A', pageNumber: 1 },
      { level: 2, text: 'B', pageNumber: 2 },
      { level: 3, text: 'C', pageNumber: 3 },
      { level: 2, text: 'D', pageNumber: 4 },
      { level: 1, text: 'E', pageNumber: 5 },
      { level: 2, text: 'F', pageNumber: 6 },
    ];
    const tree = buildBookmarkTree(entries, 1, 6);
    expect(countNodes(tree)).toBe(6);
  });

  it('returns empty array when all entries are filtered out', () => {
    const entries: BookmarkEntry[] = [
      { level: 1, text: 'H1', pageNumber: 1 },
      { level: 5, text: 'H5', pageNumber: 2 },
    ];
    const tree = buildBookmarkTree(entries, 2, 4);
    expect(tree).toEqual([]);
  });
});
