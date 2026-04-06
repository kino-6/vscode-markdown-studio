import { describe, it, expect } from 'vitest';
import { buildTocMarkdown, parseTocLinks } from '../../src/toc/buildTocMarkdown';
import type { AnchorMapping, TocConfig } from '../../src/types/models';

function makeAnchor(level: number, text: string, anchorId: string): AnchorMapping {
  return { heading: { level, text, line: 0 }, anchorId };
}

const defaultConfig: TocConfig = {
  minLevel: 1,
  maxLevel: 3,
  orderedList: false,
  pageBreak: false,
};

describe('buildTocMarkdown', () => {
  it('returns empty string for empty heading list', () => {
    expect(buildTocMarkdown([], defaultConfig)).toBe('');
  });

  it('generates a single entry for a single heading', () => {
    const anchors = [makeAnchor(1, 'Introduction', 'introduction')];
    const result = buildTocMarkdown(anchors, defaultConfig);
    expect(result).toBe('- [Introduction](#introduction)');
  });

  it('generates nested indentation for h1→h2→h3', () => {
    const anchors = [
      makeAnchor(1, 'Title', 'title'),
      makeAnchor(2, 'Section', 'section'),
      makeAnchor(3, 'Subsection', 'subsection'),
    ];
    const result = buildTocMarkdown(anchors, defaultConfig);
    expect(result).toBe(
      [
        '- [Title](#title)',
        '  - [Section](#section)',
        '    - [Subsection](#subsection)',
      ].join('\n'),
    );
  });

  it('handles Japanese headings correctly', () => {
    const anchors = [
      makeAnchor(1, '概要', '概要'),
      makeAnchor(2, '導入', '導入'),
    ];
    const result = buildTocMarkdown(anchors, defaultConfig);
    expect(result).toBe(
      [
        '- [概要](#概要)',
        '  - [導入](#導入)',
      ].join('\n'),
    );
  });

  it('filters headings outside minLevel~maxLevel range', () => {
    const anchors = [
      makeAnchor(1, 'H1', 'h1'),
      makeAnchor(4, 'H4', 'h4'),
      makeAnchor(2, 'H2', 'h2'),
    ];
    const result = buildTocMarkdown(anchors, defaultConfig);
    expect(result).toBe(
      [
        '- [H1](#h1)',
        '  - [H2](#h2)',
      ].join('\n'),
    );
    expect(result).not.toContain('H4');
  });

  it('uses ordered list format when orderedList is true', () => {
    const anchors = [
      makeAnchor(1, 'First', 'first'),
      makeAnchor(2, 'Second', 'second'),
    ];
    const result = buildTocMarkdown(anchors, { ...defaultConfig, orderedList: true });
    expect(result).toBe(
      [
        '1. [First](#first)',
        '  1. [Second](#second)',
      ].join('\n'),
    );
  });

  it('returns empty string when all headings are outside range', () => {
    const anchors = [
      makeAnchor(4, 'Deep', 'deep'),
      makeAnchor(5, 'Deeper', 'deeper'),
    ];
    expect(buildTocMarkdown(anchors, defaultConfig)).toBe('');
  });
});

describe('parseTocLinks', () => {
  it('returns empty array for empty string', () => {
    expect(parseTocLinks('')).toEqual([]);
  });

  it('parses a single TOC entry', () => {
    const result = parseTocLinks('- [Title](#title)');
    expect(result).toEqual([{ text: 'Title', anchor: 'title' }]);
  });

  it('parses multiple indented entries', () => {
    const toc = [
      '- [A](#a)',
      '  - [B](#b)',
      '    - [C](#c)',
    ].join('\n');
    const result = parseTocLinks(toc);
    expect(result).toEqual([
      { text: 'A', anchor: 'a' },
      { text: 'B', anchor: 'b' },
      { text: 'C', anchor: 'c' },
    ]);
  });

  it('parses ordered list entries', () => {
    const toc = '1. [First](#first)\n  1. [Second](#second)';
    const result = parseTocLinks(toc);
    expect(result).toEqual([
      { text: 'First', anchor: 'first' },
      { text: 'Second', anchor: 'second' },
    ]);
  });
});
