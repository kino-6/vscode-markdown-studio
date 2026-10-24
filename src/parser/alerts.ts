import type MarkdownIt from 'markdown-it';

const ALERT_TITLES: Record<string, string> = {
  note: 'Note',
  tip: 'Tip',
  important: 'Important',
  warning: 'Warning',
  caution: 'Caution',
};

const MARKER_RE = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][ \t]*(?:\n|$)/i;

/**
 * GitHub-style alerts:
 *
 *   > [!NOTE]
 *   > Useful information.
 *
 * The blockquote becomes `<div class="markdown-alert markdown-alert-note">`
 * with a title line, matching the class names GitHub uses so custom CSS
 * written for GitHub also applies.
 */
export function alertsPlugin(md: MarkdownIt): void {
  // Runs before inline parsing so the marker can be removed from the raw text.
  md.core.ruler.after('block', 'github_alerts', (state) => {
    const tokens = state.tokens;
    for (let i = 0; i < tokens.length; i++) {
      const open = tokens[i];
      if (open.type !== 'blockquote_open') continue;
      const paragraph = tokens[i + 1];
      const inline = tokens[i + 2];
      if (paragraph?.type !== 'paragraph_open' || inline?.type !== 'inline') continue;

      const match = inline.content.match(MARKER_RE);
      if (!match) continue;

      const kind = match[1].toLowerCase();
      inline.content = inline.content.slice(match[0].length);

      const closeIndex = findClose(tokens, i);
      if (closeIndex === -1) continue;

      open.tag = 'div';
      open.attrJoin('class', `markdown-alert markdown-alert-${kind}`);
      open.meta = { ...(open.meta ?? {}), alertKind: kind };
      tokens[closeIndex].tag = 'div';

      const title = new state.Token('alert_title', '', 0);
      title.block = true;
      title.meta = { alertKind: kind };
      tokens.splice(i + 1, 0, title);

      // Marker on its own paragraph: drop the now-empty paragraph.
      if (inline.content.trim() === '') {
        const pOpen = tokens[i + 2];
        const pClose = tokens[i + 4];
        if (pOpen?.type === 'paragraph_open' && pClose?.type === 'paragraph_close') {
          tokens.splice(i + 2, 3);
        }
      }
    }
  });

  md.renderer.rules['alert_title'] = (tokens, idx) => {
    const kind = tokens[idx].meta?.alertKind as string;
    return `<p class="markdown-alert-title">${ALERT_TITLES[kind] ?? kind}</p>\n`;
  };
}

function findClose(tokens: Array<{ type: string }>, openIndex: number): number {
  let depth = 0;
  for (let j = openIndex; j < tokens.length; j++) {
    if (tokens[j].type === 'blockquote_open') depth++;
    if (tokens[j].type === 'blockquote_close') {
      depth--;
      if (depth === 0) return j;
    }
  }
  return -1;
}
