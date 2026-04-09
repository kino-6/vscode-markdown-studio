import { describe, it, expect } from 'vitest';
import { resolveSection, buildSectionError } from '../../scripts/demo/sectionResolver.js';
import type { SectionAnchor } from '../../scripts/demo/config.js';

const SAMPLE_ANCHORS: SectionAnchor[] = [
  { name: 'RENDERING', anchor: '<!-- DEMO:RENDERING -->', line: 2 },
  { name: 'MERMAID', anchor: '<!-- DEMO:MERMAID -->', line: 10 },
  { name: 'PLANTUML', anchor: '<!-- DEMO:PLANTUML -->', line: 20 },
  { name: 'SECURITY', anchor: '<!-- DEMO:SECURITY -->', line: 30 },
  { name: 'EXPORT', anchor: '<!-- DEMO:EXPORT -->', line: 40 },
];

describe('resolveSection', () => {
  it('resolves a valid section name to its anchor', () => {
    const result = resolveSection(SAMPLE_ANCHORS, 'mermaid');
    expect(result).toEqual(SAMPLE_ANCHORS[1]);
  });

  it('resolves all known section names', () => {
    expect(resolveSection(SAMPLE_ANCHORS, 'rendering')).toEqual(SAMPLE_ANCHORS[0]);
    expect(resolveSection(SAMPLE_ANCHORS, 'plantuml')).toEqual(SAMPLE_ANCHORS[2]);
    expect(resolveSection(SAMPLE_ANCHORS, 'security')).toEqual(SAMPLE_ANCHORS[3]);
    expect(resolveSection(SAMPLE_ANCHORS, 'export')).toEqual(SAMPLE_ANCHORS[4]);
  });

  it('returns undefined for an unknown section name', () => {
    expect(resolveSection(SAMPLE_ANCHORS, 'unknown')).toBeUndefined();
  });

  it('returns undefined when anchors array is empty', () => {
    expect(resolveSection([], 'mermaid')).toBeUndefined();
  });

  it('returns undefined when section exists in SECTION_MAP but not in anchors', () => {
    const partial: SectionAnchor[] = [
      { name: 'RENDERING', anchor: '<!-- DEMO:RENDERING -->', line: 2 },
    ];
    expect(resolveSection(partial, 'mermaid')).toBeUndefined();
  });
});

describe('buildSectionError', () => {
  it('includes the invalid section name in the error message', () => {
    const msg = buildSectionError('bogus', SAMPLE_ANCHORS);
    expect(msg).toContain('bogus');
  });

  it('lists all available section names', () => {
    const msg = buildSectionError('bogus', SAMPLE_ANCHORS);
    expect(msg).toContain('rendering');
    expect(msg).toContain('mermaid');
    expect(msg).toContain('plantuml');
    expect(msg).toContain('security');
    expect(msg).toContain('export');
  });
});
