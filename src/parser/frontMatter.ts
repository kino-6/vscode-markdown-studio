import type MarkdownIt from 'markdown-it';
import yaml from 'js-yaml';
import { highlightCode } from './highlightCode';

const OPEN_RE = /^---[ \t]*$/;
const CLOSE_RE = /^(?:---|\.\.\.)[ \t]*$/;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function loadYamlMapping(source: string): Record<string, unknown> | undefined {
  try {
    const data = yaml.load(source, { schema: yaml.JSON_SCHEMA });
    return data && typeof data === 'object' && !Array.isArray(data) ? data as Record<string, unknown> : undefined;
  } catch {
    return undefined;
  }
}

function formatValue(value: unknown): string {
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

/**
 * Card for skill / agent definitions (front matter with `name` and
 * `description`, e.g. SKILL.md): the name as a title, the description as text,
 * and the remaining fields as a compact list.
 */
function renderSkillCard(data: Record<string, unknown>): string {
  const parts = [
    `<div class="ms-skill-name">${escapeHtml(String(data.name))}</div>`,
    `<p class="ms-skill-description">${escapeHtml(String(data.description))}</p>`,
  ];

  const rows: string[] = [];
  for (const [key, value] of Object.entries(data)) {
    if (key === 'name' || key === 'description' || value === undefined || value === null) continue;
    let rendered: string;
    if (key === 'allowed-tools' && typeof value === 'string') {
      rendered = value.split(/\s+/).filter(Boolean)
        .map((tool) => `<code class="ms-skill-tool">${escapeHtml(tool)}</code>`).join(' ');
    } else if (typeof value === 'object' && !Array.isArray(value)) {
      rendered = Object.entries(value as Record<string, unknown>)
        .map(([k, v]) => `${escapeHtml(k)}: ${escapeHtml(formatValue(v))}`).join('<br>');
    } else {
      rendered = escapeHtml(Array.isArray(value) ? value.map(formatValue).join(', ') : formatValue(value));
    }
    rows.push(`<dt>${escapeHtml(key)}</dt><dd>${rendered}</dd>`);
  }
  if (rows.length > 0) parts.push(`<dl class="ms-skill-fields">${rows.join('')}</dl>`);
  return parts.join('');
}

/**
 * Recognises a YAML front matter block (`---` ... `---` or `...`) at the very
 * start of the document, as used by SKILL.md, Jekyll, Hugo, etc.
 *
 * Without this rule markdown-it renders the opening `---` as <hr> and the
 * YAML lines plus the closing `---` as a setext <h2>, which also leaks a bogus
 * heading into the TOC and PDF bookmarks.
 *
 * The block is rendered as a YAML code box in the preview and hidden in print
 * (PDF) via CSS.
 */
export function frontMatterPlugin(md: MarkdownIt): void {
  md.block.ruler.before('table', 'front_matter', (state, startLine, endLine, silent) => {
    if (startLine !== 0 || state.level !== 0 || state.parentType !== 'root') return false;
    if (state.sCount[startLine] !== 0) return false;

    const lineText = (line: number) => state.src.slice(state.bMarks[line], state.eMarks[line]);
    if (!OPEN_RE.test(lineText(startLine))) return false;
    // `---` followed by a blank line is a thematic break, not front matter.
    if (startLine + 1 >= endLine || lineText(startLine + 1).trim() === '') return false;

    let closeLine = -1;
    for (let line = startLine + 1; line < endLine; line++) {
      if (state.sCount[line] === 0 && CLOSE_RE.test(lineText(line))) {
        closeLine = line;
        break;
      }
    }
    if (closeLine === -1) return false;
    if (silent) return true;

    const token = state.push('front_matter', '', 0);
    token.block = true;
    token.map = [startLine, closeLine + 1];
    token.markup = '---';
    token.content = state.getLines(startLine + 1, closeLine, 0, true);

    state.line = closeLine + 1;
    return true;
  });

  md.renderer.rules['front_matter'] = (tokens, idx) => {
    const token = tokens[idx];
    const source = token.content.replace(/\n+$/, '');
    const highlighted = highlightCode(source, 'yaml') || escapeHtml(source);
    const line = token.map ? ` data-source-line="${token.map[0]}"` : '';
    const yamlBlock = `<pre><code class="hljs language-yaml">${highlighted}</code></pre>`;

    const data = loadYamlMapping(source);
    if (data && typeof data.name === 'string' && typeof data.description === 'string') {
      return `<div class="ms-frontmatter ms-skill-card"${line}>${renderSkillCard(data)}`
        + `<details class="ms-frontmatter-raw"><summary>Front matter</summary>${yamlBlock}</details></div>\n`;
    }
    return `<div class="ms-frontmatter"${line}>${yamlBlock}</div>\n`;
  };
}

const FRONT_MATTER_BLOCK_RE = /^---[ \t]*\r?\n(?![ \t]*\r?\n)([\s\S]*?)\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/;
const TITLE_LINE_RE = /^title:[ \t]*(.*?)[ \t]*$/m;

/**
 * Returns the top-level `title:` value from YAML front matter, if any.
 * Only plain or quoted single-line scalars are supported.
 */
export function extractFrontMatterTitle(markdown: string): string | undefined {
  const block = FRONT_MATTER_BLOCK_RE.exec(markdown.replace(/^﻿/, ''));
  if (!block) return undefined;
  const line = TITLE_LINE_RE.exec(block[1]);
  if (!line) return undefined;

  let value = line[1];
  const quoted = /^(["'])(.*)\1$/.exec(value);
  if (quoted) {
    value = quoted[1] === "'" ? quoted[2].replace(/''/g, "'") : quoted[2].replace(/\\"/g, '"');
  } else {
    value = value.replace(/[ \t]+#.*$/, '');
  }
  value = value.trim();
  return value === '' || value === '|' || value === '>' ? undefined : value;
}

export interface FrontMatterLocation {
  /** YAML text between the markers. */
  content: string;
  /** 0-based line of the first YAML line (the line after the opening `---`). */
  contentStartLine: number;
  /** 0-based line of the closing `---` / `...`. */
  closeLine: number;
}

/** Finds the front matter block using the same rules as the preview. */
export function locateFrontMatter(markdown: string): FrontMatterLocation | undefined {
  const lines = markdown.replace(/^\uFEFF/, '').split(/\r?\n/);
  if (!/^---[ \t]*$/.test(lines[0] ?? '')) return undefined;
  if (lines.length < 2 || lines[1].trim() === '') return undefined;
  for (let i = 1; i < lines.length; i++) {
    if (/^(?:---|\.\.\.)[ \t]*$/.test(lines[i])) {
      return { content: lines.slice(1, i).join('\n'), contentStartLine: 1, closeLine: i };
    }
  }
  return undefined;
}
