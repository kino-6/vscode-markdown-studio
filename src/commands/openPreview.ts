import * as vscode from 'vscode';
import { openOrRefreshPreview } from '../preview/webviewPanel';

export async function openPreviewCommand(context: vscode.ExtensionContext): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== 'markdown') {
    void vscode.window.showWarningMessage('Markdown Studio: Open a Markdown file first.');
    return;
  }

  await openOrRefreshPreview(context, editor.document);
}
