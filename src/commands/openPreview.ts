import * as vscode from 'vscode';
import { RUNTIME_MESSAGES } from '../infra/messages';
import { openOrRefreshPreview } from '../preview/webviewPanel';
import type { PreviewContentWidth } from '../types/models';

export interface OpenPreviewCommandOptions {
  location?: 'beside' | 'current';
  previewContentWidth?: PreviewContentWidth;
}

export async function openPreviewCommand(
  context: vscode.ExtensionContext,
  options: OpenPreviewCommandOptions = {}
): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== 'markdown') {
    void vscode.window.showWarningMessage(RUNTIME_MESSAGES.command.openMarkdownFirst);
    return;
  }

  const viewColumn = options.location === 'current'
    ? editor.viewColumn ?? vscode.ViewColumn.One
    : vscode.ViewColumn.Beside;

  await openOrRefreshPreview(context, editor.document, {
    viewColumn,
    previewContentWidth: options.previewContentWidth,
  });
}
