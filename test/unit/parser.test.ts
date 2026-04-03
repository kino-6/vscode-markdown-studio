import { describe, expect, it } from 'vitest';
import { createMarkdownParser } from '../../src/parser/parseMarkdown';
import { scanFencedBlocks } from '../../src/parser/scanFencedBlocks';
import { sanitizeSvg } from '../../src/parser/sanitizeSvg';

describe('markdown parser', () => {
  it('renders normal markdown content', () => {
    const parser = createMarkdownParser();
    const html = parser.render('# Hello\n\nThis is **Markdown Studio**.');
    expect(html).toContain('<h1>Hello</h1>');
    expect(html).toContain('<strong>Markdown Studio</strong>');
  });
});

describe('fenced block scanning', () => {
  it('detects mermaid, plantuml, and puml blocks', () => {
    const source = [
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

    const blocks = scanFencedBlocks(source);
    expect(blocks.map((b) => b.kind)).toEqual(['mermaid', 'plantuml', 'puml']);
  });
});

describe('svg sanitization', () => {
  it('strips script and foreignObject', () => {
    const dirty = '<svg><script>alert(1)</script><foreignObject>bad</foreignObject><rect width="10" /></svg>';
    const clean = sanitizeSvg(dirty).toLowerCase();
    expect(clean).not.toContain('<script');
    expect(clean).not.toContain('foreignobject');
  });

  it('strips iframe/object/embed and event handlers', () => {
    const dirty = '<svg><iframe></iframe><object></object><embed></embed><rect onload="x()" onclick="y()"/></svg>';
    const clean = sanitizeSvg(dirty).toLowerCase();
    expect(clean).not.toContain('<iframe');
    expect(clean).not.toContain('<object');
    expect(clean).not.toContain('<embed');
    expect(clean).not.toContain('onload');
    expect(clean).not.toContain('onclick');
  });

  it('strips javascript: and external references', () => {
    const dirty = '<svg><a href="javascript:alert(1)">x</a><use href="https://evil.test/x.svg#id" /></svg>';
    const clean = sanitizeSvg(dirty).toLowerCase();
    expect(clean).not.toContain('javascript:');
    expect(clean).not.toContain('https://evil.test');
  });
});
