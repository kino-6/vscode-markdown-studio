import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  showInformationMessage: vi.fn(),
  showWarningMessage: vi.fn(),
  showErrorMessage: vi.fn(),
  executeCommand: vi.fn(),
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
  Uri: {
    file: (fsPath: string) => ({ fsPath }),
  },
  env: {
    language: 'en',
  },
  commands: {
    executeCommand: (...args: unknown[]) => mocks.executeCommand(...args),
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
      uri: { fsPath: '/workspace/.vscode/markdown-studio-pdf-settings-20260528-123000.json' },
    });
  });

  it('exports current settings JSON after a successful PDF export', async () => {
    await exportPdfCommand({} as any);

    expect(exportToPdfMock).toHaveBeenCalledTimes(1);
    expect(saveCurrentSettingsExportMock).toHaveBeenCalledWith({ fallbackToSaveDialog: false, kind: 'pdf' });
    expect(mocks.showInformationMessage).toHaveBeenCalledWith(
      'Markdown Studio: Exported PDF to /workspace/spec.pdf',
      'Open PDF',
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

  it('offers to download Chromium when it is missing and retries the export after consent', async () => {
    exportToPdfMock
      .mockRejectedValueOnce(new Error("browserType.launch: Executable doesn't exist"))
      .mockResolvedValueOnce('/workspace/spec.pdf');
    mocks.showInformationMessage.mockResolvedValue(undefined);
    const offerChromiumDownload = vi.fn().mockResolvedValue(true);

    await exportPdfCommand({} as any, { offerChromiumDownload });

    expect(offerChromiumDownload).toHaveBeenCalledTimes(1);
    expect(exportToPdfMock).toHaveBeenCalledTimes(2);
    expect(mocks.showErrorMessage).not.toHaveBeenCalled();
    expect(mocks.showInformationMessage).toHaveBeenCalledWith(expect.stringContaining('/workspace/spec.pdf'), 'Open PDF');
  });

  it('shows the setup hint and does not retry when the download is declined', async () => {
    exportToPdfMock.mockRejectedValue(new Error("browserType.launch: Executable doesn't exist"));
    const offerChromiumDownload = vi.fn().mockResolvedValue(false);

    await exportPdfCommand({} as any, { offerChromiumDownload });

    expect(exportToPdfMock).toHaveBeenCalledTimes(1);
    expect(mocks.showErrorMessage).toHaveBeenCalledWith(expect.stringContaining('Setup Dependencies'));
  });

  it('offers the download only once even if the retry still fails', async () => {
    exportToPdfMock.mockRejectedValue(new Error("browserType.launch: Executable doesn't exist"));
    const offerChromiumDownload = vi.fn().mockResolvedValue(true);

    await exportPdfCommand({} as any, { offerChromiumDownload });

    expect(offerChromiumDownload).toHaveBeenCalledTimes(1);
    expect(exportToPdfMock).toHaveBeenCalledTimes(2);
  });
});
