import { describe, it, expect } from 'vitest';
import { findTocMarker, replaceTocMarker } from '../../src/toc/tocMarker';

describe('findTocMarker', () => {
  it('returns -1 when no marker is present', () => {
    expect(findTocMarker('# Hello\n\nSome text', [])).toBe(-1);
  });

  it('finds [[toc]] marker', () => {
    expect(findTocMarker('# Title\n\n[[toc]]\n\n## Sub', [])).toBe(2);
  });

  it('finds [toc] marker', () => {
    expect(findTocMarker('[toc]\n\n# Title', [])).toBe(0);
  });

  it('is case-insensitive', () => {
    expect(findTocMarker('[[TOC]]', [])).toBe(0);
    expect(findTocMarker('[TOC]', [])).toBe(0);
    expect(findTocMarker('[[Toc]]', [])).toBe(0);
    expect(findTocMarker('[ToC]', [])).toBe(0);
  });

  it('excludes markers inside fenced code blocks', () => {
    const md = '# Title\n```\n[[toc]]\n```\n\nSome text';
    // fenced range covers lines 1-3 (0-based)
    const fencedRanges = [{ startLine: 1, endLine: 4 }];
    expect(findTocMarker(md, fencedRanges)).toBe(-1);
  });

  it('finds marker after fenced code block', () => {
    const md = '```\n[[toc]]\n```\n\n[[toc]]';
    const fencedRanges = [{ startLine: 0, endLine: 3 }];
    expect(findTocMarker(md, fencedRanges)).toBe(4);
  });

  it('returns first valid marker when multiple exist', () => {
    const md = '[[toc]]\n\n[toc]';
    expect(findTocMarker(md, [])).toBe(0);
  });
});

describe('replaceTocMarker', () => {
  const tocHtml = '<nav class="ms-toc"><ul><li>Item</li></ul></nav>';

  it('replaces [[toc]] marker in paragraph', () => {
    const html = '<p>[[toc]]</p>';
    expect(replaceTocMarker(html, tocHtml)).toBe(tocHtml);
  });

  it('replaces [toc] marker in paragraph', () => {
    const html = '<p>[toc]</p>';
    expect(replaceTocMarker(html, tocHtml)).toBe(tocHtml);
  });

  it('is case-insensitive', () => {
    expect(replaceTocMarker('<p>[[TOC]]</p>', tocHtml)).toBe(tocHtml);
    expect(replaceTocMarker('<p>[TOC]</p>', tocHtml)).toBe(tocHtml);
    expect(replaceTocMarker('<p>[[Toc]]</p>', tocHtml)).toBe(tocHtml);
  });

  it('replaces only the first marker and removes the rest', () => {
    const html = '<p>[[toc]]</p>\n<h1>Title</h1>\n<p>[toc]</p>';
    const result = replaceTocMarker(html, tocHtml);
    expect(result).toContain(tocHtml);
    // Only one nav should exist
    const navCount = (result.match(/<nav class="ms-toc">/g) || []).length;
    expect(navCount).toBe(1);
    // Second marker should be removed
    expect(result).not.toContain('[toc]');
    expect(result).not.toContain('[TOC]');
  });

  it('returns html unchanged when no marker is present', () => {
    const html = '<h1>Title</h1><p>Content</p>';
    expect(replaceTocMarker(html, tocHtml)).toBe(html);
  });

  it('handles markers with surrounding whitespace in <p> tags', () => {
    const html = '<p>  [[toc]]  </p>';
    expect(replaceTocMarker(html, tocHtml)).toBe(tocHtml);
  });
});
