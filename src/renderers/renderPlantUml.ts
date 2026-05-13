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
type PlantUmlRuntime = {
  cfg: ReturnType<typeof getConfig>;
  jarPath: string;
  javaPath: string;
};
type PlantUmlBatchItem = {
  source: string;
  key: string;
  inputFile: string;
};

/** @internal Exposed for testing only. */
export function clearPlantUmlCache(): void {
  cache.clear();
}

function bundledJarPath(context: vscode.ExtensionContext): string {
  return path.join(context.extensionPath, 'third_party', 'plantuml', 'plantuml.jar');
}

function plantUmlCacheKey(cfg: ReturnType<typeof getConfig>, source: string): string {
  return cache.createKey([cfg.plantUmlMode, source]);
}

function unsupportedModeResult(mode: string): PlantUmlResult {
  return {
    ok: false,
    error: RUNTIME_MESSAGES.plantUml.unsupportedMode(mode),
  };
}

function javaMissingResult(): PlantUmlResult {
  return {
    ok: false,
    error: RUNTIME_MESSAGES.dependencies.javaMissingAutomatic,
  };
}

function processFailureResult(result: { timedOut: boolean; exitCode: number; stderr: string; stdout: string }): PlantUmlResult {
  const isJavaMissing = !result.timedOut &&
    (result.stderr?.includes('not found') ||
     result.stderr?.includes('not recognized') ||
     result.stderr?.includes('ENOENT') ||
     result.exitCode === 127);

  return {
    ok: false,
    error: result.timedOut
      ? RUNTIME_MESSAGES.plantUml.timedOut
      : isJavaMissing && !dependencyStatus?.javaPath
        ? RUNTIME_MESSAGES.dependencies.javaMissingAutomatic
        : RUNTIME_MESSAGES.plantUml.failed(result.stderr || result.stdout),
  };
}

function sanitizePlantUmlSvg(rawSvg: string): string {
  // PlantUML output is from a trusted local JAR — only strip script tags,
  // skip full sanitization which destroys PlantUML's style attributes.
  return rawSvg.replace(/<script[\s\S]*?<\/script>/gi, '');
}

async function resolvePlantUmlRuntime(context: vscode.ExtensionContext): Promise<PlantUmlRuntime | PlantUmlResult> {
  const cfg = getConfig();
  if (cfg.plantUmlMode !== 'bundled-jar') {
    return unsupportedModeResult(cfg.plantUmlMode);
  }

  const jarPath = bundledJarPath(context);
  try {
    await fs.access(jarPath);
  } catch {
    return { ok: false, error: RUNTIME_MESSAGES.plantUml.bundledJarMissing(jarPath) };
  }

  // Prefer managed Corretto path, fall back to user config
  const javaPath = dependencyStatus?.javaPath ?? cfg.javaPath;

  // Early check: if no managed Java and no user-configured path, fail fast with actionable message
  if (!dependencyStatus?.javaPath && !cfg.javaPath) {
    return javaMissingResult();
  }

  return { cfg, jarPath, javaPath };
}

async function readSvgOutput(inputFile: string): Promise<PlantUmlResult> {
  const outputFile = inputFile.replace(/\.puml$/, '.svg');
  try {
    const rawSvg = await fs.readFile(outputFile, 'utf8');
    return { ok: true, svg: sanitizePlantUmlSvg(rawSvg) };
  } catch {
    return { ok: false, error: RUNTIME_MESSAGES.plantUml.missingSvg };
  }
}

async function renderPlantUmlUncached(
  source: string,
  runtime: PlantUmlRuntime,
): Promise<PlantUmlResult> {
  const inputFile = await createTempFile('puml', source);
  const timeoutMs = runtime.cfg.diagramTimeout > 0 ? runtime.cfg.diagramTimeout * 1000 : 0;
  const result = await runProcess(
    runtime.javaPath,
    ['-Djava.awt.headless=true', '-jar', runtime.jarPath, '-Playout=smetana', '-tsvg', inputFile],
    timeoutMs
  );

  if (result.timedOut || result.exitCode !== 0) {
    return processFailureResult(result);
  }

  return await readSvgOutput(inputFile);
}

export async function renderPlantUml(
  source: string,
  context: vscode.ExtensionContext
): Promise<PlantUmlResult> {
  const runtime = await resolvePlantUmlRuntime(context);
  const cfg = 'cfg' in runtime ? runtime.cfg : getConfig();
  const key = plantUmlCacheKey(cfg, source);
  const cached = cache.get(key);
  if (cached) return cached;

  if (!('cfg' in runtime)) {
    cache.set(key, runtime);
    return runtime;
  }

  const result = await renderPlantUmlUncached(source, runtime);
  cache.set(key, result);
  return result;
}

export async function renderPlantUmlBatch(
  sources: string[],
  context: vscode.ExtensionContext
): Promise<PlantUmlResult[]> {
  if (sources.length === 0) return [];

  const runtime = await resolvePlantUmlRuntime(context);
  const cfg = 'cfg' in runtime ? runtime.cfg : getConfig();
  const results = new Array<PlantUmlResult>(sources.length);
  const uncachedByKey = new Map<string, { source: string; indexes: number[]; key: string }>();

  for (let index = 0; index < sources.length; index++) {
    const source = sources[index];
    const key = plantUmlCacheKey(cfg, source);
    const cached = cache.get(key);
    if (cached) {
      results[index] = cached;
      continue;
    }

    const existing = uncachedByKey.get(key);
    if (existing) {
      existing.indexes.push(index);
    } else {
      uncachedByKey.set(key, { source, indexes: [index], key });
    }
  }

  const uncached = [...uncachedByKey.values()];
  if (uncached.length === 0) return results;

  if (!('cfg' in runtime)) {
    for (const item of uncached) {
      cache.set(item.key, runtime);
      for (const index of item.indexes) {
        results[index] = runtime;
      }
    }
    return results;
  }

  const batchItems: PlantUmlBatchItem[] = await Promise.all(
    uncached.map(async (item) => ({
      source: item.source,
      key: item.key,
      inputFile: await createTempFile('puml', item.source),
    }))
  );

  const timeoutMs = runtime.cfg.diagramTimeout > 0 ? runtime.cfg.diagramTimeout * 1000 : 0;
  const processResult = await runProcess(
    runtime.javaPath,
    ['-Djava.awt.headless=true', '-jar', runtime.jarPath, '-Playout=smetana', '-tsvg', ...batchItems.map((item) => item.inputFile)],
    timeoutMs
  );

  let renderedResults: PlantUmlResult[];
  if (processResult.timedOut || processResult.exitCode !== 0) {
    // If one diagram makes the batch fail, fall back to the proven single-diagram
    // path so a bad fence does not poison all other PlantUML diagrams.
    renderedResults = await Promise.all(
      batchItems.map((item) => renderPlantUmlUncached(item.source, runtime))
    );
  } else {
    renderedResults = await Promise.all(batchItems.map((item) => readSvgOutput(item.inputFile)));
  }

  for (let itemIndex = 0; itemIndex < batchItems.length; itemIndex++) {
    const item = batchItems[itemIndex];
    const result = renderedResults[itemIndex];
    cache.set(item.key, result);
    const target = uncachedByKey.get(item.key);
    if (!target) continue;
    for (const index of target.indexes) {
      results[index] = result;
    }
  }

  return results;
}
