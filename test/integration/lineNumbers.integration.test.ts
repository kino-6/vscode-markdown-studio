import { describe, expect, it } from 'vitest';
import { createMarkdownParser } from '../../src/parser/parseMarkdown';

describe('Line numbers pipeline integration', () => {
  const markdownWithCode = [
    '# Test',
    '',
    '```typescript',
    'const x = 1;',
    'const y = 2;',
    '```',
  ].join('\n');

  /**
   * When line numbers are enabled, code blocks must use table structure
   * with ms-code-table, ms-line-numbers, and ms-code-content.
   */
  it('includes table structure with ms-code-table when lineNumbers is enabled', () => {
    const parser = createMarkdownParser({ lineNumbers: true });
    const html = parser.render(markdownWithCode);

    expect(html).toContain('class="ms-code-table"');
    expect(html).toContain('class="ms-line-numbers"');
    expect(html).toContain('class="ms-code-content"');
    expect(html).toContain('class="ms-code-wrapper"');
  });

  it('line numbers column contains correct numbers', () => {
    const parser = createMarkdownParser({ lineNumbers: true });
    const html = parser.render(markdownWithCode);

    // 2 lines of code: const x = 1; and const y = 2;
    expect(html).toContain('<pre>1\n2</pre>');
  });

  /**
   * When line numbers are disabled, code blocks must NOT contain table structure.
   */
  it('does not include ms-code-table when lineNumbers is disabled', () => {
    const parser = createMarkdownParser({ lineNumbers: false });
    const html = parser.render(markdownWithCode);

    expect(html).not.toContain('ms-code-table');
    expect(html).not.toContain('ms-line-numbers');
    expect(html).not.toContain('ms-code-wrapper');
  });

  it('does not include ms-code-table when lineNumbers option is omitted', () => {
    const parser = createMarkdownParser();
    const html = parser.render(markdownWithCode);

    expect(html).not.toContain('ms-code-table');
    expect(html).not.toContain('ms-line-numbers');
    expect(html).not.toContain('ms-code-wrapper');
  });

  /**
   * Code content in ms-code-content td does not contain line number text
   * from the line-numbers column.
   */
  it('code content td does not contain line number pre', () => {
    const parser = createMarkdownParser({ lineNumbers: true });
    const html = parser.render(markdownWithCode);

    // Extract the ms-code-content td
    const contentMatch = html.match(/<td class="ms-code-content">([\s\S]*?)<\/td>/);
    expect(contentMatch).not.toBeNull();

    // The code content should not contain the line-numbers class
    expect(contentMatch![1]).not.toContain('ms-line-numbers');
  });

  /**
   * PDF export and preview use the same HTML pipeline (createMarkdownParser),
   * so identical input with the same options must produce identical output.
   */
  it('produces identical HTML across two parser instances (preview/PDF parity)', () => {
    const parser1 = createMarkdownParser({ lineNumbers: true });
    const parser2 = createMarkdownParser({ lineNumbers: true });

    const html1 = parser1.render(markdownWithCode);
    const html2 = parser2.render(markdownWithCode);

    expect(html1).toBe(html2);
  });

  /**
   * Multi-language code blocks all receive line numbers when enabled.
   */
  it('applies line numbers to multiple code blocks in a single document', () => {
    const md = [
      '```javascript',
      'console.log("hello");',
      '```',
      '',
      '```python',
      'print("world")',
      '```',
    ].join('\n');

    const parser = createMarkdownParser({ lineNumbers: true });
    const html = parser.render(md);

    // Both blocks should have table structure
    const tableMatches = html.match(/class="ms-code-table"/g);
    expect(tableMatches).not.toBeNull();
    expect(tableMatches!.length).toBe(2);

    const lineNumberMatches = html.match(/class="ms-line-numbers"/g);
    expect(lineNumberMatches).not.toBeNull();
    expect(lineNumberMatches!.length).toBe(2);
  });
});
