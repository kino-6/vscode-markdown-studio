import * as vscode from 'vscode';
import { exportToPdf, ProgressReporter, CancellationChecker, CancellationError } from '../export/exportPdf';

export async function exportPdfCommand(context: vscode.ExtensionContext): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== 'markdown') {
    void vscode.window.showWarningMessage('Markdown Studio: Open a Markdown file first.');
    return;
  }

  try {
    const outputPath = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Markdown Studio: Exporting PDF',
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
    void vscode.window.showInformationMessage(`Markdown Studio: Exported PDF to ${outputPath}`);
  } catch (error) {
    if (error instanceof CancellationError) {
      void vscode.window.showInformationMessage('Markdown Studio: Export cancelled.');
      return;
    }
    const msg = String(error);
    if (msg.includes('Executable doesn\'t exist') || msg.includes('browserType.launch')) {
      void vscode.window.showErrorMessage(
        "Markdown Studio: Chromium is not installed. Run 'Markdown Studio: Setup Dependencies' to install it automatically."
      );
    } else {
      void vscode.window.showErrorMessage(`Markdown Studio PDF export failed: ${msg}`);
    }
  }
}
