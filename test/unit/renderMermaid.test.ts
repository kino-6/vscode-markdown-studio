import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('mermaid', () => {
  const parseMock = vi.fn();
  return {
    default: {
      parse: parseMock
    },
    __parseMock: parseMock
  };
});

import mermaidModule from 'mermaid';
import { decodeMermaidAttribute, renderMermaidBlock, renderMermaidPlaceholder } from '../../src/renderers/renderMermaid';

const parseMock = (mermaidModule as any).__parseMock ?? mermaidModule.parse;

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

  it('returns placeholder when DOM ReferenceError occurs (Node.js environment)', async () => {
    const domError = new ReferenceError('document is not defined');
    parseMock.mockRejectedValue(domError);
    const source = 'graph TD;A-->B;';

    const result = await renderMermaidBlock(source);

    expect(result.ok).toBe(true);
    expect(result.placeholder).toBe(renderMermaidPlaceholder(source));
    expect(result.error).toBeUndefined();
  });

  it('returns placeholder when window-related DOM error occurs', async () => {
    const domError = new Error('window is not defined');
    parseMock.mockRejectedValue(domError);
    const source = 'sequenceDiagram\nA->>B: Hello';

    const result = await renderMermaidBlock(source);

    expect(result.ok).toBe(true);
    expect(result.placeholder).toBe(renderMermaidPlaceholder(source));
  });

  it('still returns syntax error for non-DOM errors', async () => {
    parseMock.mockRejectedValue(new Error('Parse error on line 1'));

    const result = await renderMermaidBlock('invalid diagram');

    expect(result.ok).toBe(false);
    expect(result.error).toContain('Mermaid syntax error');
    expect(result.error).toContain('Parse error on line 1');
  });

  it('gracefully handles malformed encoded attribute', () => {
    expect(decodeMermaidAttribute('%E0%A4%A')).toBe('%E0%A4%A');
  });
});
