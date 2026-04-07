declare module 'markdown-it-footnote' {
  import MarkdownIt from 'markdown-it';
  function footnote(md: MarkdownIt): void;
  export = footnote;
}
