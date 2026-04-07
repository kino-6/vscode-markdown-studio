import { describe, it, expect } from 'vitest';
import { createMarkdownParser } from '../../src/parser/parseMarkdown';

describe('Emoji', () => {
  const md = createMarkdownParser();

  it('renders :smile: as emoji character', () => {
    const html = md.render(':smile:');
    expect(html).toContain('😄');
    expect(html).not.toContain(':smile:');
  });

  it('renders :rocket: as emoji character', () => {
    const html = md.render(':rocket:');
    expect(html).toContain('🚀');
  });

  it('renders multiple emojis in one line', () => {
    const html = md.render(':thumbsup: :heart:');
    expect(html).toContain('👍');
    expect(html).toContain('❤️');
  });

  it('does not convert unknown shortcodes', () => {
    const html = md.render(':notanemoji:');
    expect(html).toContain(':notanemoji:');
  });

  it('renders emoji inside other markdown', () => {
    const html = md.render('**bold :star:**');
    expect(html).toContain('⭐');
    expect(html).toContain('<strong>');
  });
});
