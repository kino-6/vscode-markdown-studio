import { describe, expect, it } from 'vitest';
import {
  decodeWaveDromAttribute,
  renderWaveDromBlock,
  renderWaveDromPlaceholder,
} from '../../src/renderers/renderWaveDrom';

describe('renderWaveDromBlock', () => {
  it('always returns a placeholder (rendering is deferred to webview)', async () => {
    const source = '{ signal: [{ name: "clk", wave: "p......" }] }';
    const result = await renderWaveDromBlock(source);

    expect(result.ok).toBe(true);
    expect(result.placeholder).toBe(renderWaveDromPlaceholder(source));
  });

  it('encodes source in data attribute', () => {
    const source = '{ signal: [{ name: "bus", wave: "x.3.x", data: "read" }] }';
    const placeholder = renderWaveDromPlaceholder(source);

    expect(placeholder).toContain('class="wavedrom-host"');
    expect(placeholder).toContain('data-wavedrom-src=');
    expect(placeholder).toContain(encodeURIComponent(source));
  });

  it('gracefully handles malformed encoded attribute', () => {
    expect(decodeWaveDromAttribute('%E0%A4%A')).toBe('%E0%A4%A');
  });
});
