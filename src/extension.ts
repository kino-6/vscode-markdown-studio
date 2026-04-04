import * as vscode from 'vscode';
import { exportPdfCommand } from './commands/exportPdf';
import { openPreviewCommand } from './commands/openPreview';
import { validateEnvironmentCommand } from './commands/validateEnvironment';
import { cleanupTempFiles } from './infra/tempFiles';
import { DependencyManager } from './deps/dependencyManager';
import type { DependencyStatus } from './deps/types';
import { destroyPreviewPanel } from './preview/webviewPanel';

/** Module-level dependency status, accessible by other modules if needed. */
export let dependencyStatus: DependencyStatus | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const depManager = new DependencyManager();

  // Attempt automatic dependency setup — wrapped in try/catch so the
  // extension still activates even if something unexpected happens.
  try {
    dependencyStatus = await depManager.ensureAll(context);

    if (!dependencyStatus.allReady) {
      vscode.window.showWarningMessage(
        `Markdown Studio: Some dependencies failed to install. ` +
        `${dependencyStatus.errors.join('; ')}. ` +
        `Run "Markdown Studio: Setup Dependencies" to retry.`
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    dependencyStatus = { allReady: false, errors: [message] };
    vscode.window.showWarningMessage(
      `Markdown Studio: Dependency setup failed. ${message}. ` +
      `Run "Markdown Studio: Setup Dependencies" to retry.`
    );
  }

  context.subscriptions.push(
    vscode.commands.registerCommand('markdownStudio.openPreview', async () => openPreviewCommand(context)),
    vscode.commands.registerCommand('markdownStudio.exportPdf', async () => exportPdfCommand(context)),
    vscode.commands.registerCommand('markdownStudio.validateEnvironment', async () => validateEnvironmentCommand(context)),
    vscode.commands.registerCommand('markdownStudio.reloadPreview', async () => {
      destroyPreviewPanel();
      await openPreviewCommand(context);
    }),
    vscode.commands.registerCommand('markdownStudio.setupDependencies', async () => {
      try {
        const status = await depManager.reinstall(context);
        dependencyStatus = status;
        if (status.allReady) {
          vscode.window.showInformationMessage('Markdown Studio: All dependencies installed successfully.');
        } else {
          vscode.window.showWarningMessage(
            `Markdown Studio: Some dependencies failed to install. ${status.errors.join('; ')}.`
          );
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(
          `Markdown Studio: Dependency setup failed. ${message}`
        );
      }
    })
  );
}

export function deactivate(): void {
  cleanupTempFiles().catch(() => {});
}
