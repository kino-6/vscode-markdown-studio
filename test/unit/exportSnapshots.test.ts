import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  workspaceFolders: [{ uri: { fsPath: '/workspace' } }],
}));

vi.mock('vscode', () => ({
  workspace: {
    get workspaceFolders() {
      return mocks.workspaceFolders;
    },
  },
}));

import {
  createExportSnapshot,
  EXPORT_SNAPSHOT_LIMIT,
  loadExportSnapshots,
  normalizeExportSnapshots,
  overlayFromConfig,
  saveExportSnapshot,
} from '../../src/infra/exportSnapshots';

function memento(initial: unknown[] = []) {
  let value = initial;
  return {
    get: vi.fn(() => value),
    update: vi.fn(async (_key: string, next: unknown[]) => {
      value = next;
    }),
    value: () => value,
  };
}

function config(overrides: Record<string, unknown> = {}) {
  return {
    pageFormat: 'A4',
    style: { presetName: 'github' },
    externalResources: { mode: 'block-all' },
    pdfBookmarks: { enabled: true },
    pdfIndex: { enabled: false },
    ...overrides,
  } as any;
}

describe('export snapshots', () => {
  it('normalizes, sorts newest first, and trims snapshots', () => {
    const raw = Array.from({ length: EXPORT_SNAPSHOT_LIMIT + 2 }, (_, index) => ({
      schemaVersion: 1,
      id: `id-${index}`,
      createdAt: `2026-05-24T00:${String(index).padStart(2, '0')}:00.000Z`,
      sourceFile: 'docs/spec.md',
      source: { kind: 'current' },
      settings: { pageFormat: 'A4' },
    }));

    const snapshots = normalizeExportSnapshots(raw);

    expect(snapshots).toHaveLength(EXPORT_SNAPSHOT_LIMIT);
    expect(snapshots[0].id).toBe('id-21');
    expect(snapshots.at(-1)?.id).toBe('id-2');
  });

  it('saves snapshots to workspace state when a workspace is open', async () => {
    const workspaceState = memento();
    const globalState = memento();
    const context = { workspaceState, globalState } as any;

    await saveExportSnapshot(context, {
      schemaVersion: 1,
      id: '2026-05-24T00:00:00.000Z',
      createdAt: '2026-05-24T00:00:00.000Z',
      sourceFile: 'docs/spec.md',
      source: { kind: 'current' },
      settings: { pageFormat: 'A4' },
    });

    expect(workspaceState.update).toHaveBeenCalledTimes(1);
    expect(globalState.update).not.toHaveBeenCalled();
    expect(loadExportSnapshots(context)[0].id).toBe('2026-05-24T00:00:00.000Z');
  });

  it('creates workspace-relative snapshot paths and a reproducible overlay', () => {
    const snapshot = createExportSnapshot(
      { uri: { fsPath: '/workspace/docs/spec.md' } } as any,
      '/workspace/docs/spec.pdf',
      { kind: 'profile', profileName: 'Company Spec A4' },
      config({ pageFormat: 'A5', pdfIndex: { enabled: true } }),
      new Date('2026-05-24T01:02:03.000Z'),
    );

    expect(snapshot).toMatchObject({
      id: '2026-05-24T01:02:03.000Z',
      sourceFile: 'docs/spec.md',
      outputFile: 'docs/spec.pdf',
      source: { kind: 'profile', profileName: 'Company Spec A4' },
      settings: {
        pageFormat: 'A5',
        stylePreset: 'github',
        securityMode: 'block-all',
        includeBookmarks: true,
        includePdfIndex: true,
      },
    });
  });

  it('extracts snapshot overlay from resolved config', () => {
    expect(overlayFromConfig(config())).toEqual({
      pageFormat: 'A4',
      stylePreset: 'github',
      securityMode: 'block-all',
      includeBookmarks: true,
      includePdfIndex: false,
    });
  });
});
