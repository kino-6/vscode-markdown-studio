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
   * Validates: Requirements 5.1, 5.2
   * When line numbers are enabled, code blocks must contain ms-line-number elements.
   */
  it('includes ms-line-number class when lineNumbers is enabled', () => {
    const parser = createMarkdownParser({ lineNumbers: true });
    const html = parser.render(markdownWithCode);

    expect(html).toContain('class="ms-line-number"');
    expect(html).toContain('class="ms-code-line"');
    expect(html).toContain('class="ms-line-number">1</span>');
    expect(html).toContain('class="ms-line-number">2</span>');
  });

  /**
   * Validates: Requirement 1.4
   * When line numbers are disabled, code blocks must NOT contain ms-line-number elements
   * and the output must be unchanged from the default rendering.
   */
  it('does not include ms-line-number class when lineNumbers is disabled', () => {
    const parser = createMarkdownParser({ lineNumbers: false });
    const html = parser.render(markdownWithCode);

    expect(html).not.toContain('ms-line-number');
    expect(html).not.toContain('ms-code-line');
  });

  it('does not include ms-line-number class when lineNumbers option is omitted', () => {
    const parser = createMarkdownParser();
    const html = parser.render(markdownWithCode);

    expect(html).not.toContain('ms-line-number');
    expect(html).not.toContain('ms-code-line');
  });

  /**
   * Validates: Requirement 5.2
   * PDF export and preview use the same HTML pipeline (createMarkdownParser),
   * so identical input with the same options must produce identical output.
   */
  it('produces identical line-number HTML across two parser instances (preview/PDF parity)', () => {
    const parser1 = createMarkdownParser({ lineNumbers: true });
    const parser2 = createMarkdownParser({ lineNumbers: true });

    const html1 = parser1.render(markdownWithCode);
    const html2 = parser2.render(markdownWithCode);

    expect(html1).toBe(html2);
  });

  /**
   * Validates: Requirements 4.1, 5.1
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

    // Both blocks should have line numbers
    const lineNumberMatches = html.match(/class="ms-line-number"/g);
    expect(lineNumberMatches).not.toBeNull();
    expect(lineNumberMatches!.length).toBe(2); // one line per block
  });
});
