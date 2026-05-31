import * as vscode from 'vscode';
import { RUNTIME_MESSAGES } from '../infra/messages';
import { exportedSettingsMessage, saveCurrentSettingsExport } from '../infra/portableSettings';

function isJapaneseLocale(): boolean {
  return vscode.env.language.toLowerCase().startsWith('ja');
}

async function chooseSettingsName(): Promise<string | undefined> {
  const name = await vscode.window.showInputBox({
    title: isJapaneseLocale()
      ? 'Markdown Studio 設定のエクスポート'
      : 'Export Markdown Studio Settings',
    prompt: isJapaneseLocale()
      ? 'インポート時に表示する設定名を入力してください。'
      : 'Enter the settings name shown when importing.',
    value: 'Current Settings',
    ignoreFocusOut: true,
    validateInput(value) {
      return value.trim() === ''
        ? (isJapaneseLocale() ? '設定名を入力してください。' : 'Enter a settings name.')
        : undefined;
    },
  });

  return name?.trim();
}

export async function exportProfileToJsonCommand(): Promise<void> {
  try {
    const profileName = await chooseSettingsName();
    if (!profileName) return;

    const { uri } = await saveCurrentSettingsExport({
      fallbackToSaveDialog: true,
      kind: 'manual',
      profileName,
    });
    if (uri) {
      void vscode.window.showInformationMessage(exportedSettingsMessage(uri.fsPath));
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    void vscode.window.showErrorMessage(RUNTIME_MESSAGES.exportProfiles.exportFailed(message));
  }
}
