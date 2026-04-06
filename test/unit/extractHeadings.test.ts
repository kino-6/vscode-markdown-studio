import { describe, expect, it } from 'vitest';
import { createMarkdownParser } from '../../src/parser/parseMarkdown';
import { extractHeadings } from '../../src/toc/extractHeadings';

const md = createMarkdownParser();

describe('extractHeadings', () => {
  it('returns empty array for empty document', () => {
    expect(extractHeadings('', md)).toEqual([]);
  });

  it('returns empty array for document with no headings', () => {
    expect(extractHeadings('Just a paragraph.\n\nAnother one.', md)).toEqual([]);
  });

  it('extracts h1 through h6 headings', () => {
    const markdown = [
      '# H1',
      '## H2',
      '### H3',
      '#### H4',
      '##### H5',
      '###### H6',
    ].join('\n');

    const headings = extractHeadings(markdown, md);

    expect(headings).toHaveLength(6);
    expect(headings.map((h) => h.level)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(headings.map((h) => h.text)).toEqual([
      'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
    ]);
  });

  it('preserves source line numbers (0-based)', () => {
    const markdown = '# First\n\nSome text\n\n## Second\n';
    const headings = extractHeadings(markdown, md);

    expect(headings[0]).toMatchObject({ level: 1, text: 'First', line: 0 });
    expect(headings[1]).toMatchObject({ level: 2, text: 'Second', line: 4 });
  });

  it('strips bold formatting from heading text', () => {
    const headings = extractHeadings('# **Bold** heading', md);
    expect(headings[0].text).toBe('Bold heading');
  });

  it('strips italic formatting from heading text', () => {
    const headings = extractHeadings('# *Italic* heading', md);
    expect(headings[0].text).toBe('Italic heading');
  });

  it('strips inline code from heading text', () => {
    const headings = extractHeadings('# Heading with `code`', md);
    expect(headings[0].text).toBe('Heading with code');
  });

  it('strips link formatting from heading text', () => {
    const headings = extractHeadings('# [Link text](http://example.com)', md);
    expect(headings[0].text).toBe('Link text');
  });

  it('strips mixed inline formatting', () => {
    const headings = extractHeadings(
      '# **Bold** and *italic* with `code` and [link](url)',
      md
    );
    expect(headings[0].text).toBe('Bold and italic with code and link');
  });

  it('does not extract headings inside fenced code blocks', () => {
    const markdown = [
      '# Real heading',
      '',
      '```',
      '# Not a heading',
      '```',
      '',
      '## Another real heading',
    ].join('\n');

    const headings = extractHeadings(markdown, md);

    expect(headings).toHaveLength(2);
    expect(headings[0].text).toBe('Real heading');
    expect(headings[1].text).toBe('Another real heading');
  });

  it('does not extract headings inside language-tagged code blocks', () => {
    const markdown = [
      '# Before',
      '',
      '```markdown',
      '# Inside code',
      '## Also inside',
      '```',
      '',
      '# After',
    ].join('\n');

    const headings = extractHeadings(markdown, md);

    expect(headings).toHaveLength(2);
    expect(headings.map((h) => h.text)).toEqual(['Before', 'After']);
  });

  it('handles multiple headings at same level', () => {
    const markdown = '## A\n## B\n## C\n';
    const headings = extractHeadings(markdown, md);

    expect(headings).toHaveLength(3);
    expect(headings.map((h) => h.text)).toEqual(['A', 'B', 'C']);
    expect(headings.every((h) => h.level === 2)).toBe(true);
  });
});
