import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  values: {} as Record<string, unknown>,
  updates: [] as Array<{ key: string; value: unknown; target: unknown }>,
  showQuickPick: vi.fn(),
  showOpenDialog: vi.fn(),
  showSaveDialog: vi.fn(),
  showInformationMessage: vi.fn(),
  showWarningMessage: vi.fn(),
  showErrorMessage: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
  workspaceFolders: [{ uri: { fsPath: '/workspace' } }],
}));

vi.mock('vscode', () => ({
  ConfigurationTarget: {
    Global: 1,
    Workspace: 2,
  },
  Uri: {
    file: (fsPath: string) => ({ fsPath }),
  },
  workspace: {
    get workspaceFolders() {
      return mocks.workspaceFolders;
    },
    getConfiguration: () => ({
      get: (key: string, fallback: unknown) =>
        Object.prototype.hasOwnProperty.call(mocks.values, key) ? mocks.values[key] : fallback,
      inspect: (key: string) =>
        Object.prototype.hasOwnProperty.call(mocks.values, key)
          ? { globalValue: mocks.values[key] }
          : undefined,
      update: vi.fn(async (key: string, value: unknown, target: unknown) => {
        mocks.values[key] = value;
        mocks.updates.push({ key, value, target });
      }),
    }),
    fs: {
      readFile: (...args: unknown[]) => mocks.readFile(...args),
      writeFile: (...args: unknown[]) => mocks.writeFile(...args),
    },
  },
  window: {
    showQuickPick: (...args: unknown[]) => mocks.showQuickPick(...args),
    showOpenDialog: (...args: unknown[]) => mocks.showOpenDialog(...args),
    showSaveDialog: (...args: unknown[]) => mocks.showSaveDialog(...args),
    showInformationMessage: (...args: unknown[]) => mocks.showInformationMessage(...args),
    showWarningMessage: (...args: unknown[]) => mocks.showWarningMessage(...args),
    showErrorMessage: (...args: unknown[]) => mocks.showErrorMessage(...args),
  },
}));

import { exportProfileToJsonCommand } from '../../src/commands/exportProfileToJson';
import { importExportProfileCommand } from '../../src/commands/importExportProfile';

describe('export settings JSON commands', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.values = {};
    mocks.updates = [];
    mocks.workspaceFolders = [{ uri: { fsPath: '/workspace' } }];
  });

  it('exports the current Markdown Studio settings as JSON', async () => {
    mocks.values = {
      'export.pageFormat': 'A5',
      'style.preset': 'github',
      'security.externalResources.mode': 'block-all',
      'export.pdfBookmarks.enabled': false,
      'export.pdfIndex.enabled': true,
    };
    mocks.showSaveDialog.mockResolvedValue({ fsPath: '/tmp/settings.json' });

    await exportProfileToJsonCommand();

    expect(mocks.writeFile).toHaveBeenCalledTimes(1);
    const [, bytes] = mocks.writeFile.mock.calls[0];
    expect(JSON.parse(new TextDecoder().decode(bytes))).toEqual({
      schemaVersion: 1,
      name: 'Current Settings',
      pageFormat: 'A5',
      stylePreset: 'github',
      securityMode: 'block-all',
      includeBookmarks: false,
      includePdfIndex: true,
    });
  });

  it('imports a JSON settings file into workspace settings', async () => {
    const profileJson = JSON.stringify({
      name: 'Company Spec A4',
      pageFormat: 'A4',
      stylePreset: 'github',
      securityMode: 'block-all',
      includeBookmarks: true,
      includePdfIndex: false,
    });
    mocks.showOpenDialog.mockResolvedValue([{ fsPath: '/tmp/profile.json' }]);
    mocks.showQuickPick.mockImplementation(async (items: any[]) => items[0]);
    mocks.readFile.mockResolvedValue(new TextEncoder().encode(profileJson));

    await importExportProfileCommand();

    expect(mocks.updates).toEqual([
      { key: 'export.pageFormat', value: 'A4', target: 2 },
      { key: 'style.preset', value: 'github', target: 2 },
      { key: 'security.externalResources.mode', value: 'block-all', target: 2 },
      { key: 'export.pdfBookmarks.enabled', value: true, target: 2 },
      { key: 'export.pdfIndex.enabled', value: false, target: 2 },
    ]);
  });

  it('lets the user choose one entry when the JSON contains multiple settings', async () => {
    const profileJson = JSON.stringify({
      profiles: [
        { name: 'A4', pageFormat: 'A4' },
        { name: 'Letter', pageFormat: 'Letter' },
      ],
    });
    mocks.showOpenDialog.mockResolvedValue([{ fsPath: '/tmp/profiles.json' }]);
    mocks.showQuickPick
      .mockImplementationOnce(async (items: any[]) => items[1])
      .mockImplementationOnce(async (items: any[]) => items[0]);
    mocks.readFile.mockResolvedValue(new TextEncoder().encode(profileJson));

    await importExportProfileCommand();

    expect(mocks.updates).toEqual([
      { key: 'export.pageFormat', value: 'Letter', target: 2 },
    ]);
  });
});
