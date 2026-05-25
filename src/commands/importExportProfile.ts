import * as vscode from 'vscode';
import type { ExportProfile } from '../types/models';
import { CONFIG_KEYS, CONFIG_SECTION } from '../infra/configurationRegistry';
import { getConfiguredExportProfiles, normalizeExportProfile } from '../infra/exportProfiles';
import { RUNTIME_MESSAGES } from '../infra/messages';

interface TargetQuickPickItem extends vscode.QuickPickItem {
  target: vscode.ConfigurationTarget;
}

function parseProfileJson(text: string): ExportProfile[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(RUNTIME_MESSAGES.exportProfiles.invalidJson);
  }

  const candidates = (
    typeof parsed === 'object' &&
    parsed !== null &&
    !Array.isArray(parsed) &&
    Array.isArray((parsed as { profiles?: unknown }).profiles)
  )
    ? (parsed as { profiles: unknown[] }).profiles
    : [parsed];

  const profiles: ExportProfile[] = [];
  const issues: string[] = [];

  for (const candidate of candidates) {
    const result = normalizeExportProfile(candidate);
    issues.push(...result.warnings);
    if (result.profile) {
      profiles.push(result.profile);
    } else {
      issues.push(...result.errors);
    }
  }

  if (profiles.length === 0) {
    throw new Error(issues.join(' ') || 'No valid export profile found.');
  }

  for (const issue of issues) {
    void vscode.window.showWarningMessage(`Markdown Studio: ${issue}`);
  }

  return profiles;
}

async function chooseTarget(): Promise<vscode.ConfigurationTarget | undefined> {
  const hasWorkspace = Boolean(vscode.workspace.workspaceFolders?.length);
  if (!hasWorkspace) {
    return vscode.ConfigurationTarget.Global;
  }

  const items: TargetQuickPickItem[] = [
    {
      label: RUNTIME_MESSAGES.exportProfiles.workspaceSettings,
      description: 'Share with this workspace',
      target: vscode.ConfigurationTarget.Workspace,
    },
    {
      label: RUNTIME_MESSAGES.exportProfiles.userSettings,
      description: 'Use across workspaces',
      target: vscode.ConfigurationTarget.Global,
    },
  ];

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: RUNTIME_MESSAGES.exportProfiles.importTargetPlaceholder,
  });

  return selected?.target;
}

async function upsertProfile(
  profiles: ExportProfile[],
  profile: ExportProfile,
): Promise<boolean> {
  const index = profiles.findIndex(existing => existing.name === profile.name);

  if (index >= 0) {
    const replacement = await vscode.window.showWarningMessage(
      RUNTIME_MESSAGES.exportProfiles.replaceExisting(profile.name),
      { modal: true },
      RUNTIME_MESSAGES.exportProfiles.replace,
    );
    if (replacement !== RUNTIME_MESSAGES.exportProfiles.replace) {
      return false;
    }
    profiles[index] = profile;
  } else {
    profiles.push(profile);
  }

  return true;
}

export async function importExportProfileCommand(): Promise<void> {
  const selectedFiles = await vscode.window.showOpenDialog({
    canSelectFiles: true,
    canSelectFolders: false,
    canSelectMany: false,
    filters: { JSON: ['json'] },
    title: 'Import Markdown Studio Export Profile',
  });

  const uri = selectedFiles?.[0];
  if (!uri) return;

  try {
    const bytes = await vscode.workspace.fs.readFile(uri);
    const text = new TextDecoder('utf-8').decode(bytes);
    const importedProfiles = parseProfileJson(text);
    const target = await chooseTarget();
    if (target === undefined) return;

    const cfg = vscode.workspace.getConfiguration(CONFIG_SECTION);
    const profiles = getConfiguredExportProfiles(cfg).profiles;
    let importedCount = 0;

    for (const profile of importedProfiles) {
      if (await upsertProfile(profiles, profile)) {
        importedCount += 1;
        void vscode.window.showInformationMessage(RUNTIME_MESSAGES.exportProfiles.imported(profile.name));
      }
    }

    if (importedCount > 0) {
      await cfg.update(CONFIG_KEYS.exportProfiles, profiles, target);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    void vscode.window.showErrorMessage(RUNTIME_MESSAGES.exportProfiles.importFailed(message));
  }
}
