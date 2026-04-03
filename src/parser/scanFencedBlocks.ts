import { FencedBlock } from '../types/models';

export function scanFencedBlocks(markdown: string): FencedBlock[] {
  const lines = markdown.split(/\r?\n/);
  const blocks: FencedBlock[] = [];

  let open: { kind: string; startLine: number; buffer: string[] } | undefined;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const fenceMatch = line.match(/^```\s*([a-zA-Z0-9_-]+)?\s*$/);
    if (!fenceMatch) {
      if (open) open.buffer.push(line);
      continue;
    }

    if (!open) {
      const rawKind = (fenceMatch[1] ?? '').toLowerCase();
      if (['mermaid', 'plantuml', 'puml', 'svg'].includes(rawKind)) {
        open = { kind: rawKind, startLine: i + 1, buffer: [] };
      }
      continue;
    }

    blocks.push({
      id: `${open.kind}-${open.startLine}`,
      kind: open.kind as FencedBlock['kind'],
      content: open.buffer.join('\n'),
      startLine: open.startLine,
      endLine: i + 1
    });
    open = undefined;
  }

  return blocks;
}
