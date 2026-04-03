import { describe, expect, it } from 'vitest';
import { sanitizeSvg } from '../src/parser/sanitizeSvg';
import { scanFencedBlocks } from '../src/parser/scanFencedBlocks';

describe('scanFencedBlocks', () => {
  it('finds mermaid and plantuml blocks', () => {
    const markdown = ['```mermaid', 'graph TD;A-->B;', '```', '```puml', '@startuml', 'Alice->Bob:Hi', '@enduml', '```'].join('\n');
    const blocks = scanFencedBlocks(markdown);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].kind).toBe('mermaid');
    expect(blocks[1].kind).toBe('puml');
  });
});

describe('sanitizeSvg', () => {
  it('removes malicious patterns', () => {
    const dirty = '<svg><script>alert(1)</script><foreignObject>bad</foreignObject><rect onclick="x()" /><a href="javascript:alert(1)">x</a></svg>';
    const clean = sanitizeSvg(dirty);
    expect(clean).not.toContain('script');
    expect(clean).not.toContain('foreignObject');
    expect(clean).not.toContain('onclick');
    expect(clean).not.toContain('javascript:');
  });
});
