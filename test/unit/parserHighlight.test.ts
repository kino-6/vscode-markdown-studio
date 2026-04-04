import { describe, expect, it } from 'vitest';
import { createMarkdownParser } from '../../src/parser/parseMarkdown';

describe('parser syntax highlighting integration', () => {
  const parser = createMarkdownParser();

  it('renders a fenced block with a known language (typescript) with hljs class spans', () => {
    const md = '```typescript\nconst x: number = 1;\n```';
    const html = parser.render(md);

    expect(html).toContain('<pre>');
    expect(html).toContain('<code');
    expect(html).toMatch(/class="hljs/);
    expect(html).toMatch(/hljs-/);
    expect(html).toContain('<span class="hljs-');
  });

  it('renders a fenced block with an unknown language as plain escaped <pre><code>', () => {
    const md = '```unknownlang\nconst x = 1;\n```';
    const html = parser.render(md);

    expect(html).toContain('<pre>');
    expect(html).toContain('<code');
    expect(html).not.toContain('hljs-');
    // markdown-it escapes HTML entities in plain output
    expect(html).not.toContain('<span class="hljs-');
  });

  it('renders a fenced block with no language as plain escaped <pre><code>', () => {
    const md = '```\nconst x = 1;\n```';
    const html = parser.render(md);

    expect(html).toContain('<pre>');
    expect(html).toContain('<code');
    expect(html).not.toContain('hljs-');
    expect(html).not.toContain('<span class="hljs-');
  });
});
