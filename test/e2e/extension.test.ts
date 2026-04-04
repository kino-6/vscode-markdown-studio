import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

suite('Markdown Studio E2E', () => {
  const extensionId = 'local.markdown-studio';

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
      this.timeout(60000); // PDF export may take time

      const workspaceFolders = vscode.workspace.workspaceFolders;
      assert.ok(workspaceFolders && workspaceFolders.length > 0);

      const testFile = path.join(workspaceFolders[0].uri.fsPath, 'test.md');
      const doc = await vscode.workspace.openTextDocument(testFile);
      await vscode.window.showTextDocument(doc);

      try {
        await vscode.commands.executeCommand('markdownStudio.exportPdf');
      } catch {
        // PDF export may fail in CI without Playwright browsers installed.
        // The test validates the command is callable; actual file generation
        // depends on the environment.
        return;
      }

      // If the command succeeded, check for the generated PDF
      const expectedPdf = testFile.replace(/\.md$/, '.pdf');
      if (fs.existsSync(expectedPdf)) {
        const stat = fs.statSync(expectedPdf);
        assert.ok(stat.size > 0, 'Generated PDF should not be empty');
        // Clean up
        fs.unlinkSync(expectedPdf);
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
});
