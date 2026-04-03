import * as vscode from 'vscode';
import { getConfig } from '../infra/config';
import { validateEnvironment } from './validateEnvironmentCore';

export async function validateEnvironmentCommand(context: vscode.ExtensionContext): Promise<void> {
  const cfg = getConfig();
  const validation = await validateEnvironment(cfg, context.extensionPath);

  const message = `Markdown Studio environment validation:\n${validation.lines.join('\n')}`;
  if (validation.ok) {
    void vscode.window.showInformationMessage(message);
  } else {
    void vscode.window.showWarningMessage(message);
  }
}
