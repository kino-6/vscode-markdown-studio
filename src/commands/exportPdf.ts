import * as vscode from 'vscode';
import { exportToPdf, ProgressReporter, CancellationChecker, CancellationError } from '../export/exportPdf';
import { RUNTIME_MESSAGES } from '../infra/messages';
import { exportedSettingsMessage, saveCurrentSettingsExport } from '../infra/portableSettings';

async function saveSettingsSnapshotAfterPdfExport(): Promise<void> {
  try {
    const { uri } = await saveCurrentSettingsExport({ fallbackToSaveDialog: false, kind: 'pdf' });
    if (uri) {
      void vscode.window.showInformationMessage(exportedSettingsMessage(uri.fsPath));
    }
  } catch (err) {
    console.warn('[Markdown Studio] Failed to export settings JSON:', err instanceof Error ? err.message : String(err));
  }
}

export async function exportPdfCommand(
  context: vscode.ExtensionContext,
): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== 'markdown') {
    void vscode.window.showWarningMessage(RUNTIME_MESSAGES.command.openMarkdownFirst);
    return;
  }

  try {
    const outputPath = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: RUNTIME_MESSAGES.exportPdf.progressTitle,
        cancellable: true,
      },
      async (progress, token) => {
        const reporter: ProgressReporter = {
          report(message: string, increment?: number) {
            progress.report({ message, increment });
          },
        };
        const cancellation: CancellationChecker = {
          isCancelled() { return token.isCancellationRequested; },
        };
        return exportToPdf(editor.document, context, reporter, cancellation);
      }
    );
    void vscode.window.showInformationMessage(RUNTIME_MESSAGES.exportPdf.success(outputPath));
    await saveSettingsSnapshotAfterPdfExport();
  } catch (error) {
    if (error instanceof CancellationError) {
      void vscode.window.showInformationMessage(RUNTIME_MESSAGES.exportPdf.cancelled);
      return;
    }
    const msg = String(error);
    if (msg.includes('Executable doesn\'t exist') || msg.includes('browserType.launch')) {
      void vscode.window.showErrorMessage(RUNTIME_MESSAGES.dependencies.chromiumMissingAutomatic);
    } else {
      void vscode.window.showErrorMessage(RUNTIME_MESSAGES.exportPdf.failed(msg));
    }
  }
}
