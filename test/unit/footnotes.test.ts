import { describe, it, expect } from 'vitest';
import { createMarkdownParser } from '../../src/parser/parseMarkdown';

describe('Footnotes', () => {
  const md = createMarkdownParser();

  it('renders footnote reference as superscript link', () => {
    const html = md.render('Text with footnote[^1].\n\n[^1]: Footnote content.');
    expect(html).toContain('footnote-ref');
    expect(html).toContain('Footnote content');
  });

  it('renders footnote section at the bottom', () => {
    const html = md.render('Text[^1].\n\n[^1]: Bottom note.');
    expect(html).toContain('class="footnotes"');
    expect(html).toContain('Bottom note');
  });

  it('renders multiple footnotes', () => {
    const html = md.render('A[^1] and B[^2].\n\n[^1]: First.\n[^2]: Second.');
    expect(html).toContain('First');
    expect(html).toContain('Second');
  });

  it('renders inline footnote content with markdown', () => {
    const html = md.render('Text[^1].\n\n[^1]: Note with **bold**.');
    expect(html).toContain('<strong>bold</strong>');
  });

  it('does not render footnote syntax without definition', () => {
    const html = md.render('Text without definition[^99].');
    // Should render the raw text, not a footnote link
    expect(html).toContain('[^99]');
  });
});
