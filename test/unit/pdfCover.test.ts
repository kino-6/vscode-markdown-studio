import { describe, expect, it } from 'vitest';
import { resolveCoverMarkdownPath } from '../../src/export/pdfCover';

describe('PDF cover path resolution', () => {
  it('returns undefined when cover export is disabled', () => {
    expect(resolveCoverMarkdownPath('/work/docs/spec.md', {
      enabled: false,
      path: 'cover.md',
    })).toBeUndefined();
  });

  it('resolves relative cover paths from the source Markdown directory', () => {
    expect(resolveCoverMarkdownPath('/work/docs/spec.md', {
      enabled: true,
      path: 'cover.md',
    })).toBe('/work/docs/cover.md');
  });

  it('rejects the source Markdown file as its own cover', () => {
    expect(() => resolveCoverMarkdownPath('/work/docs/spec.md', {
      enabled: true,
      path: './spec.md',
    })).toThrow(/cannot use the source Markdown file/i);
  });
});
