import * as path from 'node:path';
import * as vscode from 'vscode';
import { exportPdfCommand } from './exportPdf';
import { CONFIG_KEYS, CONFIG_SECTION } from '../infra/configurationRegistry';
import { loadExportSnapshots } from '../infra/exportSnapshots';
import { getConfiguredExportProfiles } from '../infra/exportProfiles';
import { RUNTIME_MESSAGES } from '../infra/messages';
import type { ExportConfigOverlay, ExportProfile, ExportSettingSource } from '../types/models';

interface ExportSettingQuickPickItem extends vscode.QuickPickItem {
  source?: ExportSettingSource;
  overlay?: ExportConfigOverlay;
}

function profileDescription(profile: ExportProfile | ExportConfigOverlay): string {
  return [
    profile.pageFormat,
    profile.stylePreset,
    profile.securityMode,
  ].filter(Boolean).join(' / ');
}

function showProfileWarnings(warnings: string[]): void {
  for (const warning of warnings) {
    void vscode.window.showWarningMessage(`Markdown Studio: ${warning}`);
  }
}

function snapshotLabel(createdAt: string, sourceFile: string): string {
  const date = new Date(createdAt);
  const timestamp = Number.isNaN(date.getTime())
    ? createdAt
    : date.toLocaleString(undefined, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  return `${timestamp} - ${path.basename(sourceFile) || sourceFile}`;
}

function buildQuickPickItems(context: vscode.ExtensionContext): ExportSettingQuickPickItem[] {
  const cfg = vscode.workspace.getConfiguration(CONFIG_SECTION);
  const { profiles, warnings } = getConfiguredExportProfiles(cfg);
  showProfileWarnings(warnings);

  const snapshots = loadExportSnapshots(context);
  const items: ExportSettingQuickPickItem[] = [];

  if (profiles.length > 0) {
    items.push({ label: RUNTIME_MESSAGES.exportSettings.profilesSection, kind: vscode.QuickPickItemKind.Separator });
    for (const profile of profiles) {
      items.push({
        label: profile.name,
        description: profileDescription(profile),
        source: { kind: 'profile', profileName: profile.name },
        overlay: profile,
      });
    }
  }

  if (snapshots.length > 0) {
    items.push({ label: RUNTIME_MESSAGES.exportSettings.snapshotsSection, kind: vscode.QuickPickItemKind.Separator });
    for (const snapshot of snapshots) {
      items.push({
        label: snapshotLabel(snapshot.createdAt, snapshot.sourceFile),
        description: profileDescription(snapshot.settings),
        detail: snapshot.sourceFile,
        source: { kind: 'snapshot', snapshotId: snapshot.id },
        overlay: snapshot.settings,
      });
    }
  }

  items.push(
    { label: RUNTIME_MESSAGES.exportSettings.otherSection, kind: vscode.QuickPickItemKind.Separator },
    {
      label: RUNTIME_MESSAGES.exportSettings.currentSettings,
      description: RUNTIME_MESSAGES.exportSettings.currentSettingsDescription,
      source: { kind: 'current' },
    },
  );

  return items;
}

export async function exportPdfWithSettingCommand(context: vscode.ExtensionContext): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== 'markdown') {
    void vscode.window.showWarningMessage(RUNTIME_MESSAGES.command.openMarkdownFirst);
    return;
  }

  const selected = await vscode.window.showQuickPick(buildQuickPickItems(context), {
    placeHolder: RUNTIME_MESSAGES.exportSettings.selectPlaceholder,
  });

  if (!selected?.source) return;

  await exportPdfCommand(context, {
    overlay: selected.overlay,
    source: selected.source,
  });
}

function defaultConfigurationTarget(): vscode.ConfigurationTarget {
  return vscode.workspace.workspaceFolders?.length
    ? vscode.ConfigurationTarget.Workspace
    : vscode.ConfigurationTarget.Global;
}

async function upsertProfile(profile: ExportProfile, target: vscode.ConfigurationTarget): Promise<boolean> {
  const cfg = vscode.workspace.getConfiguration(CONFIG_SECTION);
  const profiles = getConfiguredExportProfiles(cfg).profiles;
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

  await cfg.update(CONFIG_KEYS.exportProfiles, profiles, target);
  return true;
}

function defaultProfileNameForSnapshot(sourceFile: string, createdAt: string): string {
  const basename = path.basename(sourceFile, path.extname(sourceFile));
  return `${basename} ${createdAt.slice(0, 10)}`.trim();
}

export async function saveSnapshotAsProfileCommand(context: vscode.ExtensionContext): Promise<void> {
  const snapshots = loadExportSnapshots(context);
  if (snapshots.length === 0) {
    void vscode.window.showWarningMessage(RUNTIME_MESSAGES.exportSettings.noSnapshots);
    return;
  }

  const selected = await vscode.window.showQuickPick(
    snapshots.map(snapshot => ({
      label: snapshotLabel(snapshot.createdAt, snapshot.sourceFile),
      description: profileDescription(snapshot.settings),
      detail: snapshot.sourceFile,
      snapshot,
    })),
    { placeHolder: RUNTIME_MESSAGES.exportSettings.selectSnapshotPlaceholder },
  );
  if (!selected) return;

  const name = await vscode.window.showInputBox({
    prompt: RUNTIME_MESSAGES.exportSettings.profileNamePrompt,
    value: defaultProfileNameForSnapshot(selected.snapshot.sourceFile, selected.snapshot.createdAt),
  });
  if (!name?.trim()) return;

  const profile: ExportProfile = {
    schemaVersion: 1,
    name: name.trim(),
    ...selected.snapshot.settings,
  };

  if (await upsertProfile(profile, defaultConfigurationTarget())) {
    void vscode.window.showInformationMessage(RUNTIME_MESSAGES.exportSettings.snapshotPromoted(profile.name));
  }
}
