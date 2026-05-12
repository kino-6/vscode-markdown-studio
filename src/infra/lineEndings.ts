const LINE_BREAK_RE = /\r\n|\n|\r/g;
const LINE_SPLIT_RE = /\r\n|\n|\r/;

export function detectLineEnding(text: string): string {
  return text.match(LINE_SPLIT_RE)?.[0] ?? '\n';
}

export function splitLines(text: string): string[] {
  return text.split(LINE_SPLIT_RE);
}

export function normalizeLineEndings(text: string, lineEnding = '\n'): string {
  return splitLines(text).join(lineEnding);
}

export function countLineBreaks(text: string): number {
  return text.match(LINE_BREAK_RE)?.length ?? 0;
}
