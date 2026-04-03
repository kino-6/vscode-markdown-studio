import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { MarkdownStudioConfig } from '../infra/config';
import { runProcess as defaultRunProcess } from '../infra/runProcess';

export interface EnvironmentValidationResult {
  ok: boolean;
  lines: string[];
}

export interface EnvironmentValidationDeps {
  runProcess: typeof defaultRunProcess;
  access: typeof fs.access;
  writeFile: typeof fs.writeFile;
  unlink: typeof fs.unlink;
  tmpdir: () => string;
  now: () => number;
}

const defaultDeps: EnvironmentValidationDeps = {
  runProcess: defaultRunProcess,
  access: fs.access,
  writeFile: fs.writeFile,
  unlink: fs.unlink,
  tmpdir: os.tmpdir,
  now: Date.now
};

export async function validateEnvironment(
  cfg: MarkdownStudioConfig,
  extensionPath: string,
  deps: Partial<EnvironmentValidationDeps> = {}
): Promise<EnvironmentValidationResult> {
  const runtimeDeps: EnvironmentValidationDeps = { ...defaultDeps, ...deps };
  const lines: string[] = [];

  const javaCheck = await runtimeDeps.runProcess(cfg.javaPath, ['-version'], 8000);
  if (javaCheck.exitCode === 0 || javaCheck.stderr.toLowerCase().includes('version')) {
    lines.push('✅ Java detected');
  } else {
    lines.push('❌ Java missing or inaccessible');
  }

  const jarPath = path.join(extensionPath, 'third_party', 'plantuml', 'plantuml.jar');
  try {
    await runtimeDeps.access(jarPath);
    lines.push('✅ Bundled PlantUML jar found');
  } catch {
    lines.push(`❌ Bundled PlantUML jar missing at ${jarPath}`);
  }

  try {
    const probe = path.join(runtimeDeps.tmpdir(), `markdown-studio-write-test-${runtimeDeps.now()}.txt`);
    await runtimeDeps.writeFile(probe, 'ok', 'utf8');
    await runtimeDeps.unlink(probe);
    lines.push('✅ Temp directory writable');
  } catch {
    lines.push('❌ Temp directory is not writable');
  }

  return { ok: lines.every((line) => line.startsWith('✅')), lines };
}
