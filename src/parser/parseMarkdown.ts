import MarkdownIt from 'markdown-it';

export function createMarkdownParser(): MarkdownIt {
  return new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true
  });
}
