import path from 'node:path';
import type { PdfCoverConfig } from '../types/models';

function normalizeForCompare(filePath: string): string {
  return path.resolve(filePath);
}

export function resolveCoverMarkdownPath(
  sourceMarkdownPath: string,
  config: PdfCoverConfig,
): string | undefined {
  if (!config.enabled) {
    return undefined;
  }

  const coverPath = config.path.trim() || 'cover.md';
  const resolved = path.isAbsolute(coverPath)
    ? path.resolve(coverPath)
    : path.resolve(path.dirname(sourceMarkdownPath), coverPath);

  if (normalizeForCompare(resolved) === normalizeForCompare(sourceMarkdownPath)) {
    throw new Error('Markdown Studio: Cover cannot use the source Markdown file.');
  }

  return resolved;
}
