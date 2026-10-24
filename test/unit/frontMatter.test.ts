import { describe, expect, it } from 'vitest';
import { createMarkdownParser } from '../../src/parser/parseMarkdown';
import { extractHeadings } from '../../src/toc/extractHeadings';

const SKILL = `---
name: skill-name
description: Use when "foo" <bar>: baz.
---

# Title

body
`;

describe('YAML front matter', () => {
  it('renders front matter as a metadata block instead of hr + h2', () => {
    const html = createMarkdownParser().render(SKILL);
    expect(html).not.toContain('<hr');
    expect(html).not.toContain('<h2');
    expect(html).toContain('<div class="ms-frontmatter" data-source-line="0">');
    expect(html).toContain('language-yaml');
    expect(html).toContain('&lt;bar&gt;');
    expect(html).toMatch(/<h1[^>]*data-source-line="5"[^>]*>Title<\/h1>/);
  });

  it('keeps front matter out of the heading list', () => {
    const md = createMarkdownParser();
    const headings = extractHeadings(SKILL, md);
    expect(headings.map((h) => h.text)).toEqual(['Title']);
  });

  it('accepts "..." as the closing marker', () => {
    const html = createMarkdownParser().render('---\na: 1\n...\n\ntext\n');
    expect(html).toContain('ms-frontmatter');
  });

  it('leaves a leading hr alone when there is no closing marker', () => {
    const html = createMarkdownParser().render('---\n\nparagraph\n');
    expect(html).toContain('<hr');
    expect(html).not.toContain('ms-frontmatter');
  });

  it('treats --- followed by a blank line as hr, not front matter', () => {
    const html = createMarkdownParser().render('---\n\n---');
    expect(html).not.toContain('ms-frontmatter');
  });

  it('only treats the first line of the document as front matter', () => {
    const html = createMarkdownParser().render('intro\n\n---\na: 1\n---\n');
    expect(html).not.toContain('ms-frontmatter');
  });

  it('does not treat a blockquote at the start as front matter', () => {
    const html = createMarkdownParser().render('> ---\n> a: 1\n> ---\n');
    expect(html).not.toContain('ms-frontmatter');
  });
});

import { extractFrontMatterTitle } from '../../src/parser/frontMatter';

describe('extractFrontMatterTitle', () => {
  it.each([
    ['---\ntitle: My Doc\n---\n# H1\n', 'My Doc'],
    ['---\nname: x\ntitle: "Quoted: yes"\n---\n', 'Quoted: yes'],
    ["---\ntitle: 'It''s'\n---\n", "It's"],
    ['---\r\ntitle: CRLF\r\n---\r\n', 'CRLF'],
    ['---\ntitle: With comment # note\n---\n', 'With comment'],
    ['﻿---\ntitle: BOM\n---\n', 'BOM'],
  ])('reads %j', (md, expected) => {
    expect(extractFrontMatterTitle(md)).toBe(expected);
  });

  it.each([
    ['# Just a heading\n'],
    ['---\nname: skill\n---\n'],
    ['---\ntitle:\n---\n'],
    ['---\ntitle: >\n  folded\n---\n'],
    ['intro\n---\ntitle: late\n---\n'],
    ['---\n\ntitle: not front matter\n---\n'],
    ['---\nnested:\n  title: inner\n---\n'],
  ])('returns undefined for %j', (md) => {
    expect(extractFrontMatterTitle(md)).toBeUndefined();
  });
});
