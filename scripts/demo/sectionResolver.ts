/**
 * Demo GIF automation — section resolver.
 *
 * Resolves user-facing section names (e.g. "mermaid") to their
 * corresponding {@link SectionAnchor} entries parsed from `demo.md`,
 * and builds descriptive error messages for invalid section names.
 */

import { SectionAnchor, SECTION_MAP } from './config.js';

/**
 * Look up a section name in the parsed anchors array.
 *
 * The user-facing `sectionName` is mapped to an anchor identifier via
 * {@link SECTION_MAP}, then matched against the `name` field of each
 * anchor.
 *
 * @param anchors     - Anchors extracted from `demo.md`
 * @param sectionName - User-facing section name (e.g. "mermaid")
 * @returns The matching anchor, or `undefined` if not found
 */
export function resolveSection(
  anchors: SectionAnchor[],
  sectionName: string,
): SectionAnchor | undefined {
  const anchorId = SECTION_MAP[sectionName];
  if (anchorId === undefined) {
    return undefined;
  }
  return anchors.find((a) => a.name === anchorId.replace('DEMO:', ''));
}

/**
 * Build a human-readable error message for an invalid section name.
 *
 * The message includes the rejected name and lists every section name
 * that is currently available in {@link SECTION_MAP}.
 *
 * @param sectionName - The invalid section name the user provided
 * @param anchors     - Current anchors (unused but kept for symmetry with resolveSection)
 * @returns Formatted error string
 */
export function buildSectionError(
  sectionName: string,
  anchors: SectionAnchor[],
): string {
  const available = Object.keys(SECTION_MAP).join(', ');
  return `Unknown section "${sectionName}". Available sections: ${available}`;
}
