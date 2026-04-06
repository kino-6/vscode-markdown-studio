import { describe, expect, it } from 'vitest';
import {
  findTocCommentMarkers,
  wrapWithMarkers,
  replaceTocContent,
} from '../../src/toc/tocCommentMarker';

// ── findTocCommentMarkers ──────────────────────────────────────────

describe('findTocCommentMarkers', () => {
  it('returns undefined when no markers are present', () => {
    const doc = '# Hello\n\nSome text\n';
    expect(findTocCommentMarkers(doc)).toBeUndefined();
  });

  it('returns undefined when only start marker is present (missing end marker)', () => {
    const doc = '# Hello\n<!-- TOC -->\n- [Hello](#hello)\n';
    expect(findTocCommentMarkers(doc)).toBeUndefined();
  });

  it('ignores markers inside code blocks', () => {
    const doc = [
      '# Hello',
      '```',
      '<!-- TOC -->',
      '- [Hello](#hello)',
      '<!-- /TOC -->',
      '```',
    ].join('\n');

    const fencedRanges = [{ startLine: 1, endLine: 6 }];
    expect(findTocCommentMarkers(doc, fencedRanges)).toBeUndefined();
  });

  it('detects markers outside code blocks while ignoring those inside', () => {
    const doc = [
      '```',
      '<!-- TOC -->',
      '<!-- /TOC -->',
      '```',
      '<!-- TOC -->',
      '- [Real](#real)',
      '<!-- /TOC -->',
    ].join('\n');

    const fencedRanges = [{ startLine: 0, endLine: 4 }];
    const result = findTocCommentMarkers(doc, fencedRanges);

    expect(result).toBeDefined();
    expect(result!.startLine).toBe(4);
    expect(result!.endLine).toBe(6);
    expect(result!.content).toBe('- [Real](#real)');
  });

  it('returns empty content for empty TOC section', () => {
    const doc = '<!-- TOC -->\n<!-- /TOC -->';
    const result = findTocCommentMarkers(doc);

    expect(result).toBeDefined();
    expect(result!.startLine).toBe(0);
    expect(result!.endLine).toBe(1);
    expect(result!.content).toBe('');
  });

  it('handles markers with surrounding whitespace', () => {
    const doc = '  <!-- TOC -->  \n- [A](#a)\n  <!-- /TOC -->  ';
    const result = findTocCommentMarkers(doc);

    expect(result).toBeDefined();
    expect(result!.startLine).toBe(0);
    expect(result!.endLine).toBe(2);
    expect(result!.content).toBe('- [A](#a)');
  });

  it('returns multi-line content between markers', () => {
    const doc = [
      '# Doc',
      '',
      '<!-- TOC -->',
      '- [Intro](#intro)',
      '  - [Setup](#setup)',
      '- [Usage](#usage)',
      '<!-- /TOC -->',
      '',
      '## Intro',
    ].join('\n');

    const result = findTocCommentMarkers(doc);

    expect(result).toBeDefined();
    expect(result!.startLine).toBe(2);
    expect(result!.endLine).toBe(6);
    expect(result!.content).toBe('- [Intro](#intro)\n  - [Setup](#setup)\n- [Usage](#usage)');
  });
});

// ── wrapWithMarkers ────────────────────────────────────────────────

describe('wrapWithMarkers', () => {
  it('wraps non-empty text with markers', () => {
    const result = wrapWithMarkers('- [Hello](#hello)');
    expect(result).toBe('<!-- TOC -->\n- [Hello](#hello)\n<!-- /TOC -->');
  });

  it('wraps empty text with markers (no content line)', () => {
    const result = wrapWithMarkers('');
    expect(result).toBe('<!-- TOC -->\n<!-- /TOC -->');
  });

  it('wraps multi-line text with markers', () => {
    const toc = '- [A](#a)\n- [B](#b)';
    const result = wrapWithMarkers(toc);
    expect(result).toBe('<!-- TOC -->\n- [A](#a)\n- [B](#b)\n<!-- /TOC -->');
  });
});

// ── replaceTocContent ──────────────────────────────────────────────

describe('replaceTocContent', () => {
  it('replaces TOC content between markers', () => {
    const doc = '# Doc\n<!-- TOC -->\n- [Old](#old)\n<!-- /TOC -->\n## Old';
    const range = findTocCommentMarkers(doc)!;

    const updated = replaceTocContent(doc, range, '- [New](#new)');
    expect(updated).toBe('# Doc\n<!-- TOC -->\n- [New](#new)\n<!-- /TOC -->\n## Old');
  });

  it('replaces with empty content', () => {
    const doc = '<!-- TOC -->\n- [A](#a)\n<!-- /TOC -->';
    const range = findTocCommentMarkers(doc)!;

    const updated = replaceTocContent(doc, range, '');
    expect(updated).toBe('<!-- TOC -->\n<!-- /TOC -->');
  });

  it('replaces with multi-line content', () => {
    const doc = 'Before\n<!-- TOC -->\n- [Old](#old)\n<!-- /TOC -->\nAfter';
    const range = findTocCommentMarkers(doc)!;

    const newToc = '- [A](#a)\n  - [B](#b)\n- [C](#c)';
    const updated = replaceTocContent(doc, range, newToc);
    expect(updated).toBe('Before\n<!-- TOC -->\n- [A](#a)\n  - [B](#b)\n- [C](#c)\n<!-- /TOC -->\nAfter');
  });

  it('preserves content before and after markers', () => {
    const doc = 'Line 1\nLine 2\n<!-- TOC -->\n- [X](#x)\n<!-- /TOC -->\nLine 3\nLine 4';
    const range = findTocCommentMarkers(doc)!;

    const updated = replaceTocContent(doc, range, '- [Y](#y)');
    const lines = updated.split('\n');

    expect(lines[0]).toBe('Line 1');
    expect(lines[1]).toBe('Line 2');
    expect(lines[lines.length - 2]).toBe('Line 3');
    expect(lines[lines.length - 1]).toBe('Line 4');
  });
});
