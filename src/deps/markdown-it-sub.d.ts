declare module 'markdown-it-sub' {
  import MarkdownIt from 'markdown-it';
  function sub(md: MarkdownIt): void;
  export = sub;
}
