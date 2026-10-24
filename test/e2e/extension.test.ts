import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { cleanupWorkspaceExports } from './helpers';

suite('Markdown Studio E2E', () => {
  const extensionId = 'kino6.markdown-studio-local';

  suite('Extension Activation', () => {
    test('extension should be present', () => {
      const ext = vscode.extensions.getExtension(extensionId);
      assert.ok(ext, 'Extension should be installed');
    });

    test('extension should activate on markdown file', async () => {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      assert.ok(workspaceFolders && workspaceFolders.length > 0, 'Workspace should be open');

      const testFile = path.join(workspaceFolders[0].uri.fsPath, 'test.md');
      const doc = await vscode.workspace.openTextDocument(testFile);
      await vscode.window.showTextDocument(doc);

      // Wait for activation
      const ext = vscode.extensions.getExtension(extensionId);
      assert.ok(ext, 'Extension should be installed');
      await ext!.activate();
      assert.strictEqual(ext!.isActive, true, 'Extension should be active');
    });
  });

  suite('Preview Command', () => {
    test('openPreview command should be registered', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(
        commands.includes('markdownStudio.openPreview'),
        'openPreview command should be registered'
      );
    });

    test('openPreview command should execute without error', async () => {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      assert.ok(workspaceFolders && workspaceFolders.length > 0);

      const testFile = path.join(workspaceFolders[0].uri.fsPath, 'test.md');
      const doc = await vscode.workspace.openTextDocument(testFile);
      await vscode.window.showTextDocument(doc);

      // Execute the preview command — should not throw
      await vscode.commands.executeCommand('markdownStudio.openPreview');
    });
  });

  suite('PDF Export Command', () => {
    test('exportPdf command should be registered', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(
        commands.includes('markdownStudio.exportPdf'),
        'exportPdf command should be registered'
      );
    });

    test('exportPdf command should execute and produce a file', async function () {
      this.timeout(120000); // PDF export may take time

      const workspaceFolders = vscode.workspace.workspaceFolders;
      assert.ok(workspaceFolders && workspaceFolders.length > 0);

      const testFile = path.join(workspaceFolders[0].uri.fsPath, 'test.md');
      const expectedPdf = testFile.replace(/\.md$/, '.pdf');
      if (fs.existsSync(expectedPdf)) fs.unlinkSync(expectedPdf);

      const doc = await vscode.workspace.openTextDocument(testFile);
      await vscode.window.showTextDocument(doc);

      try {
        // The command reports failures with a message instead of throwing,
        // so the produced file is the only reliable evidence of success.
        await vscode.commands.executeCommand('markdownStudio.exportPdf');

        assert.ok(
          fs.existsSync(expectedPdf),
          `PDF export produced no file at ${expectedPdf}. Chromium must be available ` +
          '(run "Markdown Studio: Tools: Setup Dependencies" or `npx playwright install chromium`).',
        );
        const bytes = fs.readFileSync(expectedPdf);
        assert.ok(bytes.length > 1000, `Generated PDF is too small (${bytes.length} bytes)`);
        assert.strictEqual(bytes.subarray(0, 5).toString('latin1'), '%PDF-', 'Generated file is not a PDF');
      } finally {
        if (fs.existsSync(expectedPdf)) fs.unlinkSync(expectedPdf);
        cleanupWorkspaceExports();
      }
    });
  });

  suite('Validate Environment Command', () => {
    test('validateEnvironment command should be registered', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(
        commands.includes('markdownStudio.validateEnvironment'),
        'validateEnvironment command should be registered'
      );
    });

    test('validateEnvironment command should execute without error', async () => {
      // This command checks the local environment (Java, Playwright, etc.)
      // It should run without throwing even if tools are missing
      await vscode.commands.executeCommand('markdownStudio.validateEnvironment');
    });
  });

  suite('Export Profile Commands', () => {
    test('settings JSON commands should be registered', async () => {
      const commands = await vscode.commands.getCommands(true);
      for (const command of [
        'markdownStudio.importExportProfile',
        'markdownStudio.exportProfileToJson',
      ]) {
        assert.ok(commands.includes(command), `${command} should be registered`);
      }
    });
  });
});
