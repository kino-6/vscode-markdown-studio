import { describe, it, expect } from 'vitest';
import { createMarkdownParser } from '../../src/parser/parseMarkdown';

describe('Superscript and subscript', () => {
  const md = createMarkdownParser();

  it('renders ^text^ as superscript', () => {
    const html = md.render('19^th^ century');
    expect(html).toContain('<sup>th</sup>');
  });

  it('renders ~text~ as subscript', () => {
    const html = md.render('H~2~O');
    expect(html).toContain('<sub>2</sub>');
  });

  it('renders both in same line', () => {
    const html = md.render('x^2^ + H~2~O');
    expect(html).toContain('<sup>2</sup>');
    expect(html).toContain('<sub>2</sub>');
  });

  it('does not affect regular text', () => {
    const html = md.render('normal text here');
    expect(html).not.toContain('<sup>');
    expect(html).not.toContain('<sub>');
  });
});
