import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  showInformationMessage: vi.fn(),
  showWarningMessage: vi.fn(),
  showErrorMessage: vi.fn(),
  activeTextEditor: {
    document: {
      languageId: 'markdown',
      getText: () => '# Spec',
      uri: { fsPath: '/workspace/spec.md' },
    },
  },
}));

vi.mock('vscode', () => ({
  ProgressLocation: { Notification: 15 },
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

const saveCurrentSettingsExportMock = vi.hoisted(() => vi.fn());
vi.mock('../../src/infra/portableSettings', () => ({
  exportedSettingsMessage: (fsPath: string) => `settings saved: ${fsPath}`,
  saveCurrentSettingsExport: (...args: unknown[]) => saveCurrentSettingsExportMock(...args),
}));

import { exportPdfCommand } from '../../src/commands/exportPdf';

describe('exportPdfCommand settings export', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    exportToPdfMock.mockResolvedValue('/workspace/spec.pdf');
    saveCurrentSettingsExportMock.mockResolvedValue({
      uri: { fsPath: '/workspace/.vscode/markdown-studio-settings-20260528-123000.json' },
    });
  });

  it('exports current settings JSON after a successful PDF export', async () => {
    await exportPdfCommand({} as any);

    expect(exportToPdfMock).toHaveBeenCalledTimes(1);
    expect(saveCurrentSettingsExportMock).toHaveBeenCalledWith({ fallbackToSaveDialog: false });
    expect(mocks.showInformationMessage).toHaveBeenCalledWith(
      'settings saved: /workspace/.vscode/markdown-studio-settings-20260528-123000.json',
    );
  });

  it('does not export settings JSON when PDF export fails', async () => {
    exportToPdfMock.mockRejectedValue(new Error('render failed'));

    await exportPdfCommand({} as any);

    expect(saveCurrentSettingsExportMock).not.toHaveBeenCalled();
    expect(mocks.showErrorMessage).toHaveBeenCalledWith(
      expect.stringContaining('render failed'),
    );
  });
});
