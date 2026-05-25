import * as path from 'node:path';
import * as vscode from 'vscode';
import type { ExportConfigOverlay, ExportSettingSource, ExportSnapshot } from '../types/models';
import type { MarkdownStudioConfig } from './config';

const SNAPSHOT_STORAGE_KEY = 'markdownStudio.exportSnapshots.v1';
export const EXPORT_SNAPSHOT_LIMIT = 20;

type SnapshotStorage = Pick<vscode.Memento, 'get' | 'update'>;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSettingSource(value: unknown): value is ExportSettingSource {
  if (!isObject(value) || typeof value.kind !== 'string') return false;
  if (value.kind === 'current') return true;
  if (value.kind === 'profile') return typeof value.profileName === 'string';
  if (value.kind === 'snapshot') return typeof value.snapshotId === 'string';
  return false;
}

function normalizeOverlay(value: unknown): ExportConfigOverlay {
  if (!isObject(value)) return {};
  const overlay: ExportConfigOverlay = {};

  if (typeof value.pageFormat === 'string') {
    overlay.pageFormat = value.pageFormat as ExportConfigOverlay['pageFormat'];
  }
  if (typeof value.stylePreset === 'string') {
    overlay.stylePreset = value.stylePreset as ExportConfigOverlay['stylePreset'];
  }
  if (typeof value.securityMode === 'string') {
    overlay.securityMode = value.securityMode as ExportConfigOverlay['securityMode'];
  }
  if (typeof value.includeBookmarks === 'boolean') {
    overlay.includeBookmarks = value.includeBookmarks;
  }
  if (typeof value.includePdfIndex === 'boolean') {
    overlay.includePdfIndex = value.includePdfIndex;
  }

  return overlay;
}

export function normalizeExportSnapshot(value: unknown): ExportSnapshot | undefined {
  if (!isObject(value)) return undefined;
  const schemaVersion = value.schemaVersion ?? 1;
  if (schemaVersion !== 1) return undefined;
  if (typeof value.id !== 'string' || !value.id.trim()) return undefined;
  if (typeof value.createdAt !== 'string' || !value.createdAt.trim()) return undefined;
  if (typeof value.sourceFile !== 'string') return undefined;
  if (!isSettingSource(value.source)) return undefined;

  const snapshot: ExportSnapshot = {
    schemaVersion: 1,
    id: value.id,
    createdAt: value.createdAt,
    sourceFile: value.sourceFile,
    source: value.source,
    settings: normalizeOverlay(value.settings),
  };

  if (typeof value.outputFile === 'string') {
    snapshot.outputFile = value.outputFile;
  }

  return snapshot;
}

export function normalizeExportSnapshots(value: unknown): ExportSnapshot[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(normalizeExportSnapshot)
    .filter((snapshot): snapshot is ExportSnapshot => Boolean(snapshot))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, EXPORT_SNAPSHOT_LIMIT);
}

function storageForContext(context: vscode.ExtensionContext): SnapshotStorage {
  return vscode.workspace.workspaceFolders?.length ? context.workspaceState : context.globalState;
}

export function loadExportSnapshots(context: vscode.ExtensionContext): ExportSnapshot[] {
  return normalizeExportSnapshots(storageForContext(context).get<unknown>(SNAPSHOT_STORAGE_KEY, []));
}

export async function saveExportSnapshot(
  context: vscode.ExtensionContext,
  snapshot: ExportSnapshot,
): Promise<void> {
  const storage = storageForContext(context);
  const existing = normalizeExportSnapshots(storage.get<unknown>(SNAPSHOT_STORAGE_KEY, []));
  const next = [
    snapshot,
    ...existing.filter(item => item.id !== snapshot.id),
  ]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, EXPORT_SNAPSHOT_LIMIT);

  await storage.update(SNAPSHOT_STORAGE_KEY, next);
}

function workspaceRelative(filePath: string): string {
  const workspaceFolder = vscode.workspace.workspaceFolders?.find(folder => {
    const root = folder.uri.fsPath;
    return filePath === root || filePath.startsWith(`${root}${path.sep}`);
  });
  if (!workspaceFolder) return filePath;
  return path.relative(workspaceFolder.uri.fsPath, filePath) || path.basename(filePath);
}

export function overlayFromConfig(config: MarkdownStudioConfig): ExportConfigOverlay {
  return {
    pageFormat: config.pageFormat,
    stylePreset: config.style.presetName,
    securityMode: config.externalResources.mode,
    includeBookmarks: config.pdfBookmarks.enabled,
    includePdfIndex: config.pdfIndex.enabled,
  };
}

function timestampId(date: Date): string {
  return date.toISOString();
}

export function createExportSnapshot(
  document: vscode.TextDocument,
  outputPath: string,
  source: ExportSettingSource,
  config: MarkdownStudioConfig,
  now = new Date(),
): ExportSnapshot {
  const createdAt = timestampId(now);
  return {
    schemaVersion: 1,
    id: createdAt,
    createdAt,
    sourceFile: workspaceRelative(document.uri.fsPath),
    outputFile: workspaceRelative(outputPath),
    source,
    settings: overlayFromConfig(config),
  };
}
