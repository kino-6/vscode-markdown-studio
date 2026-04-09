import { describe, it, expect } from 'vitest';
import { parseAnchors } from '../../scripts/demo/anchorParser.js';

describe('parseAnchors', () => {
  it('extracts a single anchor', () => {
    const content = '<!-- DEMO:MERMAID -->';
    const result = parseAnchors(content);
    expect(result).toEqual([
      { name: 'MERMAID', anchor: '<!-- DEMO:MERMAID -->', line: 1 },
    ]);
  });

  it('extracts multiple anchors with correct line numbers', () => {
    const content = [
      '# Title',
      '<!-- DEMO:RENDERING -->',
      '## Rendering',
      '',
      '<!-- DEMO:MERMAID -->',
      '## Mermaid',
    ].join('\n');

    const result = parseAnchors(content);
    expect(result).toEqual([
      { name: 'RENDERING', anchor: '<!-- DEMO:RENDERING -->', line: 2 },
      { name: 'MERMAID', anchor: '<!-- DEMO:MERMAID -->', line: 5 },
    ]);
  });

  it('returns empty array when no anchors exist', () => {
    const content = '# Just a heading\nSome text\n';
    expect(parseAnchors(content)).toEqual([]);
  });

  it('returns empty array for empty string', () => {
    expect(parseAnchors('')).toEqual([]);
  });

  it('ignores non-DEMO HTML comments', () => {
    const content = '<!-- TODO: fix this -->\n<!-- DEMO:EXPORT -->';
    const result = parseAnchors(content);
    expect(result).toEqual([
      { name: 'EXPORT', anchor: '<!-- DEMO:EXPORT -->', line: 2 },
    ]);
  });

  it('handles anchors with extra whitespace inside the comment', () => {
    const content = '<!--  DEMO:SECURITY  -->';
    const result = parseAnchors(content);
    expect(result).toEqual([
      { name: 'SECURITY', anchor: '<!--  DEMO:SECURITY  -->', line: 1 },
    ]);
  });

  it('ignores lines where anchor is not the full line content', () => {
    const content = 'text <!-- DEMO:MERMAID --> more text';
    expect(parseAnchors(content)).toEqual([]);
  });
});
