import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export const CONFIG_SECTION = 'markdownStudio';

const PORTABLE_SETTING_KEYS = [
  'export.pageFormat',
  'style.preset',
  'style.theme',
  'style.fontFamily',
  'style.fontSize',
  'style.lineHeight',
  'style.customCss',
  'export.margin',
  'security.externalResources.mode',
  'security.externalResources.allowedDomains',
  'export.header.enabled',
  'export.footer.enabled',
  'export.pageBreak.enabled',
  'export.pdfBookmarks.enabled',
  'export.pdfIndex.enabled',
  'export.pdfIndex.title',
  'export.pdfToc.hidden',
  'export.cover.enabled',
  'export.cover.path',
  'toc.levels',
  'toc.orderedList',
  'toc.pageBreak',
  'codeBlock.lineNumbers',
  'export.outputFilename',
] as const;

export function workspacePath(): string {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  assert.ok(workspaceFolders && workspaceFolders.length > 0, 'Workspace should be open');
  return workspaceFolders[0].uri.fsPath;
}

export function workspaceVscodeDir(): string {
  return path.join(workspacePath(), '.vscode');
}

export function cleanupWorkspaceExports(): void {
  const dir = workspaceVscodeDir();
  if (!fs.existsSync(dir)) return;
  for (const file of fs.readdirSync(dir)) {
    if (/^markdown-studio-(pdf-)?settings-\d{8}-\d{6}\.json$/.test(file)) {
      fs.unlinkSync(path.join(dir, file));
    }
  }
}

export function cleanupWorkspaceSettingsFile(): void {
  const settingsFile = path.join(workspaceVscodeDir(), 'settings.json');
  if (fs.existsSync(settingsFile)) {
    fs.unlinkSync(settingsFile);
  }
}

export function cleanupGeneratedPdf(markdownFile: string): void {
  const expectedPdf = markdownFile.replace(/\.md$/, '.pdf');
  if (fs.existsSync(expectedPdf)) {
    fs.unlinkSync(expectedPdf);
  }
}

export function latestSettingsExport(prefix: string): Record<string, unknown> {
  const dir = workspaceVscodeDir();
  const files = fs.readdirSync(dir)
    .filter(file => file.startsWith(prefix) && file.endsWith('.json'))
    .sort();
  assert.ok(files.length > 0, `Expected at least one ${prefix} JSON export`);
  return JSON.parse(fs.readFileSync(path.join(dir, files[files.length - 1]), 'utf8'));
}

export async function resetPortableSettings(): Promise<void> {
  const cfg = vscode.workspace.getConfiguration(CONFIG_SECTION);
  for (const key of PORTABLE_SETTING_KEYS) {
    await cfg.update(key, undefined, vscode.ConfigurationTarget.Workspace);
  }
}

export async function cleanupPortableWorkspaceState(): Promise<void> {
  cleanupWorkspaceExports();
  await resetPortableSettings();
  cleanupWorkspaceSettingsFile();
}

export async function openWorkspaceMarkdown(fileName = 'test.md'): Promise<string> {
  const testFile = path.join(workspacePath(), fileName);
  const doc = await vscode.workspace.openTextDocument(testFile);
  await vscode.window.showTextDocument(doc);
  return testFile;
}

export async function acceptNextQuickPick(): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 400));
  await vscode.commands.executeCommand('workbench.action.acceptSelectedQuickOpenItem');
}
