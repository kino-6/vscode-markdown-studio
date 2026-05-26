import * as vscode from 'vscode';
import type { ExportProfile } from '../types/models';
import { CONFIG_KEYS, CONFIG_SECTION } from '../infra/configurationRegistry';
import { normalizeExportProfile } from '../infra/exportProfiles';
import { RUNTIME_MESSAGES } from '../infra/messages';

const SETTINGS_FILE_PREFIX = 'markdown-studio-settings-';
const SETTINGS_FILE_SUFFIX = '.json';

interface ProfileQuickPickItem extends vscode.QuickPickItem {
  profile: ExportProfile;
}

interface ImportSourceQuickPickItem extends vscode.QuickPickItem {
  uri?: vscode.Uri;
  browse?: boolean;
}

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
    throw new Error(issues.join(' ') || 'No valid Markdown Studio settings found.');
  }

  for (const issue of issues) {
    void vscode.window.showWarningMessage(`Markdown Studio: ${issue}`);
  }

  return profiles;
}

function isSettingsFile(name: string): boolean {
  return name.startsWith(SETTINGS_FILE_PREFIX) && name.endsWith(SETTINGS_FILE_SUFFIX);
}

function basename(fsPath: string): string {
  return fsPath.split(/[\\/]/).pop() ?? fsPath;
}

function isJapaneseLocale(): boolean {
  return vscode.env.language.toLowerCase().startsWith('ja');
}

function browseLabel(): string {
  return isJapaneseLocale() ? 'JSON ファイルを選択...' : 'Choose JSON File...';
}

async function chooseProfile(profiles: ExportProfile[]): Promise<ExportProfile | undefined> {
  if (profiles.length === 1) return profiles[0];

  const selected = await vscode.window.showQuickPick<ProfileQuickPickItem>(
    profiles.map(profile => ({
      label: profile.name,
      description: [
        profile.pageFormat,
        profile.stylePreset,
        profile.securityMode,
      ].filter(Boolean).join(' · '),
      profile,
    })),
    { placeHolder: RUNTIME_MESSAGES.exportProfiles.importProfilePlaceholder },
  );

  return selected?.profile;
}

async function chooseFileWithOpenDialog(): Promise<vscode.Uri | undefined> {
  const selectedFiles = await vscode.window.showOpenDialog({
    canSelectFiles: true,
    canSelectFolders: false,
    canSelectMany: false,
    filters: { JSON: ['json'] },
    title: 'Import Markdown Studio Settings',
  });

  return selectedFiles?.[0];
}

async function listWorkspaceSettingsFiles(): Promise<vscode.Uri[]> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) return [];

  const vscodeDir = vscode.Uri.joinPath(workspaceFolder.uri, '.vscode');
  let entries: [string, vscode.FileType][];
  try {
    entries = await vscode.workspace.fs.readDirectory(vscodeDir);
  } catch {
    return [];
  }

  return entries
    .filter(([name, type]) => type === vscode.FileType.File && isSettingsFile(name))
    .map(([name]) => vscode.Uri.joinPath(vscodeDir, name))
    .sort((a, b) => b.fsPath.localeCompare(a.fsPath));
}

async function chooseImportSource(): Promise<vscode.Uri | undefined> {
  const recentFiles = await listWorkspaceSettingsFiles();
  if (recentFiles.length === 0) {
    return chooseFileWithOpenDialog();
  }

  const selected = await vscode.window.showQuickPick<ImportSourceQuickPickItem>(
    [
      ...recentFiles.map(uri => ({
        label: basename(uri.fsPath),
        description: '.vscode',
        uri,
      })),
      {
        label: browseLabel(),
        browse: true,
      },
    ],
    { placeHolder: RUNTIME_MESSAGES.exportProfiles.importSourcePlaceholder },
  );

  if (!selected) return undefined;
  if (selected.browse) return chooseFileWithOpenDialog();
  return selected.uri;
}

async function chooseTarget(): Promise<vscode.ConfigurationTarget | undefined> {
  const hasWorkspace = Boolean(vscode.workspace.workspaceFolders?.length);
  if (!hasWorkspace) {
    return vscode.ConfigurationTarget.Global;
  }

  const items: TargetQuickPickItem[] = [
    {
      label: RUNTIME_MESSAGES.exportProfiles.workspaceSettings,
      description: 'Save to this workspace',
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

async function applyImportedSettings(
  profile: ExportProfile,
  target: vscode.ConfigurationTarget,
): Promise<void> {
  const cfg = vscode.workspace.getConfiguration(CONFIG_SECTION);
  const updates: Array<[string, unknown]> = [];

  if (profile.pageFormat !== undefined) {
    updates.push([CONFIG_KEYS.pageFormat, profile.pageFormat]);
  }
  if (profile.stylePreset !== undefined) {
    updates.push([CONFIG_KEYS.stylePreset, profile.stylePreset]);
  }
  if (profile.securityMode !== undefined) {
    updates.push([CONFIG_KEYS.externalResourceMode, profile.securityMode]);
  }
  if (profile.includeBookmarks !== undefined) {
    updates.push([CONFIG_KEYS.exportPdfBookmarksEnabled, profile.includeBookmarks]);
  }
  if (profile.includePdfIndex !== undefined) {
    updates.push([CONFIG_KEYS.exportPdfIndexEnabled, profile.includePdfIndex]);
  }

  for (const [key, value] of updates) {
    await cfg.update(key, value, target);
  }
}

export async function importExportProfileCommand(): Promise<void> {
  const uri = await chooseImportSource();
  if (!uri) return;

  try {
    const bytes = await vscode.workspace.fs.readFile(uri);
    const text = new TextDecoder('utf-8').decode(bytes);
    const profile = await chooseProfile(parseProfileJson(text));
    if (!profile) return;

    const target = await chooseTarget();
    if (target === undefined) return;

    await applyImportedSettings(profile, target);
    void vscode.window.showInformationMessage(RUNTIME_MESSAGES.exportProfiles.importedSettings(profile.name));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    void vscode.window.showErrorMessage(RUNTIME_MESSAGES.exportProfiles.importFailed(message));
  }
}
