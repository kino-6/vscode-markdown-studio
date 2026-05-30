import * as vscode from 'vscode';
import { getExportConfig } from './config';
import type { ExportProfile } from '../types/models';

const MANUAL_SETTINGS_FILE_PREFIX = 'markdown-studio-settings-';
const PDF_SETTINGS_FILE_PREFIX = 'markdown-studio-pdf-settings-';
const SETTINGS_FILE_SUFFIX = '.json';
const SETTINGS_FILE_KEEP = 3;

export type PortableSettingsExportKind = 'manual' | 'pdf';

export interface WorkspaceSettingsExportFile {
  uri: vscode.Uri;
  kind: PortableSettingsExportKind;
}

export interface SaveCurrentSettingsExportOptions {
  fallbackToSaveDialog: boolean;
  kind: PortableSettingsExportKind;
}

export interface SaveCurrentSettingsExportResult {
  uri?: vscode.Uri;
}

function profileSource(kind: PortableSettingsExportKind): ExportProfile['source'] {
  return kind === 'pdf' ? 'pdf-export' : 'manual-export';
}

function currentSettingsProfile(kind: PortableSettingsExportKind, date: Date): ExportProfile {
  const cfg = getExportConfig();
  return {
    schemaVersion: 1,
    name: 'Current Settings',
    createdAt: date.toISOString(),
    source: profileSource(kind),
    pageFormat: cfg.pageFormat,
    stylePreset: cfg.style.presetName,
    securityMode: cfg.externalResources.mode,
    allowedDomains: cfg.externalResources.allowedDomains,
    styleTheme: cfg.theme,
    fontFamily: cfg.style.fontFamily,
    fontSize: cfg.style.fontSize,
    lineHeight: cfg.style.lineHeight,
    margin: cfg.style.margin,
    customCss: cfg.customCss,
    headerEnabled: cfg.pdfHeaderFooter.headerEnabled,
    headerTemplate: cfg.pdfHeaderFooter.headerTemplate,
    footerEnabled: cfg.pdfHeaderFooter.footerEnabled,
    footerTemplate: cfg.pdfHeaderFooter.footerTemplate,
    pageBreakEnabled: cfg.pdfHeaderFooter.pageBreakEnabled,
    includeBookmarks: cfg.pdfBookmarks.enabled,
    includePdfIndex: cfg.pdfIndex.enabled,
    pdfIndexTitle: cfg.pdfIndex.title,
    hidePdfToc: cfg.pdfToc.hidden,
    tocLevels: `${cfg.toc.minLevel}-${cfg.toc.maxLevel}`,
    tocOrderedList: cfg.toc.orderedList,
    tocPageBreak: cfg.toc.pageBreak,
    codeBlockLineNumbers: cfg.codeBlock.lineNumbers,
    outputFilename: cfg.outputFilename,
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

function settingsFilePrefix(kind: PortableSettingsExportKind): string {
  return kind === 'pdf' ? PDF_SETTINGS_FILE_PREFIX : MANUAL_SETTINGS_FILE_PREFIX;
}

function settingsFileKind(name: string): PortableSettingsExportKind | undefined {
  if (!name.endsWith(SETTINGS_FILE_SUFFIX)) return undefined;
  if (name.startsWith(PDF_SETTINGS_FILE_PREFIX)) return 'pdf';
  if (name.startsWith(MANUAL_SETTINGS_FILE_PREFIX)) return 'manual';
  return undefined;
}

function settingsFileTimestamp(name: string): string {
  const kind = settingsFileKind(name);
  if (!kind) return '';
  return name
    .slice(settingsFilePrefix(kind).length, -SETTINGS_FILE_SUFFIX.length);
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

async function workspaceSettingsUri(
  kind: PortableSettingsExportKind,
  date: Date,
): Promise<vscode.Uri | undefined> {
  const vscodeDir = workspaceVscodeDir();
  if (!vscodeDir) return undefined;

  await vscode.workspace.fs.createDirectory(vscodeDir);
  return vscode.Uri.joinPath(
    vscodeDir,
    `${settingsFilePrefix(kind)}${timestamp(date)}${SETTINGS_FILE_SUFFIX}`,
  );
}

async function pruneOldWorkspaceSettingsFiles(
  savedUri: vscode.Uri,
  kind: PortableSettingsExportKind,
): Promise<void> {
  const vscodeDir = workspaceVscodeDir();
  if (!vscodeDir) return;

  let entries: [string, vscode.FileType][];
  try {
    entries = await vscode.workspace.fs.readDirectory(vscodeDir);
  } catch {
    return;
  }

  const files = entries
    .filter(([name, type]) => type === vscode.FileType.File && settingsFileKind(name) === kind)
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

export async function listWorkspaceSettingsExports(): Promise<WorkspaceSettingsExportFile[]> {
  const vscodeDir = workspaceVscodeDir();
  if (!vscodeDir) return [];

  let entries: [string, vscode.FileType][];
  try {
    entries = await vscode.workspace.fs.readDirectory(vscodeDir);
  } catch {
    return [];
  }

  return entries
    .flatMap(([name, type]) => {
      if (type !== vscode.FileType.File) return [];
      const kind = settingsFileKind(name);
      if (!kind) return [];
      return [{ uri: vscode.Uri.joinPath(vscodeDir, name), kind, createdKey: settingsFileTimestamp(name) }];
    })
    .sort((a, b) => b.createdKey.localeCompare(a.createdKey))
    .map(({ uri, kind }) => ({ uri, kind }));
}

export async function saveCurrentSettingsExport(
  options: SaveCurrentSettingsExportOptions,
): Promise<SaveCurrentSettingsExportResult> {
  const createdAt = new Date();
  const uri = await workspaceSettingsUri(options.kind, createdAt)
    ?? (options.fallbackToSaveDialog ? await chooseFallbackSaveUri() : undefined);
  if (!uri) return {};

  const profile = currentSettingsProfile(options.kind, createdAt);
  const json = `${JSON.stringify(profile, null, 2)}\n`;
  await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(json));
  if (options.kind === 'pdf') {
    await pruneOldWorkspaceSettingsFiles(uri, options.kind);
  }

  return { uri };
}
