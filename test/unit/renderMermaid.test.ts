import { beforeEach, describe, expect, it, vi } from 'vitest';

const parseMock = vi.fn();

vi.mock('mermaid', () => ({
  default: {
    parse: parseMock
  }
}));

import { decodeMermaidAttribute, renderMermaidBlock, renderMermaidPlaceholder } from '../../src/renderers/renderMermaid';

describe('renderMermaidBlock', () => {
  beforeEach(() => {
    parseMock.mockReset();
  });

  it('returns placeholder on successful syntax parse', async () => {
    parseMock.mockResolvedValue(true);
    const source = 'graph TD;A-->B;';

    const result = await renderMermaidBlock(source);

    expect(result.ok).toBe(true);
    expect(result.placeholder).toBe(renderMermaidPlaceholder(source));
  });

  it('returns readable syntax error when parsing fails', async () => {
    parseMock.mockRejectedValue(new Error('Unexpected token'));

    const result = await renderMermaidBlock('graph ???');

    expect(result.ok).toBe(false);
    expect(result.error).toContain('Mermaid syntax error');
    expect(result.error).toContain('Unexpected token');
  });

  it('gracefully handles malformed encoded attribute', () => {
    expect(decodeMermaidAttribute('%E0%A4%A')).toBe('%E0%A4%A');
  });
});
