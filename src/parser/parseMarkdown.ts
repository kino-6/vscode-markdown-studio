import MarkdownIt from 'markdown-it';
import { highlightCode } from './highlightCode';

export function createMarkdownParser(): MarkdownIt {
  return new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true,
    highlight: highlightCode
  });
}
