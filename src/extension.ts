import * as vscode from 'vscode';
import { exportPdfCommand } from './commands/exportPdf';
import { openPreviewCommand } from './commands/openPreview';
import { validateEnvironmentCommand } from './commands/validateEnvironment';
import { cleanupTempFiles } from './infra/tempFiles';

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('markdownStudio.openPreview', async () => openPreviewCommand(context)),
    vscode.commands.registerCommand('markdownStudio.exportPdf', async () => exportPdfCommand(context)),
    vscode.commands.registerCommand('markdownStudio.validateEnvironment', async () => validateEnvironmentCommand(context))
  );
}

export function deactivate(): void {
  cleanupTempFiles().catch(() => {});
}
