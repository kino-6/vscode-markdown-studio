import { describe, it, expect } from 'vitest';
import { createMarkdownParser } from '../../src/parser/parseMarkdown';

describe('Definition lists', () => {
  const md = createMarkdownParser();

  it('renders definition list with dt and dd', () => {
    const html = md.render('Term\n:   Definition here.');
    expect(html).toContain('<dt>');
    expect(html).toContain('<dd>');
    expect(html).toContain('Term');
    expect(html).toContain('Definition here');
  });

  it('renders multiple definitions for one term', () => {
    const html = md.render('Term\n:   First definition.\n:   Second definition.');
    expect(html).toContain('<dt>');
    const dds = html.match(/<dd>/g);
    expect(dds).toHaveLength(2);
  });

  it('renders multiple terms', () => {
    const html = md.render('Term1\n:   Def1\n\nTerm2\n:   Def2');
    const dts = html.match(/<dt>/g);
    expect(dts).toHaveLength(2);
  });

  it('does not affect regular paragraphs', () => {
    const html = md.render('Just a paragraph.');
    expect(html).not.toContain('<dt>');
    expect(html).not.toContain('<dd>');
  });
});
