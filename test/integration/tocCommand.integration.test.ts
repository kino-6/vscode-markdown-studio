import { describe, expect, it } from 'vitest';
import { createMarkdownParser } from '../../src/parser/parseMarkdown';
import { extractHeadings } from '../../src/toc/extractHeadings';
import { resolveAnchors } from '../../src/toc/anchorResolver';
import { buildTocMarkdown } from '../../src/toc/buildTocMarkdown';
import {
  findTocCommentMarkers,
  wrapWithMarkers,
  replaceTocContent,
} from '../../src/toc/tocCommentMarker';
import { injectTocPageBreakCss } from '../../src/export/pdfHeaderFooter';
import { scanFencedBlocks } from '../../src/parser/scanFencedBlocks';
import type { TocConfig } from '../../src/types/models';

const defaultConfig: TocConfig = {
  minLevel: 1,
  maxLevel: 3,
  orderedList: false,
  pageBreak: true,
};

describe('TOC command generation integration', () => {
  const md = createMarkdownParser();

  it('full TOC generation pipeline produces correct entries', () => {
    const source = [
      '# Introduction',
      '',
      '## Getting Started',
      '',
      '### Installation',
      '',
      '## Usage',
      '',
      'Some content.',
    ].join('\n');

    const headings = extractHeadings(source, md);
    const anchors = resolveAnchors(headings);
    const tocText = buildTocMarkdown(anchors, defaultConfig);
    const wrapped = wrapWithMarkers(tocText);

    // Verify TOC entries
    expect(tocText).toContain('- [Introduction](#introduction)');
    expect(tocText).toContain('  - [Getting Started](#getting-started)');
    expect(tocText).toContain('    - [Installation](#installation)');
    expect(tocText).toContain('  - [Usage](#usage)');

    // Verify markers wrap the content
    expect(wrapped).toMatch(/^<!-- TOC -->\n/);
    expect(wrapped).toMatch(/\n<!-- \/TOC -->$/);
    expect(wrapped).toContain(tocText);
  });

  it('TOC update flow replaces existing content between markers', () => {
    const oldToc = [
      '- [Old Heading](#old-heading)',
      '  - [Old Sub](#old-sub)',
    ].join('\n');

    const document = [
      '# Title',
      '',
      '<!-- TOC -->',
      oldToc,
      '<!-- /TOC -->',
      '',
      '## New Section',
      '',
      'Content here.',
    ].join('\n');

    // Detect existing markers
    const markerRange = findTocCommentMarkers(document);
    expect(markerRange).toBeDefined();
    expect(markerRange!.content).toBe(oldToc);

    // Regenerate TOC from current headings
    const headings = extractHeadings(document, md);
    const anchors = resolveAnchors(headings);
    const newTocText = buildTocMarkdown(anchors, defaultConfig);

    // Replace content
    const updated = replaceTocContent(document, markerRange!, newTocText);

    // Verify updated document
    expect(updated).toContain('<!-- TOC -->');
    expect(updated).toContain('<!-- /TOC -->');
    expect(updated).toContain('- [Title](#title)');
    expect(updated).toContain('  - [New Section](#new-section)');
    expect(updated).not.toContain('Old Heading');

    // Content outside markers is preserved
    expect(updated).toContain('Content here.');
  });

  it('excludes headings inside code blocks and ignores markers inside code blocks', () => {
    const source = [
      '# Real Heading',
      '',
      '```mermaid',
      '# Not A Heading',
      '```',
      '',
      '## Another Real Heading',
      '',
      '```plantuml',
      '<!-- TOC -->',
      '# Fake Heading Inside Code',
      '<!-- /TOC -->',
      '```',
    ].join('\n');

    // Extract headings — code block headings should be excluded
    const headings = extractHeadings(source, md);
    const headingTexts = headings.map((h) => h.text);
    expect(headingTexts).toContain('Real Heading');
    expect(headingTexts).toContain('Another Real Heading');
    expect(headingTexts).not.toContain('Not A Heading');
    expect(headingTexts).not.toContain('Fake Heading Inside Code');

    // Markers inside code blocks should be ignored
    const fencedBlocks = scanFencedBlocks(source);
    const fencedRanges = fencedBlocks.map((b) => ({
      startLine: b.startLine,
      endLine: b.endLine,
    }));
    const markerRange = findTocCommentMarkers(source, fencedRanges);
    expect(markerRange).toBeUndefined();
  });

  it('injectTocPageBreakCss wraps TOC content with page-break CSS', () => {
    const html = [
      '<h1>Title</h1>',
      '<!-- TOC -->',
      '<ul><li><a href="#section">Section</a></li></ul>',
      '<!-- /TOC -->',
      '<h2 id="section">Section</h2>',
    ].join('\n');

    const result = injectTocPageBreakCss(html);

    expect(result).toContain('page-break-before: always');
    expect(result).toContain('page-break-after: always');
    expect(result).toContain('<!-- TOC -->');
    expect(result).toContain('<!-- /TOC -->');
    // Original content is preserved
    expect(result).toContain('<h2 id="section">Section</h2>');

    // Idempotent — second call returns same result
    const result2 = injectTocPageBreakCss(result);
    expect(result2).toBe(result);
  });

  it('document with no headings produces empty TOC markers', () => {
    const source = 'Just some plain text without any headings.';

    const headings = extractHeadings(source, md);
    expect(headings).toHaveLength(0);

    const anchors = resolveAnchors(headings);
    const tocText = buildTocMarkdown(anchors, defaultConfig);
    expect(tocText).toBe('');

    const wrapped = wrapWithMarkers(tocText);
    expect(wrapped).toBe('<!-- TOC -->\n<!-- /TOC -->');

    // Round-trip: parse the empty markers back
    const markerRange = findTocCommentMarkers(wrapped);
    expect(markerRange).toBeDefined();
    expect(markerRange!.content).toBe('');
  });
});
