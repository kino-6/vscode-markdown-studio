/**
 * TOC comment marker detection, wrapping, and replacement.
 *
 * Detects `<!-- TOC -->` (start) and `<!-- /TOC -->` (end) markers in Markdown
 * source and provides utilities to wrap TOC text with markers and replace
 * existing TOC content between markers.
 */

/** TOC comment marker detection result */
export interface TocMarkerRange {
  /** Start marker line (0-based) */
  startLine: number;
  /** End marker line (0-based) */
  endLine: number;
  /** Text between markers (excluding marker lines) */
  content: string;
}

const START_MARKER = '<!-- TOC -->';
const END_MARKER = '<!-- /TOC -->';

const START_RE = /^\s*<!--\s*TOC\s*-->\s*$/;
const END_RE = /^\s*<!--\s*\/TOC\s*-->\s*$/;

function detectLineEnding(text: string): string {
  return text.match(/\r\n|\n|\r/)?.[0] ?? '\n';
}

function splitLines(text: string): string[] {
  return text.split(/\r\n|\n|\r/);
}

function normalizeLineEndings(text: string, lineEnding: string): string {
  return splitLines(text).join(lineEnding);
}

/**
 * Find `<!-- TOC -->` / `<!-- /TOC -->` markers in Markdown source.
 * Markers inside fenced code blocks are excluded.
 *
 * @param markdown - Raw Markdown source
 * @param fencedRanges - Line ranges of fenced code blocks (from scanFencedBlocks)
 * @returns Marker range, or undefined if start marker not found or end marker missing
 */
export function findTocCommentMarkers(
  markdown: string,
  fencedRanges?: Array<{ startLine: number; endLine: number }>,
): TocMarkerRange | undefined {
  const lineEnding = detectLineEnding(markdown);
  const lines = splitLines(markdown);
  const ranges = fencedRanges ?? [];

  let startLine = -1;

  for (let i = 0; i < lines.length; i++) {
    if (isInsideFenced(i, ranges)) {
      continue;
    }

    if (startLine === -1) {
      if (START_RE.test(lines[i])) {
        startLine = i;
      }
    } else {
      if (END_RE.test(lines[i])) {
        const contentLines = lines.slice(startLine + 1, i);
        return {
          startLine,
          endLine: i,
          content: contentLines.join(lineEnding),
        };
      }
    }
  }

  return undefined;
}

/**
 * Wrap TOC text with comment markers.
 *
 * @returns TOC text wrapped with comment markers using the requested line ending.
 */
export function wrapWithMarkers(tocText: string, lineEnding = '\n'): string {
  if (!tocText) {
    return `${START_MARKER}${lineEnding}${END_MARKER}`;
  }
  return `${START_MARKER}${lineEnding}${normalizeLineEndings(tocText, lineEnding)}${lineEnding}${END_MARKER}`;
}

/**
 * Replace content between TOC markers with new TOC text.
 * Lines before the start marker and after the end marker are preserved.
 *
 * @returns Full document text with replaced TOC content
 */
export function replaceTocContent(
  markdown: string,
  markerRange: TocMarkerRange,
  newTocText: string,
): string {
  const lineEnding = detectLineEnding(markdown);
  const lines = splitLines(markdown);
  const before = lines.slice(0, markerRange.startLine + 1);
  const after = lines.slice(markerRange.endLine);

  if (!newTocText) {
    return [...before, ...after].join(lineEnding);
  }

  const tocLines = splitLines(newTocText);
  return [...before, ...tocLines, ...after].join(lineEnding);
}

function isInsideFenced(
  line: number,
  ranges: Array<{ startLine: number; endLine: number }>,
): boolean {
  return ranges.some((r) => line >= r.startLine && line < r.endLine);
}
