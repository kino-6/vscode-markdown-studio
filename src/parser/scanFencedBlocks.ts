import { FencedBlock, FencedBlockKind } from '../types/models';

const FENCE_KIND_ALIASES: Record<string, FencedBlockKind> = {
  mermaid: 'mermaid',
  plantuml: 'plantuml',
  puml: 'puml',
  svg: 'svg',
  wavedrom: 'wavedrom',
  wavejson: 'wavedrom',
  'wavedrom-json': 'wavedrom',
};

function normalizeFencedBlockKind(rawKind: string): FencedBlockKind | undefined {
  return FENCE_KIND_ALIASES[rawKind.toLowerCase()];
}

export function scanFencedBlocks(markdown: string): FencedBlock[] {
  const blocks: FencedBlock[] = [];

  let open: {
    kind: FencedBlockKind;
    startLine: number;
    startOffset: number;
    buffer: string[];
  } | undefined;

  const lineRe = /([^\r\n]*)(\r\n|\n|\r|$)/g;
  let lineNumber = 0;
  let match: RegExpExecArray | null;

  while ((match = lineRe.exec(markdown)) !== null) {
    if (match[0] === '' && match.index === markdown.length) {
      break;
    }

    const line = match[1];
    const lineStartOffset = match.index;
    const lineEndOffset = lineStartOffset + line.length;
    const fenceMatch = line.match(/^```\s*([a-zA-Z0-9_-]+)?\s*$/);
    if (!fenceMatch) {
      if (open) open.buffer.push(line);
      lineNumber += 1;
      continue;
    }

    if (!open) {
      const rawKind = (fenceMatch[1] ?? '').toLowerCase();
      const kind = normalizeFencedBlockKind(rawKind);
      if (kind) {
        open = {
          kind,
          startLine: lineNumber + 1,
          startOffset: lineStartOffset,
          buffer: [],
        };
      }
      lineNumber += 1;
      continue;
    }

    blocks.push({
      id: `${open.kind}-${open.startLine}`,
      kind: open.kind,
      content: open.buffer.join('\n'),
      startLine: open.startLine,
      endLine: lineNumber + 1,
      startOffset: open.startOffset,
      endOffset: lineEndOffset,
      raw: markdown.slice(open.startOffset, lineEndOffset),
    });
    open = undefined;
    lineNumber += 1;
  }

  return blocks;
}
