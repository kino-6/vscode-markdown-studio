import { describe, expect, it } from 'vitest';
import { sanitizeSvg } from '../../src/parser/sanitizeSvg';

describe('sanitizeSvg security behavior', () => {
  it('strips script and foreignObject', () => {
    const dirty = '<svg><script>alert(1)</script><foreignObject><div>x</div></foreignObject><rect /></svg>';
    const clean = sanitizeSvg(dirty);

    expect(clean).not.toContain('script');
    expect(clean).not.toContain('foreignobject');
    expect(clean).toContain('<rect');
  });

  it('strips iframe/object/embed', () => {
    const dirty = '<svg><iframe src="x"></iframe><object data="x"></object><embed src="x"/></svg>';
    const clean = sanitizeSvg(dirty);

    expect(clean).not.toContain('iframe');
    expect(clean).not.toContain('object');
    expect(clean).not.toContain('embed');
  });

  it('strips event handlers and javascript URIs', () => {
    const dirty = '<svg><a href="javascript:alert(1)" onclick="hack()">x</a><rect onload="hack()" /></svg>';
    const clean = sanitizeSvg(dirty);

    expect(clean).not.toContain('onclick=');
    expect(clean).not.toContain('onload=');
    expect(clean).not.toContain('javascript:');
  });

  it('strips unsafe external refs while allowing data refs', () => {
    const dirty = '<svg><use href="https://evil.test/icon.svg#id"></use><image href="data:image/svg+xml;base64,AAA="/></svg>';
    const clean = sanitizeSvg(dirty);

    expect(clean).not.toContain('https://evil.test');
    expect(clean).toContain('data:image/svg+xml;base64,AAA=');
  });
});
