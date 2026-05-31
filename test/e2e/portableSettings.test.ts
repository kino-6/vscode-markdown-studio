import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import {
  acceptNextQuickPick,
  cleanupGeneratedPdf,
  cleanupPortableWorkspaceState,
  CONFIG_SECTION,
  latestSettingsExport,
  openWorkspaceMarkdown,
  workspaceVscodeDir,
} from './helpers';

suite('Markdown Studio Portable Settings E2E', () => {
  setup(async () => {
    await cleanupPortableWorkspaceState();
  });

  teardown(async () => {
    await cleanupPortableWorkspaceState();
  });

  test('exports PDF settings with page format and custom CSS snapshots', async function () {
    this.timeout(60000);

    const testFile = await openWorkspaceMarkdown();
    const cfg = vscode.workspace.getConfiguration(CONFIG_SECTION);
    await cfg.update('export.pageFormat', 'A3', vscode.ConfigurationTarget.Workspace);
    await cfg.update('style.customCss', 'h1 { color: navy; }', vscode.ConfigurationTarget.Workspace);
    await cfg.update('style.fontSize', 16, vscode.ConfigurationTarget.Workspace);

    await vscode.commands.executeCommand('markdownStudio.exportPdf');
    const a3Profile = latestSettingsExport('markdown-studio-pdf-settings-');
    assert.strictEqual(a3Profile.source, 'pdf-export');
    assert.strictEqual(a3Profile.pageFormat, 'A3');
    assert.strictEqual(a3Profile.customCss, 'h1 { color: navy; }');
    assert.strictEqual(a3Profile.fontSize, 16);

    await cfg.update('export.pageFormat', 'A4', vscode.ConfigurationTarget.Workspace);
    await vscode.commands.executeCommand('markdownStudio.exportPdf');
    const a4Profile = latestSettingsExport('markdown-studio-pdf-settings-');
    assert.strictEqual(a4Profile.pageFormat, 'A4');

    const pdfHistory = fs.readdirSync(workspaceVscodeDir())
      .filter(file => file.startsWith('markdown-studio-pdf-settings-'));
    assert.ok(pdfHistory.length <= 3, 'PDF settings history should keep at most three files');

    cleanupGeneratedPdf(testFile);
  });

  test('manually exports and imports portable settings JSON with custom CSS', async function () {
    this.timeout(30000);

    const cfg = vscode.workspace.getConfiguration(CONFIG_SECTION);
    await cfg.update('export.pageFormat', 'A4', vscode.ConfigurationTarget.Workspace);
    await cfg.update('style.customCss', 'h2 { color: teal; }', vscode.ConfigurationTarget.Workspace);
    const exportPromise = vscode.commands.executeCommand('markdownStudio.exportProfileToJson');
    await acceptNextQuickPick();
    await exportPromise;

    const manualProfile = latestSettingsExport('markdown-studio-settings-');
    assert.strictEqual(manualProfile.source, 'manual-export');
    assert.strictEqual(manualProfile.pageFormat, 'A4');
    assert.strictEqual(manualProfile.customCss, 'h2 { color: teal; }');

    const importFile = path.join(workspaceVscodeDir(), 'markdown-studio-settings-20990101-000000.json');
    fs.mkdirSync(workspaceVscodeDir(), { recursive: true });
    fs.writeFileSync(importFile, JSON.stringify({
      schemaVersion: 1,
      name: 'E2E Imported Settings',
      pageFormat: 'A3',
      customCss: 'body { color: rgb(1, 2, 3); }',
      fontSize: 18,
      includePdfIndex: false,
    }, null, 2));

    await cfg.update('export.pageFormat', 'A4', vscode.ConfigurationTarget.Workspace);
    await cfg.update('style.customCss', '', vscode.ConfigurationTarget.Workspace);
    await cfg.update('style.fontSize', 14, vscode.ConfigurationTarget.Workspace);
    await cfg.update('export.pdfIndex.enabled', true, vscode.ConfigurationTarget.Workspace);

    const importPromise = vscode.commands.executeCommand('markdownStudio.importExportProfile');
    await acceptNextQuickPick();
    await acceptNextQuickPick();
    await importPromise;

    const updated = vscode.workspace.getConfiguration(CONFIG_SECTION);
    assert.strictEqual(updated.get('export.pageFormat'), 'A3');
    assert.strictEqual(updated.get('style.customCss'), 'body { color: rgb(1, 2, 3); }');
    assert.strictEqual(updated.get('style.fontSize'), 18);
    assert.strictEqual(updated.get('export.pdfIndex.enabled'), false);
  });
});
