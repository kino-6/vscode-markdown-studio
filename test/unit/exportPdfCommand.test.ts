import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  values: {} as Record<string, unknown>,
  showInformationMessage: vi.fn(),
  showWarningMessage: vi.fn(),
  showErrorMessage: vi.fn(),
  activeTextEditor: {
    document: {
      languageId: 'markdown',
      getText: () => '# Spec',
      uri: { fsPath: '/workspace/docs/spec.md' },
    },
  },
  workspaceFolders: [{ uri: { fsPath: '/workspace' } }],
}));

vi.mock('vscode', () => ({
  ProgressLocation: { Notification: 15 },
  workspace: {
    get workspaceFolders() {
      return mocks.workspaceFolders;
    },
    getConfiguration: () => ({
      get: (key: string, fallback: unknown) =>
        Object.prototype.hasOwnProperty.call(mocks.values, key) ? mocks.values[key] : fallback,
    }),
  },
  window: {
    get activeTextEditor() {
      return mocks.activeTextEditor;
    },
    showInformationMessage: (...args: unknown[]) => mocks.showInformationMessage(...args),
    showWarningMessage: (...args: unknown[]) => mocks.showWarningMessage(...args),
    showErrorMessage: (...args: unknown[]) => mocks.showErrorMessage(...args),
    withProgress: vi.fn((_options, task) =>
      task({ report: vi.fn() }, { isCancellationRequested: false })
    ),
  },
}));

const exportToPdfMock = vi.hoisted(() => vi.fn());
vi.mock('../../src/export/exportPdf', async () => {
  const actual = await vi.importActual<typeof import('../../src/export/exportPdf')>('../../src/export/exportPdf');
  return {
    ...actual,
    exportToPdf: (...args: unknown[]) => exportToPdfMock(...args),
  };
});

const getExportConfigMock = vi.hoisted(() => vi.fn());
vi.mock('../../src/infra/config', () => ({
  getExportConfig: (...args: unknown[]) => getExportConfigMock(...args),
}));

import { exportPdfCommand } from '../../src/commands/exportPdf';

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

function config() {
  return {
    pageFormat: 'A5',
    style: { presetName: 'minimal' },
    externalResources: { mode: 'block-all' },
    pdfBookmarks: { enabled: false },
    pdfIndex: { enabled: true },
  } as any;
}

describe('exportPdfCommand snapshots', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.values = {};
    getExportConfigMock.mockReturnValue(config());
    exportToPdfMock.mockResolvedValue('/workspace/docs/spec.pdf');
  });

  it('saves a timestamped snapshot after successful PDF export', async () => {
    const workspaceState = memento();
    const context = { workspaceState, globalState: memento() } as any;

    await exportPdfCommand(context, {
      overlay: { pageFormat: 'A5' },
      source: { kind: 'profile', profileName: 'Decision A5' },
    });

    expect(exportToPdfMock).toHaveBeenCalledWith(
      mocks.activeTextEditor.document,
      context,
      expect.anything(),
      expect.anything(),
      { config: config() },
    );
    expect(workspaceState.value()[0]).toMatchObject({
      sourceFile: 'docs/spec.md',
      outputFile: 'docs/spec.pdf',
      source: { kind: 'profile', profileName: 'Decision A5' },
      settings: {
        pageFormat: 'A5',
        stylePreset: 'minimal',
        securityMode: 'block-all',
        includeBookmarks: false,
        includePdfIndex: true,
      },
    });
  });

  it('does not save a snapshot when PDF export fails', async () => {
    const workspaceState = memento();
    exportToPdfMock.mockRejectedValue(new Error('render failed'));

    await exportPdfCommand({ workspaceState, globalState: memento() } as any);

    expect(workspaceState.update).not.toHaveBeenCalled();
    expect(mocks.showErrorMessage).toHaveBeenCalledWith(
      expect.stringContaining('render failed'),
    );
  });
});
