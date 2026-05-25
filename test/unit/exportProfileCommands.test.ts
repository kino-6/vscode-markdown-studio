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

import { exportActiveProfileToJsonCommand, exportProfileToJsonCommand } from '../../src/commands/exportProfileToJson';
import { importExportProfileCommand } from '../../src/commands/importExportProfile';
import { selectExportProfileCommand } from '../../src/commands/selectExportProfile';

describe('export profile commands', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.values = {};
    mocks.updates = [];
    mocks.workspaceFolders = [{ uri: { fsPath: '/workspace' } }];
  });

  it('selectExportProfileCommand stores the selected profile name', async () => {
    mocks.values = {
      exportProfiles: [
        { name: 'Company Spec A4', pageFormat: 'A4' },
      ],
    };
    mocks.showQuickPick.mockImplementation(async (items: any[]) => items[1]);

    await selectExportProfileCommand();

    expect(mocks.updates).toContainEqual({
      key: 'activeExportProfile',
      value: 'Company Spec A4',
      target: 2,
    });
  });

  it('selectExportProfileCommand clears the active profile', async () => {
    mocks.values = {
      activeExportProfile: 'Company Spec A4',
      exportProfiles: [
        { name: 'Company Spec A4', pageFormat: 'A4' },
      ],
    };
    mocks.showQuickPick.mockImplementation(async (items: any[]) => items[0]);

    await selectExportProfileCommand();

    expect(mocks.updates).toContainEqual({
      key: 'activeExportProfile',
      value: '',
      target: 2,
    });
  });

  it('importExportProfileCommand copies a JSON profile into workspace settings', async () => {
    const profileJson = JSON.stringify({
      name: 'Company Spec A4',
      pageFormat: 'A4',
      stylePreset: 'github',
    });
    mocks.showOpenDialog.mockResolvedValue([{ fsPath: '/tmp/profile.json' }]);
    mocks.showQuickPick.mockImplementation(async (items: any[]) => items[0]);
    mocks.readFile.mockResolvedValue(new TextEncoder().encode(profileJson));

    await importExportProfileCommand();

    expect(mocks.updates).toHaveLength(1);
    expect(mocks.updates[0]).toMatchObject({
      key: 'exportProfiles',
      target: 2,
    });
    expect(mocks.updates[0].value).toEqual([
      {
        schemaVersion: 1,
        name: 'Company Spec A4',
        pageFormat: 'A4',
        stylePreset: 'github',
      },
    ]);
  });

  it('exportProfileToJsonCommand writes selected profile JSON', async () => {
    mocks.values = {
      exportProfiles: [
        {
          schemaVersion: 1,
          name: 'Company Spec A4',
          pageFormat: 'A4',
        },
      ],
    };
    mocks.showQuickPick.mockImplementation(async (items: any[]) => items[0]);
    mocks.showSaveDialog.mockResolvedValue({ fsPath: '/tmp/profile.json' });

    await exportProfileToJsonCommand();

    expect(mocks.writeFile).toHaveBeenCalledTimes(1);
    const [, bytes] = mocks.writeFile.mock.calls[0];
    expect(new TextDecoder().decode(bytes)).toBe(
      '{\n  "schemaVersion": 1,\n  "name": "Company Spec A4",\n  "pageFormat": "A4"\n}\n',
    );
  });

  it('exportActiveProfileToJsonCommand writes active profile JSON without a profile picker', async () => {
    mocks.values = {
      activeExportProfile: 'Company Spec A4',
      exportProfiles: [
        {
          schemaVersion: 1,
          name: 'Company Spec A4',
          pageFormat: 'A4',
        },
      ],
    };
    mocks.showSaveDialog.mockResolvedValue({ fsPath: '/tmp/profile.json' });

    await exportActiveProfileToJsonCommand();

    expect(mocks.showQuickPick).not.toHaveBeenCalled();
    expect(mocks.writeFile).toHaveBeenCalledTimes(1);
    const [, bytes] = mocks.writeFile.mock.calls[0];
    expect(new TextDecoder().decode(bytes)).toContain('"name": "Company Spec A4"');
  });

  it('exportActiveProfileToJsonCommand lets the user pick a profile when none is active', async () => {
    mocks.values = {
      exportProfiles: [
        {
          schemaVersion: 1,
          name: 'Company Spec A4',
          pageFormat: 'A4',
        },
      ],
    };
    mocks.showQuickPick.mockImplementation(async (items: any[]) => items[0]);
    mocks.showSaveDialog.mockResolvedValue({ fsPath: '/tmp/profile.json' });

    await exportActiveProfileToJsonCommand();

    expect(mocks.showWarningMessage).not.toHaveBeenCalledWith(
      'Markdown Studio: No active export profile is configured.',
    );
    expect(mocks.showQuickPick).toHaveBeenCalledTimes(1);
    expect(mocks.writeFile).toHaveBeenCalledTimes(1);
    const [, bytes] = mocks.writeFile.mock.calls[0];
    expect(new TextDecoder().decode(bytes)).toContain('"name": "Company Spec A4"');
  });
});
