import { describe, it, expect } from 'vitest';
import { buildTocHtml } from '../../src/toc/buildToc';
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

describe('buildTocHtml', () => {
  it('generates empty nav when no anchors', () => {
    expect(buildTocHtml([], defaultConfig)).toBe('<nav class="ms-toc"></nav>');
  });

  it('generates empty nav when all headings are outside level range', () => {
    const anchors = [makeAnchor(4, 'Deep', 'deep')];
    expect(buildTocHtml(anchors, defaultConfig)).toBe('<nav class="ms-toc"></nav>');
  });

  it('wraps output in <nav class="ms-toc">', () => {
    const anchors = [makeAnchor(1, 'Title', 'title')];
    const html = buildTocHtml(anchors, defaultConfig);
    expect(html).toMatch(/^<nav class="ms-toc">/);
    expect(html).toMatch(/<\/nav>$/);
  });

  it('generates anchor links with correct href', () => {
    const anchors = [makeAnchor(1, 'Hello', 'hello')];
    const html = buildTocHtml(anchors, defaultConfig);
    expect(html).toContain('<a href="#hello">Hello</a>');
  });

  it('uses <ul> by default', () => {
    const anchors = [makeAnchor(1, 'A', 'a')];
    const html = buildTocHtml(anchors, defaultConfig);
    expect(html).toContain('<ul>');
    expect(html).not.toContain('<ol>');
  });

  it('uses <ol> when orderedList is true', () => {
    const anchors = [makeAnchor(1, 'A', 'a')];
    const html = buildTocHtml(anchors, { ...defaultConfig, orderedList: true });
    expect(html).toContain('<ol>');
    expect(html).not.toContain('<ul>');
  });

  it('adds page-break style when pageBreak is true', () => {
    const anchors = [makeAnchor(1, 'A', 'a')];
    const html = buildTocHtml(anchors, { ...defaultConfig, pageBreak: true });
    expect(html).toContain('style="page-break-before: always; page-break-after: always;"');
  });

  it('does not add page-break style when pageBreak is false', () => {
    const anchors = [makeAnchor(1, 'A', 'a')];
    const html = buildTocHtml(anchors, defaultConfig);
    expect(html).not.toContain('page-break');
  });

  it('builds nested lists for deeper headings', () => {
    const anchors = [
      makeAnchor(1, 'H1', 'h1'),
      makeAnchor(2, 'H2', 'h2'),
      makeAnchor(3, 'H3', 'h3'),
    ];
    const html = buildTocHtml(anchors, defaultConfig);
    // Should have 3 levels of nesting
    expect(html).toContain('<a href="#h1">H1</a>');
    expect(html).toContain('<a href="#h2">H2</a>');
    expect(html).toContain('<a href="#h3">H3</a>');
    // Count opening/closing list tags
    const openUl = (html.match(/<ul>/g) || []).length;
    const closeUl = (html.match(/<\/ul>/g) || []).length;
    expect(openUl).toBe(3);
    expect(closeUl).toBe(3);
  });

  it('closes nested lists when heading level decreases', () => {
    const anchors = [
      makeAnchor(1, 'A', 'a'),
      makeAnchor(2, 'B', 'b'),
      makeAnchor(1, 'C', 'c'),
    ];
    const html = buildTocHtml(anchors, defaultConfig);
    expect(html).toContain('<a href="#a">A</a>');
    expect(html).toContain('<a href="#b">B</a>');
    expect(html).toContain('<a href="#c">C</a>');
  });

  it('filters headings outside minLevel-maxLevel range', () => {
    const anchors = [
      makeAnchor(1, 'H1', 'h1'),
      makeAnchor(4, 'H4', 'h4'),
      makeAnchor(2, 'H2', 'h2'),
    ];
    const html = buildTocHtml(anchors, defaultConfig);
    expect(html).toContain('h1');
    expect(html).toContain('h2');
    expect(html).not.toContain('h4');
  });

  it('escapes HTML entities in heading text', () => {
    const anchors = [makeAnchor(1, 'A <b>&</b> "C"', 'a-b-c')];
    const html = buildTocHtml(anchors, defaultConfig);
    expect(html).toContain('A &lt;b&gt;&amp;&lt;/b&gt; &quot;C&quot;');
  });

  it('adds page-break style to empty nav when pageBreak is true', () => {
    const html = buildTocHtml([], { ...defaultConfig, pageBreak: true });
    expect(html).toBe(
      '<nav class="ms-toc" style="page-break-before: always; page-break-after: always;"></nav>',
    );
  });
});
