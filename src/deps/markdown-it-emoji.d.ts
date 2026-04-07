declare module 'markdown-it-emoji' {
  import MarkdownIt from 'markdown-it';
  export const full: MarkdownIt.PluginSimple;
  export const light: MarkdownIt.PluginSimple;
  export const bare: MarkdownIt.PluginSimple;
}
