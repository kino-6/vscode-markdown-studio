import fs from 'node:fs/promises';
import path from 'node:path';
import * as vscode from 'vscode';
import { ContentCache } from '../infra/cache';
import { getConfig } from '../infra/config';
import { runProcess } from '../infra/runProcess';
import { createTempFile } from '../infra/tempFiles';
import { sanitizeSvg } from '../parser/sanitizeSvg';
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
      error: `PlantUML mode '${cfg.plantUmlMode}' is reserved for future MVP iterations.`
    };
    cache.set(key, unsupported);
    return unsupported;
  }

  const jarPath = bundledJarPath(context);
  try {
    await fs.access(jarPath);
  } catch {
    const missing = { ok: false, error: `Bundled PlantUML jar missing at ${jarPath}` };
    cache.set(key, missing);
    return missing;
  }

  const inputFile = await createTempFile('puml', source);
  const result = await runProcess(
    cfg.javaPath,
    ['-Djava.awt.headless=true', '-jar', jarPath, '-tsvg', inputFile],
    15000
  );

  if (result.timedOut || result.exitCode !== 0) {
    const failed: PlantUmlResult = {
      ok: false,
      error: result.timedOut
        ? 'PlantUML rendering timed out.'
        : `PlantUML rendering failed: ${result.stderr || result.stdout}`
    };
    cache.set(key, failed);
    return failed;
  }

  const outputFile = inputFile.replace(/\.puml$/, '.svg');
  try {
    const rawSvg = await fs.readFile(outputFile, 'utf8');
    const ok: PlantUmlResult = { ok: true, svg: sanitizeSvg(rawSvg) };
    cache.set(key, ok);
    return ok;
  } catch {
    const missingSvg = { ok: false, error: 'PlantUML did not produce SVG output.' };
    cache.set(key, missingSvg);
    return missingSvg;
  }
}
