import * as vscode from 'vscode';
import { RUNTIME_MESSAGES } from '../infra/messages';
import { openOrRefreshPreview } from '../preview/webviewPanel';

export async function openPreviewCommand(context: vscode.ExtensionContext): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== 'markdown') {
    void vscode.window.showWarningMessage(RUNTIME_MESSAGES.command.openMarkdownFirst);
    return;
  }

  await openOrRefreshPreview(context, editor.document);
}
