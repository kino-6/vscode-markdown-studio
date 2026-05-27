import * as vscode from 'vscode';
import { getExportConfig } from './config';
import type { ExportProfile } from '../types/models';

const SETTINGS_FILE_PREFIX = 'markdown-studio-settings-';
const SETTINGS_FILE_SUFFIX = '.json';
const SETTINGS_FILE_KEEP = 3;

export interface SaveCurrentSettingsExportOptions {
  fallbackToSaveDialog: boolean;
}

export interface SaveCurrentSettingsExportResult {
  uri?: vscode.Uri;
}

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

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function timestamp(date = new Date()): string {
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    '-',
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join('');
}

function isSettingsFile(name: string): boolean {
  return name.startsWith(SETTINGS_FILE_PREFIX) && name.endsWith(SETTINGS_FILE_SUFFIX);
}

function workspaceVscodeDir(): vscode.Uri | undefined {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) return undefined;
  return vscode.Uri.joinPath(workspaceFolder.uri, '.vscode');
}

export function exportedSettingsMessage(fsPath: string): string {
  return vscode.env.language.toLowerCase().startsWith('ja')
    ? `Markdown Studio: 設定を書き出しました: ${fsPath}`
    : `Markdown Studio: Exported settings to ${fsPath}`;
}

async function chooseFallbackSaveUri(): Promise<vscode.Uri | undefined> {
  return vscode.window.showSaveDialog({
    defaultUri: vscode.Uri.file('markdown-studio-settings.json'),
    filters: { JSON: ['json'] },
    title: 'Export Markdown Studio Settings',
  });
}

async function workspaceSettingsUri(): Promise<vscode.Uri | undefined> {
  const vscodeDir = workspaceVscodeDir();
  if (!vscodeDir) return undefined;

  await vscode.workspace.fs.createDirectory(vscodeDir);
  return vscode.Uri.joinPath(vscodeDir, `${SETTINGS_FILE_PREFIX}${timestamp()}${SETTINGS_FILE_SUFFIX}`);
}

async function pruneOldWorkspaceSettingsFiles(savedUri: vscode.Uri): Promise<void> {
  const vscodeDir = workspaceVscodeDir();
  if (!vscodeDir) return;

  let entries: [string, vscode.FileType][];
  try {
    entries = await vscode.workspace.fs.readDirectory(vscodeDir);
  } catch {
    return;
  }

  const files = entries
    .filter(([name, type]) => type === vscode.FileType.File && isSettingsFile(name))
    .map(([name]) => vscode.Uri.joinPath(vscodeDir, name))
    .concat(savedUri)
    .filter((uri, index, all) => all.findIndex(candidate => candidate.fsPath === uri.fsPath) === index)
    .sort((a, b) => b.fsPath.localeCompare(a.fsPath));

  for (const stale of files.slice(SETTINGS_FILE_KEEP)) {
    if (stale.fsPath !== savedUri.fsPath) {
      await vscode.workspace.fs.delete(stale);
    }
  }
}

export async function saveCurrentSettingsExport(
  options: SaveCurrentSettingsExportOptions,
): Promise<SaveCurrentSettingsExportResult> {
  const uri = await workspaceSettingsUri() ?? (options.fallbackToSaveDialog ? await chooseFallbackSaveUri() : undefined);
  if (!uri) return {};

  const profile = currentSettingsProfile();
  const json = `${JSON.stringify(profile, null, 2)}\n`;
  await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(json));
  await pruneOldWorkspaceSettingsFiles(uri);

  return { uri };
}
