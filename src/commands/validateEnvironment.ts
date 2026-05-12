import * as vscode from 'vscode';
import { dependencyStatus } from '../extension';
import { getConfig } from '../infra/config';
import { RUNTIME_MESSAGES } from '../infra/messages';
import { validateEnvironment } from './validateEnvironmentCore';

export async function validateEnvironmentCommand(context: vscode.ExtensionContext): Promise<void> {
  const cfg = getConfig();
  const validation = await validateEnvironment(cfg, context.extensionPath, {}, dependencyStatus);

  const message = RUNTIME_MESSAGES.validation.summary(validation.lines);
  if (validation.ok) {
    void vscode.window.showInformationMessage(message);
  } else {
    void vscode.window.showWarningMessage(message);
  }
}
