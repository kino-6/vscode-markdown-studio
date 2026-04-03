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
    void vscode.window.showErrorMessage(`Markdown Studio PDF export failed: ${String(error)}`);
  }
}
