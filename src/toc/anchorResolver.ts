import type { HeadingEntry, AnchorMapping } from '../types/models';

/**
 * Convert heading text to a URL-friendly slug (GitHub-compatible).
 * - Lowercase conversion
 * - Spaces → hyphens
 * - Remove characters that are not alphanumeric, hyphen, underscore, or non-ASCII
 * - Non-ASCII characters (e.g. Japanese) are preserved
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}\-_]/gu, '')
    .replace(/-{2,}/g, '-');
}

/**
 * Generate unique anchor IDs for a list of headings.
 * Duplicate slugs receive sequential suffixes: -1, -2, etc.
 */
export function resolveAnchors(headings: HeadingEntry[]): AnchorMapping[] {
  const counts = new Map<string, number>();

  return headings.map((heading) => {
    const base = slugify(heading.text);
    const seen = counts.get(base) ?? 0;
    const anchorId = seen === 0 ? base : `${base}-${seen}`;
    counts.set(base, seen + 1);

    return { heading, anchorId };
  });
}
