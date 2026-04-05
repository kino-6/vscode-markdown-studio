import { describe, expect, it, vi } from 'vitest';

// Mock config to avoid vscode dependency issues
vi.mock('../../src/infra/config', () => ({
  getConfig: () => ({
    plantUmlMode: 'bundled-jar',
    javaPath: 'java',
    pageFormat: 'A4',
    blockExternalLinks: false,
    style: {
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
      fontSize: 14,
      lineHeight: 1.6,
      margin: '20mm',
      codeFontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
      headingStyle: { h1FontWeight: 600, h1MarginTop: '24px', h1MarginBottom: '16px', h2MarginTop: '24px', h2MarginBottom: '16px' },
      codeBlockStyle: { background: '#f6f8fa', border: '1px solid #d0d7de', borderRadius: '6px', padding: '1em' },
      presetName: 'markdown-pdf',
    },
  })
}));

// Mock renderPlantUml and renderMermaid since they have heavy dependencies
vi.mock('../../src/renderers/renderPlantUml', () => ({
  renderPlantUml: vi.fn()
}));

vi.mock('../../src/renderers/renderMermaid', () => ({
  renderMermaidBlock: vi.fn()
}));

import { renderMarkdownDocument } from '../../src/renderers/renderMarkdown';

describe('sanitizeHtmlOutput preserves hljs class attributes', () => {
  const fakeContext = { extensionPath: '/tmp/ext' } as any;

  /**
   * Validates: Requirements 5.1, 5.2
   *
   * The sanitize-html config in renderMarkdown.ts allows `class` on `span`
   * elements (via both `'*': ['class', ...]` and `span: ['class', ...]`).
   * This test locks in that hljs-* class spans survive the sanitizer when
   * a typescript code block goes through the full render pipeline.
   */
  it('preserves <span class="hljs-*"> elements after sanitization', async () => {
    const markdown = '```typescript\nconst x: number = 1;\n```';

    const result = await renderMarkdownDocument(markdown, fakeContext);

    // hljs class spans must survive the sanitizer
    expect(result.htmlBody).toContain('<span class="hljs-');
    expect(result.htmlBody).toContain('<pre>');
    expect(result.htmlBody).toContain('<code');
  });

  it('preserves multiple hljs class spans for complex code', async () => {
    const markdown = [
      '```typescript',
      'function greet(name: string): string {',
      '  return `Hello, ${name}!`;',
      '}',
      '```'
    ].join('\n');

    const result = await renderMarkdownDocument(markdown, fakeContext);

    // Multiple hljs spans should survive sanitization
    const hljsSpanCount = (result.htmlBody.match(/<span class="hljs-/g) || []).length;
    expect(hljsSpanCount).toBeGreaterThan(1);

    // Verify no inline style attributes were introduced (class-based only)
    const spanStyleMatches = result.htmlBody.match(/<span[^>]*style=/g);
    expect(spanStyleMatches).toBeNull();
  });
});
