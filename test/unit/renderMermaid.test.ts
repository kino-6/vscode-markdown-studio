import { describe, expect, it } from 'vitest';
import { decodeMermaidAttribute, renderMermaidBlock, renderMermaidPlaceholder } from '../../src/renderers/renderMermaid';

describe('renderMermaidBlock', () => {
  it('always returns a placeholder (syntax check is deferred to webview)', async () => {
    const source = 'graph TD;A-->B;';
    const result = await renderMermaidBlock(source);

    expect(result.ok).toBe(true);
    expect(result.placeholder).toBe(renderMermaidPlaceholder(source));
  });

  it('returns placeholder even for invalid syntax (webview handles errors)', async () => {
    const result = await renderMermaidBlock('graph ???');

    expect(result.ok).toBe(true);
    expect(result.placeholder).toBeDefined();
  });

  it('encodes source in data attribute', () => {
    const source = 'graph TD;A-->B;';
    const placeholder = renderMermaidPlaceholder(source);

    expect(placeholder).toContain('data-mermaid-src=');
    expect(placeholder).toContain(encodeURIComponent(source));
  });

  it('gracefully handles malformed encoded attribute', () => {
    expect(decodeMermaidAttribute('%E0%A4%A')).toBe('%E0%A4%A');
  });
});
