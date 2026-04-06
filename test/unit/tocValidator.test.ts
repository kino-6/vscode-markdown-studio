import { describe, it, expect, vi } from 'vitest';
import { validateAnchors, publishDiagnostics } from '../../src/toc/tocValidator';
import type { AnchorMapping, TocDiagnostic } from '../../src/types/models';

function makeAnchor(
  anchorId: string,
  text: string,
  line = 0,
  level = 1,
): AnchorMapping {
  return { heading: { level, text, line }, anchorId };
}

describe('validateAnchors', () => {
  it('returns empty array when all anchors match heading IDs', () => {
    const anchors = [
      makeAnchor('intro', 'Introduction', 0),
      makeAnchor('setup', 'Setup', 5),
    ];
    const headingIds = new Set(['intro', 'setup']);
    expect(validateAnchors(anchors, headingIds)).toEqual([]);
  });

  it('returns empty array for empty anchors list', () => {
    expect(validateAnchors([], new Set(['a']))).toEqual([]);
  });

  it('detects anchor with no corresponding heading ID', () => {
    const anchors = [makeAnchor('missing-id', 'Missing Heading', 3)];
    const headingIds = new Set(['other-id']);
    const result = validateAnchors(anchors, headingIds);

    expect(result).toHaveLength(1);
    expect(result[0].anchorId).toBe('missing-id');
    expect(result[0].expectedHeading).toBe('Missing Heading');
    expect(result[0].line).toBe(3);
    expect(result[0].message).toContain('missing-id');
    expect(result[0].message).toContain('Missing Heading');
  });

  it('detects multiple invalid anchors', () => {
    const anchors = [
      makeAnchor('valid', 'Valid', 0),
      makeAnchor('bad-1', 'Bad One', 2),
      makeAnchor('bad-2', 'Bad Two', 4),
    ];
    const headingIds = new Set(['valid']);
    const result = validateAnchors(anchors, headingIds);

    expect(result).toHaveLength(2);
    expect(result[0].anchorId).toBe('bad-1');
    expect(result[1].anchorId).toBe('bad-2');
  });

  it('returns empty array when headingIds is empty and anchors is empty', () => {
    expect(validateAnchors([], new Set())).toEqual([]);
  });

  it('reports all anchors as invalid when headingIds is empty', () => {
    const anchors = [makeAnchor('a', 'A', 0), makeAnchor('b', 'B', 1)];
    const result = validateAnchors(anchors, new Set());
    expect(result).toHaveLength(2);
  });

  it('includes anchor ID and expected heading text in diagnostic message', () => {
    const anchors = [makeAnchor('日本語-heading', '日本語 Heading', 10)];
    const result = validateAnchors(anchors, new Set());

    expect(result[0].message).toContain('日本語-heading');
    expect(result[0].message).toContain('日本語 Heading');
  });
});

describe('publishDiagnostics', () => {
  function makeMockCollection() {
    return { set: vi.fn(), delete: vi.fn(), clear: vi.fn() };
  }

  function makeMockUri() {
    return { scheme: 'file', path: '/test.md' } as any;
  }

  it('clears diagnostics when list is empty', async () => {
    const { Range, DiagnosticSeverity } = await import('vscode');
    const collection = makeMockCollection();
    const uri = makeMockUri();

    publishDiagnostics([], uri, collection as any);

    expect(collection.set).toHaveBeenCalledWith(uri, []);
  });

  it('publishes diagnostics for invalid anchors', async () => {
    const vscode = await import('vscode');
    const collection = makeMockCollection();
    const uri = makeMockUri();

    const diagnostics: TocDiagnostic[] = [
      {
        line: 5,
        anchorId: 'bad-link',
        expectedHeading: 'Bad Link',
        message: 'Invalid anchor link "#bad-link" — no matching heading found for "Bad Link"',
      },
    ];

    publishDiagnostics(diagnostics, uri, collection as any);

    expect(collection.set).toHaveBeenCalledTimes(1);
    const [calledUri, calledDiags] = collection.set.mock.calls[0];
    expect(calledUri).toBe(uri);
    expect(calledDiags).toHaveLength(1);
  });
});
