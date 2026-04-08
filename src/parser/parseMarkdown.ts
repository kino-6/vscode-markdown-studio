import MarkdownIt from 'markdown-it';
import taskLists from 'markdown-it-task-lists';
import footnote from 'markdown-it-footnote';
import { full as emoji } from 'markdown-it-emoji';
import katex from '@vscode/markdown-it-katex';
import deflist from 'markdown-it-deflist';
import sup from 'markdown-it-sup';
import sub from 'markdown-it-sub';
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
  md.use(sup);
  md.use(sub);
  addSourceLineAttributes(md);

  const originalFence = md.renderer.rules.fence!;
  md.renderer.rules.fence = (tokens, idx, opts, env, self) => {
    const token = tokens[idx];

    // markdown-it always appends a trailing \n to token.content.
    // The browser renders this as an extra blank line inside <code>.
    // Strip trailing newlines from the content BEFORE rendering so
    // highlight and line-number logic both see the clean version.
    const originalContent = token.content;
    token.content = token.content.replace(/\n+$/, '');
    const code = token.content;

    let rendered = originalFence(tokens, idx, opts, env, self);

    // Restore original content so we don't mutate the token permanently
    token.content = originalContent;

    // Also strip any trailing \n that the fence renderer itself may add
    // before the closing </code></pre> tags.
    rendered = rendered.replace(/\n+<\/code><\/pre>/, '</code></pre>');

    if (options?.lineNumbers) {
      const lineCount = countLines(code);
      if (lineCount > 0) {
        return wrapWithLineNumbers(rendered, lineCount);
      }
    }

    return rendered;
  };

  return md;
}
