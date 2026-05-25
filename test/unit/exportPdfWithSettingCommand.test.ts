import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  values: {} as Record<string, unknown>,
  updates: [] as Array<{ key: string; value: unknown; target: unknown }>,
  showQuickPick: vi.fn(),
  showInputBox: vi.fn(),
  showInformationMessage: vi.fn(),
  showWarningMessage: vi.fn(),
  activeTextEditor: {
    document: {
      languageId: 'markdown',
      uri: { fsPath: '/workspace/docs/spec.md' },
    },
  },
  workspaceFolders: [{ uri: { fsPath: '/workspace' } }],
}));

vi.mock('vscode', () => ({
  ConfigurationTarget: {
    Global: 1,
    Workspace: 2,
  },
  QuickPickItemKind: {
    Separator: -1,
  },
  workspace: {
    get workspaceFolders() {
      return mocks.workspaceFolders;
    },
    getConfiguration: () => ({
      get: (key: string, fallback: unknown) =>
        Object.prototype.hasOwnProperty.call(mocks.values, key) ? mocks.values[key] : fallback,
      update: vi.fn(async (key: string, value: unknown, target: unknown) => {
        mocks.values[key] = value;
        mocks.updates.push({ key, value, target });
      }),
    }),
  },
  window: {
    get activeTextEditor() {
      return mocks.activeTextEditor;
    },
    showQuickPick: (...args: unknown[]) => mocks.showQuickPick(...args),
    showInputBox: (...args: unknown[]) => mocks.showInputBox(...args),
    showInformationMessage: (...args: unknown[]) => mocks.showInformationMessage(...args),
    showWarningMessage: (...args: unknown[]) => mocks.showWarningMessage(...args),
  },
}));

const exportPdfCommandMock = vi.hoisted(() => vi.fn());
vi.mock('../../src/commands/exportPdf', () => ({
  exportPdfCommand: (...args: unknown[]) => exportPdfCommandMock(...args),
}));

import { exportPdfWithSettingCommand, saveSnapshotAsProfileCommand } from '../../src/commands/exportPdfWithSetting';

function memento(initial: unknown[] = []) {
  return {
    get: vi.fn(() => initial),
    update: vi.fn(),
  };
}

describe('export PDF with setting command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.values = {};
    mocks.updates = [];
    mocks.activeTextEditor = {
      document: {
        languageId: 'markdown',
        uri: { fsPath: '/workspace/docs/spec.md' },
      },
    };
  });

  it('exports with a selected profile without mutating the active profile setting', async () => {
    mocks.values = {
      activeExportProfile: 'Old Active',
      exportProfiles: [
        {
          schemaVersion: 1,
          name: 'Company Spec A4',
          pageFormat: 'A4',
          stylePreset: 'github',
        },
      ],
    };
    mocks.showQuickPick.mockImplementation(async (items: any[]) =>
      items.find(item => item.label === 'Company Spec A4')
    );

    await exportPdfWithSettingCommand({
      workspaceState: memento(),
      globalState: memento(),
    } as any);

    expect(exportPdfCommandMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        source: { kind: 'profile', profileName: 'Company Spec A4' },
        overlay: expect.objectContaining({ pageFormat: 'A4', stylePreset: 'github' }),
      }),
    );
    expect(mocks.updates).toEqual([]);
  });

  it('exports with a selected snapshot overlay', async () => {
    const snapshot = {
      schemaVersion: 1,
      id: '2026-05-24T00:00:00.000Z',
      createdAt: '2026-05-24T00:00:00.000Z',
      sourceFile: 'docs/spec.md',
      source: { kind: 'current' },
      settings: { pageFormat: 'A5', stylePreset: 'minimal' },
    };
    mocks.showQuickPick.mockImplementation(async (items: any[]) =>
      items.find(item => item.source?.kind === 'snapshot')
    );

    await exportPdfWithSettingCommand({
      workspaceState: memento([snapshot]),
      globalState: memento(),
    } as any);

    expect(exportPdfCommandMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        source: { kind: 'snapshot', snapshotId: snapshot.id },
        overlay: { pageFormat: 'A5', stylePreset: 'minimal' },
      }),
    );
  });

  it('promotes a snapshot into a workspace export profile', async () => {
    const snapshot = {
      schemaVersion: 1,
      id: '2026-05-24T00:00:00.000Z',
      createdAt: '2026-05-24T00:00:00.000Z',
      sourceFile: 'docs/spec.md',
      source: { kind: 'current' },
      settings: { pageFormat: 'A5', stylePreset: 'minimal' },
    };
    mocks.showQuickPick.mockImplementation(async (items: any[]) => items[0]);
    mocks.showInputBox.mockResolvedValue('Decision A5');

    await saveSnapshotAsProfileCommand({
      workspaceState: memento([snapshot]),
      globalState: memento(),
    } as any);

    expect(mocks.updates).toContainEqual({
      key: 'exportProfiles',
      target: 2,
      value: [
        {
          schemaVersion: 1,
          name: 'Decision A5',
          pageFormat: 'A5',
          stylePreset: 'minimal',
        },
      ],
    });
  });
});
