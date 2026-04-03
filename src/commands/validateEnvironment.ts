import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import * as vscode from 'vscode';
import { getConfig } from '../infra/config';
import { runProcess } from '../infra/runProcess';

export async function validateEnvironmentCommand(context: vscode.ExtensionContext): Promise<void> {
  const cfg = getConfig();
  const results: string[] = [];

  const javaCheck = await runProcess(cfg.javaPath, ['-version'], 8000);
  if (javaCheck.exitCode === 0 || javaCheck.stderr.toLowerCase().includes('version')) {
    results.push('✅ Java detected');
  } else {
    results.push('❌ Java missing or inaccessible');
  }

  const jarPath = path.join(context.extensionPath, 'third_party', 'plantuml', 'plantuml.jar');
  try {
    await fs.access(jarPath);
    results.push('✅ Bundled PlantUML jar found');
  } catch {
    results.push(`❌ Bundled PlantUML jar missing at ${jarPath}`);
  }

  try {
    const probe = path.join(os.tmpdir(), `markdown-studio-write-test-${Date.now()}.txt`);
    await fs.writeFile(probe, 'ok', 'utf8');
    await fs.unlink(probe);
    results.push('✅ Temp directory writable');
  } catch {
    results.push('❌ Temp directory is not writable');
  }

  const message = `Markdown Studio environment validation:\n${results.join('\n')}`;
  const hasErrors = results.some((line) => line.startsWith('❌'));
  if (hasErrors) {
    void vscode.window.showWarningMessage(message);
  } else {
    void vscode.window.showInformationMessage(message);
  }
}
