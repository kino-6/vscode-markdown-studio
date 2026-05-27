import * as vscode from 'vscode';
import { RUNTIME_MESSAGES } from '../infra/messages';
import { exportedSettingsMessage, saveCurrentSettingsExport } from '../infra/portableSettings';

export async function exportProfileToJsonCommand(): Promise<void> {
  try {
    const { uri } = await saveCurrentSettingsExport({ fallbackToSaveDialog: true });
    if (uri) {
      void vscode.window.showInformationMessage(exportedSettingsMessage(uri.fsPath));
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    void vscode.window.showErrorMessage(RUNTIME_MESSAGES.exportProfiles.exportFailed(message));
  }
}
