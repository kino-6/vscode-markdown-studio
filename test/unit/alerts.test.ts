import { describe, expect, it } from 'vitest';
import { createMarkdownParser } from '../../src/parser/parseMarkdown';

const render = (md: string) => createMarkdownParser().render(md);

describe('GitHub-style alerts', () => {
  it.each(['NOTE', 'TIP', 'IMPORTANT', 'WARNING', 'CAUTION'])('renders [!%s]', (kind) => {
    const html = render(`> [!${kind}]\n> Body **text**.\n`);
    const lower = kind.toLowerCase();
    expect(html).toContain(`<div class="markdown-alert markdown-alert-${lower}" data-source-line="0">`);
    expect(html).toMatch(/<p class="markdown-alert-title">\w+<\/p>/);
    expect(html).toContain('Body <strong>text</strong>.');
    expect(html).not.toContain(`[!${kind}]`);
    expect(html).not.toContain('<blockquote');
  });

  it('is case-insensitive and keeps later paragraphs', () => {
    const html = render('> [!note]\n> first\n>\n> second\n');
    expect(html).toContain('markdown-alert-note');
    expect(html).toContain('<p data-source-line="0">first</p>');
    expect(html).toContain('second</p>');
  });

  it('drops the empty paragraph when the marker stands alone', () => {
    const html = render('> [!TIP]\n>\n> body\n');
    expect(html).not.toMatch(/<p[^>]*>\s*<\/p>/);
    expect(html).toContain('body</p>');
  });

  it('leaves normal blockquotes and unknown markers alone', () => {
    expect(render('> quote\n')).toContain('<blockquote');
    expect(render('> [!FOO]\n> x\n')).toContain('<blockquote');
    expect(render('> text [!NOTE]\n')).toContain('<blockquote');
  });

  it('closes the right element when alerts contain nested quotes', () => {
    const html = render('> [!WARNING]\n> outer\n> > inner\n');
    expect(html).toMatch(/<div class="markdown-alert[\s\S]*<blockquote[\s\S]*<\/blockquote>\s*<\/div>/);
  });
});
