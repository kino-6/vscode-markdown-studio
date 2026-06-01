import { detectLineEnding, splitLines } from '../infra/lineEndings';

export interface EmbeddedCoverMarkdown {
  coverMarkdown?: string;
  bodyMarkdown: string;
}

const EMBEDDED_COVER_START_RE = /^\s*<!--\s*markdown-studio:cover\s*-->\s*$/i;
const EMBEDDED_COVER_END_RE = /^\s*<!--\s*\/markdown-studio:cover\s*-->\s*$/i;

export function splitEmbeddedCoverMarkdown(markdown: string): EmbeddedCoverMarkdown {
  const lineEnding = detectLineEnding(markdown);
  const lines = splitLines(markdown);
  const fencedRanges = findMarkdownFenceRanges(lines);

  let startLine = -1;
  for (let i = 0; i < lines.length; i++) {
    if (isInsideFenced(i, fencedRanges)) {
      continue;
    }

    if (startLine === -1) {
      if (EMBEDDED_COVER_START_RE.test(lines[i])) {
        startLine = i;
      }
      continue;
    }

    if (EMBEDDED_COVER_END_RE.test(lines[i])) {
      const coverMarkdown = lines.slice(startLine + 1, i).join(lineEnding);
      const before = lines.slice(0, startLine);
      const after = lines.slice(i + 1);
      if (before.length === 0) {
        while (after.length > 0 && after[0].trim() === '') {
          after.shift();
        }
      }

      return {
        coverMarkdown,
        bodyMarkdown: [...before, ...after].join(lineEnding),
      };
    }
  }

  return { bodyMarkdown: markdown };
}

function isInsideFenced(
  line: number,
  ranges: Array<{ startLine: number; endLine: number }>,
): boolean {
  return ranges.some((range) => line >= range.startLine && line < range.endLine);
}

function findMarkdownFenceRanges(lines: string[]): Array<{ startLine: number; endLine: number }> {
  const ranges: Array<{ startLine: number; endLine: number }> = [];
  let open: { marker: string; startLine: number } | undefined;

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^\s*(`{3,}|~{3,})/);
    if (!match) {
      continue;
    }

    const marker = match[1];
    if (!open) {
      open = { marker: marker[0], startLine: i };
      continue;
    }

    if (marker[0] === open.marker) {
      ranges.push({ startLine: open.startLine, endLine: i + 1 });
      open = undefined;
    }
  }

  return ranges;
}
