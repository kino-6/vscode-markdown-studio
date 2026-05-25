import * as vscode from 'vscode';
import type { ExportProfile } from '../types/models';
import { CONFIG_KEYS, CONFIG_SECTION } from '../infra/configurationRegistry';
import { getConfiguredExportProfiles } from '../infra/exportProfiles';
import { RUNTIME_MESSAGES } from '../infra/messages';

interface ExportProfileQuickPickItem extends vscode.QuickPickItem {
  profile: ExportProfile;
}

function defaultFilename(profile: ExportProfile): string {
  return `${profile.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'export-profile'}.json`;
}

async function writeProfileJson(profile: ExportProfile): Promise<void> {
  const uri = await vscode.window.showSaveDialog({
    defaultUri: vscode.Uri.file(defaultFilename(profile)),
    filters: { JSON: ['json'] },
    title: 'Export Markdown Studio Export Profile',
  });

  if (!uri) return;

  const json = `${JSON.stringify(profile, null, 2)}\n`;
  await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(json));
  void vscode.window.showInformationMessage(RUNTIME_MESSAGES.exportProfiles.exported(profile.name));
}

function showProfileWarnings(warnings: string[]): void {
  for (const warning of warnings) {
    void vscode.window.showWarningMessage(`Markdown Studio: ${warning}`);
  }
}

async function pickProfile(profiles: ExportProfile[]): Promise<ExportProfile | undefined> {
  const selected = await vscode.window.showQuickPick<ExportProfileQuickPickItem>(
    profiles.map(profile => ({
      label: profile.name,
      description: [
        profile.pageFormat,
        profile.stylePreset,
        profile.securityMode,
      ].filter(Boolean).join(' · '),
      profile,
    })),
    { placeHolder: RUNTIME_MESSAGES.exportProfiles.selectPlaceholder },
  );

  return selected?.profile;
}

export async function exportProfileToJsonCommand(): Promise<void> {
  const cfg = vscode.workspace.getConfiguration(CONFIG_SECTION);
  const { profiles, warnings } = getConfiguredExportProfiles(cfg);

  showProfileWarnings(warnings);

  if (profiles.length === 0) {
    void vscode.window.showWarningMessage(RUNTIME_MESSAGES.exportProfiles.noProfiles);
    return;
  }

  const profile = await pickProfile(profiles);
  if (!profile) return;

  try {
    await writeProfileJson(profile);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    void vscode.window.showErrorMessage(RUNTIME_MESSAGES.exportProfiles.exportFailed(message));
  }
}

export async function exportActiveProfileToJsonCommand(): Promise<void> {
  const cfg = vscode.workspace.getConfiguration(CONFIG_SECTION);
  const { profiles, warnings } = getConfiguredExportProfiles(cfg);
  showProfileWarnings(warnings);

  if (profiles.length === 0) {
    void vscode.window.showWarningMessage(RUNTIME_MESSAGES.exportProfiles.noProfiles);
    return;
  }

  const activeName = cfg.get<string>(CONFIG_KEYS.activeExportProfile, '').trim();
  const matches = activeName
    ? profiles.filter(candidate => candidate.name === activeName)
    : [];
  let profile: ExportProfile | undefined = matches[0];

  if (matches.length > 1) {
    void vscode.window.showWarningMessage(`Markdown Studio: Multiple export profiles named "${activeName}" were found. Using the first match.`);
  }

  if (activeName && !profile) {
    void vscode.window.showWarningMessage(RUNTIME_MESSAGES.exportProfiles.activeProfileMissing(activeName));
  }

  if (!profile) {
    profile = await pickProfile(profiles);
    if (!profile) return;
  }

  try {
    await writeProfileJson(profile);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    void vscode.window.showErrorMessage(RUNTIME_MESSAGES.exportProfiles.exportFailed(message));
  }
}
