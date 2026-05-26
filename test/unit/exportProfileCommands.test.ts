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
  createDirectory: vi.fn(),
  readDirectory: vi.fn(),
  delete: vi.fn(),
  language: 'en',
  workspaceFolders: [{ uri: { fsPath: '/workspace' } }],
}));

vi.mock('vscode', () => ({
  ConfigurationTarget: {
    Global: 1,
    Workspace: 2,
  },
  FileType: {
    File: 1,
    Directory: 2,
  },
  Uri: {
    file: (fsPath: string) => ({ fsPath }),
    joinPath: (base: { fsPath: string }, ...paths: string[]) => ({
      fsPath: [base.fsPath, ...paths].join('/').replace(/\/+/g, '/'),
    }),
  },
  env: {
    get language() {
      return mocks.language;
    },
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
      createDirectory: (...args: unknown[]) => mocks.createDirectory(...args),
      readDirectory: (...args: unknown[]) => mocks.readDirectory(...args),
      delete: (...args: unknown[]) => mocks.delete(...args),
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
    mocks.language = 'en';
    mocks.workspaceFolders = [{ uri: { fsPath: '/workspace' } }];
    mocks.createDirectory.mockResolvedValue(undefined);
    mocks.readDirectory.mockResolvedValue([]);
    mocks.delete.mockResolvedValue(undefined);
  });

  it('exports the current Markdown Studio settings to .vscode with a timestamped filename', async () => {
    mocks.values = {
      'export.pageFormat': 'A5',
      'style.preset': 'github',
      'security.externalResources.mode': 'block-all',
      'export.pdfBookmarks.enabled': false,
      'export.pdfIndex.enabled': true,
    };

    await exportProfileToJsonCommand();

    expect(mocks.showSaveDialog).not.toHaveBeenCalled();
    expect(mocks.createDirectory).toHaveBeenCalledWith({ fsPath: '/workspace/.vscode' });
    expect(mocks.writeFile).toHaveBeenCalledTimes(1);
    const [uri, bytes] = mocks.writeFile.mock.calls[0];
    expect(uri.fsPath).toMatch(/^\/workspace\/\.vscode\/markdown-studio-settings-\d{8}-\d{6}\.json$/);
    expect(JSON.parse(new TextDecoder().decode(bytes))).toEqual({
      schemaVersion: 1,
      name: 'Current Settings',
      pageFormat: 'A5',
      stylePreset: 'github',
      securityMode: 'block-all',
      includeBookmarks: false,
      includePdfIndex: true,
    });
    expect(mocks.showInformationMessage).toHaveBeenCalledWith(
      expect.stringContaining('Exported settings to /workspace/.vscode/markdown-studio-settings-'),
    );
  });

  it('keeps only the latest three workspace settings exports', async () => {
    mocks.readDirectory.mockResolvedValue([
      ['markdown-studio-settings-20260526-010000.json', 1],
      ['markdown-studio-settings-20260526-020000.json', 1],
      ['markdown-studio-settings-20260526-030000.json', 1],
      ['markdown-studio-settings-20260526-040000.json', 1],
      ['other.json', 1],
    ]);

    await exportProfileToJsonCommand();

    expect(mocks.delete).toHaveBeenCalledWith({
      fsPath: '/workspace/.vscode/markdown-studio-settings-20260526-020000.json',
    });
    expect(mocks.delete).toHaveBeenCalledWith({
      fsPath: '/workspace/.vscode/markdown-studio-settings-20260526-010000.json',
    });
    expect(mocks.delete).toHaveBeenCalledTimes(2);
  });

  it('falls back to a save dialog when no workspace is open', async () => {
    mocks.workspaceFolders = [];
    mocks.showSaveDialog.mockResolvedValue({ fsPath: '/tmp/settings.json' });

    await exportProfileToJsonCommand();

    expect(mocks.showSaveDialog).toHaveBeenCalledTimes(1);
    expect(mocks.writeFile.mock.calls[0][0]).toEqual({ fsPath: '/tmp/settings.json' });
  });

  it('uses a Japanese export notification in Japanese locale', async () => {
    mocks.language = 'ja';

    await exportProfileToJsonCommand();

    expect(mocks.showInformationMessage).toHaveBeenCalledWith(
      expect.stringContaining('設定を書き出しました'),
    );
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
    mocks.readDirectory.mockResolvedValue([]);
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
    mocks.readDirectory.mockResolvedValue([]);
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

  it('lets the user choose a recent workspace settings export when importing', async () => {
    const profileJson = JSON.stringify({
      name: 'Recent',
      pageFormat: 'A5',
    });
    mocks.readDirectory.mockResolvedValue([
      ['markdown-studio-settings-20260526-030000.json', 1],
      ['markdown-studio-settings-20260526-020000.json', 1],
    ]);
    mocks.showQuickPick
      .mockImplementationOnce(async (items: any[]) => items[0])
      .mockImplementationOnce(async (items: any[]) => items[0]);
    mocks.readFile.mockResolvedValue(new TextEncoder().encode(profileJson));

    await importExportProfileCommand();

    expect(mocks.showOpenDialog).not.toHaveBeenCalled();
    expect(mocks.readFile).toHaveBeenCalledWith({
      fsPath: '/workspace/.vscode/markdown-studio-settings-20260526-030000.json',
    });
    expect(mocks.updates).toEqual([
      { key: 'export.pageFormat', value: 'A5', target: 2 },
    ]);
  });
});
