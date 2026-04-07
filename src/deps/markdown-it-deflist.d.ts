declare module 'markdown-it-deflist' {
  import MarkdownIt from 'markdown-it';
  function deflist(md: MarkdownIt): void;
  export = deflist;
}
