import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DependencyStatus } from '../deps/types';
import { MarkdownStudioConfig } from '../infra/config';
import { RUNTIME_MESSAGES } from '../infra/messages';
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
  deps: Partial<EnvironmentValidationDeps> = {},
  managedDeps?: DependencyStatus
): Promise<EnvironmentValidationResult> {
  const runtimeDeps: EnvironmentValidationDeps = { ...defaultDeps, ...deps };
  const lines: string[] = [];

  // Use managed Corretto path if available, fall back to config
  const javaPath = managedDeps?.javaPath ?? cfg.javaPath;
  const javaCheck = await runtimeDeps.runProcess(javaPath, ['-version'], 8000);
  if (javaCheck.exitCode === 0 || javaCheck.stderr.toLowerCase().includes('version')) {
    if (managedDeps?.javaPath) {
      lines.push(RUNTIME_MESSAGES.validation.javaDetectedManaged);
    } else {
      lines.push(RUNTIME_MESSAGES.validation.javaDetectedSystem);
    }
  } else {
    lines.push(RUNTIME_MESSAGES.validation.javaMissing);
  }

  const jarPath = path.join(extensionPath, 'third_party', 'plantuml', 'plantuml.jar');
  try {
    await runtimeDeps.access(jarPath);
    lines.push(RUNTIME_MESSAGES.validation.bundledPlantUmlJarFound);
  } catch {
    lines.push(RUNTIME_MESSAGES.validation.bundledPlantUmlJarMissing(jarPath));
  }

  try {
    const probe = path.join(runtimeDeps.tmpdir(), `markdown-studio-write-test-${runtimeDeps.now()}.txt`);
    await runtimeDeps.writeFile(probe, 'ok', 'utf8');
    await runtimeDeps.unlink(probe);
    lines.push(RUNTIME_MESSAGES.validation.tempDirectoryWritable);
  } catch {
    lines.push(RUNTIME_MESSAGES.validation.tempDirectoryNotWritable);
  }

  if (managedDeps?.browserPath) {
    lines.push(RUNTIME_MESSAGES.validation.managedChromiumAvailable);
  } else if (managedDeps) {
    lines.push(RUNTIME_MESSAGES.validation.managedChromiumUnavailable);
  }

  return { ok: lines.every((line) => line.startsWith('✅')), lines };
}
