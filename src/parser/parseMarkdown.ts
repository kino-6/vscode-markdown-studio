import MarkdownIt from 'markdown-it';
import taskLists from 'markdown-it-task-lists';
import footnote from 'markdown-it-footnote';
import { full as emoji } from 'markdown-it-emoji';
import katex from '@vscode/markdown-it-katex';
import deflist from 'markdown-it-deflist';
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
  md.use(taskLists, { label: true, labelAfter: true });
  md.use(footnote);
  md.use(emoji);
  md.use(katex, { throwOnError: false });
  md.use(deflist);
  addSourceLineAttributes(md);

  if (options?.lineNumbers) {
    const originalFence = md.renderer.rules.fence!;
    md.renderer.rules.fence = (tokens, idx, opts, env, self) => {
      const token = tokens[idx];
      const code = token.content;
      // markdown-it appends a trailing \n to token.content which the browser
      // renders as an extra blank line inside <code>.  When the content ends
      // with \n, subtract 1 so the line-number column matches the visible
      // code lines exactly.  For single-line blocks (countLines == 1) keep 1.
      let lineCount = countLines(code);
      if (lineCount > 1 && code.endsWith('\n')) {
        lineCount--;
      }
      const rendered = originalFence(tokens, idx, opts, env, self);
      if (lineCount > 0) {
        return wrapWithLineNumbers(rendered, lineCount);
      }
      return rendered;
    };
  }

  return md;
}
