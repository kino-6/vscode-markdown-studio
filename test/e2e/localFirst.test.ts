import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { workspacePath } from './helpers';

const extensionId = 'kino6.markdown-studio-local';

/** globalStorage of the test profile that @vscode/test-cli launches. */
function extensionStorageDir(): string {
  const userDataDir = process.env.MDS_E2E_USER_DATA_DIR
    ?? path.resolve(__dirname, '../../../.vscode-test/user-data');
  return path.join(userDataDir, 'User', 'globalStorage', extensionId);
}

async function waitFor<T>(read: () => T, done: (value: T) => boolean, timeoutMs = 10000): Promise<T> {
  const start = Date.now();
  let value = read();
  while (!done(value) && Date.now() - start < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, 200));
    value = read();
  }
  return value;
}

suite('local-first activation', () => {
  test('activating on a Markdown file downloads nothing', async () => {
    const doc = await vscode.workspace.openTextDocument(path.join(workspacePath(), 'test.md'));
    await vscode.window.showTextDocument(doc);
    const ext = vscode.extensions.getExtension(extensionId);
    assert.ok(ext, 'extension should be installed');
    await ext!.activate();
    // Give a background download, if any, time to start writing files.
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const storage = extensionStorageDir();
    // Guard against checking a wrong path, which would pass silently.
    assert.ok(fs.existsSync(path.dirname(storage)), `test profile globalStorage not found: ${path.dirname(storage)}`);
    for (const runtime of ['corretto', 'chromium']) {
      assert.strictEqual(
        fs.existsSync(path.join(storage, runtime)),
        false,
        `${runtime} must not be downloaded on activation (${storage})`,
      );
    }
  });
});

suite('SKILL.md diagnostics', () => {
  test('an invalid SKILL.md gets Agent Skills diagnostics in the Problems panel', async () => {
    const uri = vscode.Uri.file(path.join(workspacePath(), 'skills', 'BadName', 'SKILL.md'));
    const doc = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(doc);

    const diagnostics = await waitFor(
      () => vscode.languages.getDiagnostics(uri).filter((d) => d.source === 'Agent Skills'),
      (list) => list.length >= 5,
    );
    const messages = diagnostics.map((d) => d.message);
    assert.ok(diagnostics.length >= 5, `expected at least 5 Agent Skills diagnostics, got ${JSON.stringify(messages)}`);
    assert.ok(messages.some((m) => m.includes('Missing required field "description"')), 'missing description is reported');
    assert.ok(messages.some((m) => m.includes('folder name')), 'folder mismatch is reported');
    assert.ok(messages.some((m) => m.includes('Referenced file not found')), 'missing reference is reported');
    assert.ok(
      diagnostics.some((d) => d.severity === vscode.DiagnosticSeverity.Error),
      'spec violations are errors',
    );
  });

  test('a valid SKILL.md gets no diagnostics', async () => {
    const dir = path.join(workspacePath(), 'skills', 'good-skill');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, 'SKILL.md');
    fs.writeFileSync(file, '---\nname: good-skill\ndescription: Does one thing. Use when testing.\n---\n\n# Good\n');
    try {
      const uri = vscode.Uri.file(file);
      const doc = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(doc);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const diagnostics = vscode.languages.getDiagnostics(uri).filter((d) => d.source === 'Agent Skills');
      assert.deepStrictEqual(diagnostics.map((d) => d.message), []);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
