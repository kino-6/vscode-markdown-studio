import { describe, expect, it } from 'vitest';
import { createMarkdownParser } from '../../src/parser/parseMarkdown';
import { scanFencedBlocks } from '../../src/parser/scanFencedBlocks';

describe('parser and fenced block scanning', () => {
  it('renders markdown headings and emphasis', () => {
    const parser = createMarkdownParser();
    const html = parser.render('# Title\n\nThis is **bold**');

    expect(html).toContain('<h1 data-source-line="0">Title</h1>');
    expect(html).toContain('<strong>bold</strong>');
  });

  it('finds mermaid, plantuml, puml, svg, and wavedrom fenced blocks with line ranges', () => {
    const markdown = [
      'Intro',
      '```mermaid',
      'graph TD;A-->B;',
      '```',
      '```plantuml',
      '@startuml',
      'Alice->Bob:Hi',
      '@enduml',
      '```',
      '```puml',
      '@startuml',
      'Bob->Alice:Yo',
      '@enduml',
      '```',
      '```svg',
      '<svg></svg>',
      '```',
      '```wavejson',
      '{ signal: [] }',
      '```',
    ].join('\n');

    const blocks = scanFencedBlocks(markdown);

    expect(blocks.map((b) => b.kind)).toEqual(['mermaid', 'plantuml', 'puml', 'svg', 'wavedrom']);
    expect(blocks[0]).toMatchObject({ startLine: 2, endLine: 4 });
    expect(blocks[1]).toMatchObject({ startLine: 5, endLine: 9 });
    expect(blocks[2]).toMatchObject({ startLine: 10, endLine: 14 });
    expect(blocks[3]).toMatchObject({ startLine: 15, endLine: 17 });
    expect(blocks[4]).toMatchObject({ startLine: 18, endLine: 20 });
  });

  it('normalizes WaveDrom fence aliases', () => {
    const markdown = [
      '```wavedrom',
      '{ signal: [] }',
      '```',
      '```wavejson',
      '{ signal: [] }',
      '```',
      '```wavedrom-json',
      '{ signal: [] }',
      '```',
    ].join('\n');

    const blocks = scanFencedBlocks(markdown);

    expect(blocks.map((b) => b.kind)).toEqual(['wavedrom', 'wavedrom', 'wavedrom']);
  });

  it('keeps raw offsets for CRLF fenced blocks', () => {
    const markdown = [
      'Intro',
      '```plantuml',
      '@startuml',
      'Alice->Bob:Hi',
      '@enduml',
      '```',
      'After',
    ].join('\r\n');

    const [block] = scanFencedBlocks(markdown);

    expect(block).toMatchObject({ kind: 'plantuml', startLine: 2, endLine: 6 });
    expect(block.raw).toBe('```plantuml\r\n@startuml\r\nAlice->Bob:Hi\r\n@enduml\r\n```');
    expect(markdown.slice(block.startOffset, block.endOffset)).toBe(block.raw);
  });
});
