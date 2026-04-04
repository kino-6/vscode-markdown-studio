import * as vscode from 'vscode';
import { exportToPdf } from '../export/exportPdf';

export async function exportPdfCommand(context: vscode.ExtensionContext): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== 'markdown') {
    void vscode.window.showWarningMessage('Markdown Studio: Open a Markdown file first.');
    return;
  }

  try {
    const path = await exportToPdf(editor.document, context);
    void vscode.window.showInformationMessage(`Markdown Studio: Exported PDF to ${path}`);
  } catch (error) {
    const msg = String(error);
    if (msg.includes('Executable doesn\'t exist') || msg.includes('browserType.launch')) {
      void vscode.window.showErrorMessage(
        'Markdown Studio: Chromium browser not found. Run `npx playwright install chromium` in your terminal, then try again.'
      );
    } else {
      void vscode.window.showErrorMessage(`Markdown Studio PDF export failed: ${msg}`);
    }
  }
}
