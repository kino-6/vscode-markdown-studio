import MarkdownIt from 'markdown-it';
import { highlightCode } from './highlightCode';
import { wrapWithLineNumbers, countLines } from './lineNumbers';

export function addSourceLineAttributes(md: MarkdownIt): void {
  const blockTokenTypes = [
    'paragraph_open', 'heading_open', 'blockquote_open',
    'list_item_open', 'bullet_list_open', 'ordered_list_open',
    'table_open', 'thead_open', 'tbody_open', 'tr_open',
    'hr', 'code_block', 'fence', 'html_block'
  ];

  for (const ruleName of blockTokenTypes) {
    const original = md.renderer.rules[ruleName];

    md.renderer.rules[ruleName] = (tokens, idx, options, env, self) => {
      const token = tokens[idx];
      if (token.map && token.map.length >= 2) {
        token.attrSet('data-source-line', String(token.map[0]));
      }
      if (original) {
        return original(tokens, idx, options, env, self);
      }
      return self.renderToken(tokens, idx, options);
    };
  }
}

export function createMarkdownParser(options?: { lineNumbers?: boolean }): MarkdownIt {
  const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true,
    highlight: (code: string, lang: string) => highlightCode(code, lang)
  });
  addSourceLineAttributes(md);

  if (options?.lineNumbers) {
    const originalFence = md.renderer.rules.fence!;
    md.renderer.rules.fence = (tokens, idx, opts, env, self) => {
      const token = tokens[idx];
      const code = token.content;
      const lineCount = countLines(code);
      const rendered = originalFence(tokens, idx, opts, env, self);
      if (lineCount > 0) {
        return wrapWithLineNumbers(rendered, lineCount);
      }
      return rendered;
    };
  }

  return md;
}
