import * as vscode from 'vscode';
import type { ExportProfile } from '../types/models';
import { CONFIG_KEYS, CONFIG_SECTION } from '../infra/configurationRegistry';
import { normalizeExportProfile } from '../infra/exportProfiles';
import { RUNTIME_MESSAGES } from '../infra/messages';
import { listWorkspaceSettingsExports, type PortableSettingsExportKind } from '../infra/portableSettings';

interface ProfileQuickPickItem extends vscode.QuickPickItem {
  profile: ExportProfile;
}

interface ImportSourceQuickPickItem extends vscode.QuickPickItem {
  uri?: vscode.Uri;
  profile?: ExportProfile;
  browse?: boolean;
}

interface ImportSourceSelection {
  uri: vscode.Uri;
  profile?: ExportProfile;
}

interface TargetQuickPickItem extends vscode.QuickPickItem {
  target: vscode.ConfigurationTarget;
}

const IMPORT_SETTING_MAPPINGS: Array<[keyof ExportProfile, string]> = [
  ['pageFormat', CONFIG_KEYS.pageFormat],
  ['stylePreset', CONFIG_KEYS.stylePreset],
  ['styleTheme', CONFIG_KEYS.styleTheme],
  ['fontFamily', CONFIG_KEYS.styleFontFamily],
  ['fontSize', CONFIG_KEYS.styleFontSize],
  ['lineHeight', CONFIG_KEYS.styleLineHeight],
  ['margin', CONFIG_KEYS.exportMargin],
  ['customCss', CONFIG_KEYS.styleCustomCss],
  ['securityMode', CONFIG_KEYS.externalResourceMode],
  ['allowedDomains', CONFIG_KEYS.externalResourceAllowedDomains],
  ['headerEnabled', CONFIG_KEYS.exportHeaderEnabled],
  ['headerTemplate', CONFIG_KEYS.exportHeaderTemplate],
  ['footerEnabled', CONFIG_KEYS.exportFooterEnabled],
  ['footerTemplate', CONFIG_KEYS.exportFooterTemplate],
  ['pageBreakEnabled', CONFIG_KEYS.exportPageBreakEnabled],
  ['includeBookmarks', CONFIG_KEYS.exportPdfBookmarksEnabled],
  ['includePdfIndex', CONFIG_KEYS.exportPdfIndexEnabled],
  ['pdfIndexTitle', CONFIG_KEYS.exportPdfIndexTitle],
  ['hidePdfToc', CONFIG_KEYS.exportPdfTocHidden],
  ['tocLevels', CONFIG_KEYS.tocLevels],
  ['tocOrderedList', CONFIG_KEYS.tocOrderedList],
  ['tocPageBreak', CONFIG_KEYS.tocPageBreak],
  ['codeBlockLineNumbers', CONFIG_KEYS.codeBlockLineNumbers],
  ['outputFilename', CONFIG_KEYS.exportOutputFilename],
];

function parseProfileJson(text: string, options: { showWarnings?: boolean } = {}): ExportProfile[] {
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

  if (options.showWarnings !== false) {
    for (const issue of issues) {
      void vscode.window.showWarningMessage(`Markdown Studio: ${issue}`);
    }
  }

  return profiles;
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

function sourceDescription(kind: PortableSettingsExportKind): string {
  if (kind === 'pdf') {
    return isJapaneseLocale() ? 'PDF エクスポート履歴' : 'PDF export history';
  }
  return isJapaneseLocale() ? '手動保存' : 'manual export';
}

function formatCreatedAt(createdAt: unknown): string | undefined {
  if (typeof createdAt !== 'string') return undefined;
  const time = Date.parse(createdAt);
  if (Number.isNaN(time)) return undefined;
  return new Date(time).toISOString().slice(0, 10);
}

function profileDescription(
  profile: ExportProfile,
  kind: PortableSettingsExportKind,
): string {
  return [
    profile.pageFormat,
    profile.stylePreset,
    profile.securityMode,
    sourceDescription(profile.source === 'pdf-export' ? 'pdf' : kind),
    formatCreatedAt(profile.createdAt),
  ].filter(Boolean).join(' · ');
}

async function readProfilesFromUri(
  uri: vscode.Uri,
  options: { showWarnings?: boolean } = {},
): Promise<ExportProfile[]> {
  const bytes = await vscode.workspace.fs.readFile(uri);
  const text = new TextDecoder('utf-8').decode(bytes);
  return parseProfileJson(text, options);
}

async function recentImportItems(): Promise<ImportSourceQuickPickItem[]> {
  const recentFiles = await listWorkspaceSettingsExports();
  const items: ImportSourceQuickPickItem[] = [];

  for (const file of recentFiles) {
    let profiles: ExportProfile[];
    try {
      profiles = await readProfilesFromUri(file.uri, { showWarnings: false });
    } catch {
      continue;
    }

    for (const profile of profiles) {
      items.push({
        label: profile.name,
        description: profileDescription(profile, file.kind),
        detail: basename(file.uri.fsPath),
        uri: file.uri,
        profile,
      });
    }
  }

  return items;
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

async function chooseImportSource(): Promise<ImportSourceSelection | undefined> {
  const recentItems = await recentImportItems();
  if (recentItems.length === 0) {
    const uri = await chooseFileWithOpenDialog();
    return uri ? { uri } : undefined;
  }

  const selected = await vscode.window.showQuickPick<ImportSourceQuickPickItem>(
    [
      ...recentItems,
      {
        label: browseLabel(),
        browse: true,
      },
    ],
    { placeHolder: RUNTIME_MESSAGES.exportProfiles.importSourcePlaceholder },
  );

  if (!selected) return undefined;
  if (selected.browse) {
    const uri = await chooseFileWithOpenDialog();
    return uri ? { uri } : undefined;
  }
  if (!selected.uri) return undefined;
  return { uri: selected.uri, profile: selected.profile };
}

async function chooseProfileFromFile(selection: ImportSourceSelection): Promise<ExportProfile | undefined> {
  if (selection.profile) return selection.profile;

  const profiles = await readProfilesFromUri(selection.uri);
  return chooseProfile(profiles);
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

  for (const [profileKey, configKey] of IMPORT_SETTING_MAPPINGS) {
    const value = profile[profileKey];
    if (value !== undefined) {
      updates.push([configKey, value]);
    }
  }

  for (const [key, value] of updates) {
    await cfg.update(key, value, target);
  }
}

export async function importExportProfileCommand(): Promise<void> {
  const selection = await chooseImportSource();
  if (!selection) return;

  try {
    const profile = await chooseProfileFromFile(selection);
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
