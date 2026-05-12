import fs from 'node:fs/promises';
import path from 'node:path';
import * as vscode from 'vscode';
import { dependencyStatus } from '../extension';
import { ContentCache } from '../infra/cache';
import { getConfig } from '../infra/config';
import { RUNTIME_MESSAGES } from '../infra/messages';
import { runProcess } from '../infra/runProcess';
import { createTempFile } from '../infra/tempFiles';
import { PlantUmlResult } from '../types/models';

const cache = new ContentCache<PlantUmlResult>();

/** @internal Exposed for testing only. */
export function clearPlantUmlCache(): void {
  cache.clear();
}

function bundledJarPath(context: vscode.ExtensionContext): string {
  return path.join(context.extensionPath, 'third_party', 'plantuml', 'plantuml.jar');
}

export async function renderPlantUml(
  source: string,
  context: vscode.ExtensionContext
): Promise<PlantUmlResult> {
  const cfg = getConfig();
  const key = cache.createKey([cfg.plantUmlMode, source]);
  const cached = cache.get(key);
  if (cached) return cached;

  if (cfg.plantUmlMode !== 'bundled-jar') {
    const unsupported: PlantUmlResult = {
      ok: false,
      error: RUNTIME_MESSAGES.plantUml.unsupportedMode(cfg.plantUmlMode),
    };
    cache.set(key, unsupported);
    return unsupported;
  }

  const jarPath = bundledJarPath(context);
  try {
    await fs.access(jarPath);
  } catch {
    const missing = { ok: false, error: RUNTIME_MESSAGES.plantUml.bundledJarMissing(jarPath) };
    cache.set(key, missing);
    return missing;
  }

  // Prefer managed Corretto path, fall back to user config
  const javaPath = dependencyStatus?.javaPath ?? cfg.javaPath;

  // Early check: if no managed Java and no user-configured path, fail fast with actionable message
  if (!dependencyStatus?.javaPath && !cfg.javaPath) {
    const noJava: PlantUmlResult = {
      ok: false,
      error: RUNTIME_MESSAGES.dependencies.javaMissingAutomatic,
    };
    cache.set(key, noJava);
    return noJava;
  }

  const inputFile = await createTempFile('puml', source);
  const timeoutMs = cfg.diagramTimeout > 0 ? cfg.diagramTimeout * 1000 : 0;
  const result = await runProcess(
    javaPath,
    ['-Djava.awt.headless=true', '-jar', jarPath, '-Playout=smetana', '-tsvg', inputFile],
    timeoutMs
  );

  if (result.timedOut || result.exitCode !== 0) {
    const isJavaMissing = !result.timedOut &&
      (result.stderr?.includes('not found') ||
       result.stderr?.includes('not recognized') ||
       result.stderr?.includes('ENOENT') ||
       result.exitCode === 127);

    const errorMessage = result.timedOut
      ? RUNTIME_MESSAGES.plantUml.timedOut
      : isJavaMissing && !dependencyStatus?.javaPath
        ? RUNTIME_MESSAGES.dependencies.javaMissingAutomatic
        : RUNTIME_MESSAGES.plantUml.failed(result.stderr || result.stdout);

    const failed: PlantUmlResult = { ok: false, error: errorMessage };
    cache.set(key, failed);
    return failed;
  }

  const outputFile = inputFile.replace(/\.puml$/, '.svg');
  try {
    const rawSvg = await fs.readFile(outputFile, 'utf8');
    // PlantUML output is from a trusted local JAR — only strip script tags,
    // skip full sanitization which destroys PlantUML's style attributes.
    const safeSvg = rawSvg.replace(/<script[\s\S]*?<\/script>/gi, '');
    const ok: PlantUmlResult = { ok: true, svg: safeSvg };
    cache.set(key, ok);
    return ok;
  } catch {
    const missingSvg = { ok: false, error: RUNTIME_MESSAGES.plantUml.missingSvg };
    cache.set(key, missingSvg);
    return missingSvg;
  }
}
