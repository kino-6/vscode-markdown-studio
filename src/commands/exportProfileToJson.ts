import * as vscode from 'vscode';
import { getExportConfig } from '../infra/config';
import { RUNTIME_MESSAGES } from '../infra/messages';
import type { ExportProfile } from '../types/models';

function currentSettingsProfile(): ExportProfile {
  const cfg = getExportConfig();
  return {
    schemaVersion: 1,
    name: 'Current Settings',
    pageFormat: cfg.pageFormat,
    stylePreset: cfg.style.presetName,
    securityMode: cfg.externalResources.mode,
    includeBookmarks: cfg.pdfBookmarks.enabled,
    includePdfIndex: cfg.pdfIndex.enabled,
  };
}

export async function exportProfileToJsonCommand(): Promise<void> {
  const uri = await vscode.window.showSaveDialog({
    defaultUri: vscode.Uri.file('markdown-studio-settings.json'),
    filters: { JSON: ['json'] },
    title: 'Export Markdown Studio Settings',
  });

  if (!uri) return;

  try {
    const profile = currentSettingsProfile();
    const json = `${JSON.stringify(profile, null, 2)}\n`;
    await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(json));
    void vscode.window.showInformationMessage(RUNTIME_MESSAGES.exportProfiles.exportedSettings);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    void vscode.window.showErrorMessage(RUNTIME_MESSAGES.exportProfiles.exportFailed(message));
  }
}
