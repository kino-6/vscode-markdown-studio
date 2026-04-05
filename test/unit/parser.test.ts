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

  it('finds mermaid, plantuml and puml fenced blocks with line ranges', () => {
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
      '```'
    ].join('\n');

    const blocks = scanFencedBlocks(markdown);

    expect(blocks.map((b) => b.kind)).toEqual(['mermaid', 'plantuml', 'puml']);
    expect(blocks[0]).toMatchObject({ startLine: 2, endLine: 4 });
    expect(blocks[1]).toMatchObject({ startLine: 5, endLine: 9 });
    expect(blocks[2]).toMatchObject({ startLine: 10, endLine: 14 });
  });
});
