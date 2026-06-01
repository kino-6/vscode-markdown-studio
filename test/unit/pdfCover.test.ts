import { describe, expect, it } from 'vitest';
import { resolveCoverMarkdownPath, splitEmbeddedCoverMarkdown } from '../../src/export/pdfCover';

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

describe('embedded PDF cover block parsing', () => {
  it('extracts a cover block from the same Markdown file and removes it from the body', () => {
    const markdown = [
      '<!-- markdown-studio:cover -->',
      '# Proposal Cover',
      '',
      '<svg viewBox="0 0 120 24"><text x="0" y="18">Enterprise</text></svg>',
      '<!-- /markdown-studio:cover -->',
      '',
      '# Body',
      '',
      'Main content.',
    ].join('\n');

    expect(splitEmbeddedCoverMarkdown(markdown)).toEqual({
      coverMarkdown: [
        '# Proposal Cover',
        '',
        '<svg viewBox="0 0 120 24"><text x="0" y="18">Enterprise</text></svg>',
      ].join('\n'),
      bodyMarkdown: '# Body\n\nMain content.',
    });
  });

  it('ignores cover markers inside fenced code blocks', () => {
    const markdown = [
      '# Body',
      '',
      '```md',
      '<!-- markdown-studio:cover -->',
      '# Not a cover',
      '<!-- /markdown-studio:cover -->',
      '```',
    ].join('\n');

    expect(splitEmbeddedCoverMarkdown(markdown)).toEqual({
      bodyMarkdown: markdown,
    });
  });

  it('leaves the document unchanged when the embedded cover end marker is missing', () => {
    const markdown = [
      '<!-- markdown-studio:cover -->',
      '# Draft Cover',
      '',
      '# Body',
    ].join('\n');

    expect(splitEmbeddedCoverMarkdown(markdown)).toEqual({
      bodyMarkdown: markdown,
    });
  });
});
