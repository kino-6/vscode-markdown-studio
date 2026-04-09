import path from 'node:path';

/**
 * Demo GIF automation — shared types, constants, and timing configuration.
 *
 * This module is the single source of truth for CLI option shapes,
 * section-anchor metadata, recorder/converter option types, and the
 * configurable timing values used across the automation pipeline.
 */

// ---------------------------------------------------------------------------
// Type definitions
// ---------------------------------------------------------------------------

/** CLI options parsed from `npm run demo -- …` arguments. */
export interface CliOptions {
  section?: string;
  duration?: number;
  output?: string;
  keepMp4?: boolean;
  width?: number;
  height?: number;
}

/** Configurable wait-times (milliseconds) injected into the pipeline. */
export interface TimingConfig {
  vscodeLaunchWait: number;
  previewInitWait: number;
  sectionSettleWait: number;
  defaultDuration: number;
}

/** A single section anchor extracted from `examples/demo.md`. */
export interface SectionAnchor {
  name: string;
  anchor: string;
  line: number;
}

/** Outcome of processing one demo section. */
export interface SectionResult {
  section: string;
  status: 'success' | 'failed' | 'skipped';
  outputPath?: string;
  fileSize?: number;
  error?: string;
}

/** Options for launching VSCode. */
export interface LaunchOptions {
  filePath: string;
  width: number;
  height: number;
  waitAfterLaunch: number;
}

/** Result returned after a VSCode launch attempt. */
export interface LaunchResult {
  pid: number;
  success: boolean;
}

/** Options for the ffmpeg screen-recording step. */
export interface RecordOptions {
  outputPath: string;
  duration: number;
  fps?: number;
}

/** Options for the mp4 → GIF conversion step. */
export interface ConvertOptions {
  inputPath: string;
  outputPath: string;
  fps?: number;
  width?: number;
  keepSource?: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maps user-facing section names to their anchor identifiers in demo.md. */
export const SECTION_MAP: Record<string, string> = {
  rendering: 'DEMO:RENDERING',
  mermaid: 'DEMO:MERMAID',
  plantuml: 'DEMO:PLANTUML',
  security: 'DEMO:SECURITY',
  export: 'DEMO:EXPORT',
};

/** Default output filenames per section. */
export const OUTPUT_FILES: Record<string, string> = {
  rendering: 'rendering.gif',
  mermaid: 'mermaid.gif',
  plantuml: 'plantuml.gif',
  security: 'security.gif',
  export: 'export.gif',
};

/** Regex that matches a `<!-- DEMO:SECTION_NAME -->` anchor line. */
export const ANCHOR_PATTERN = /^<!--\s*DEMO:(\w+)\s*-->$/;

// ---------------------------------------------------------------------------
// Default timing values
// ---------------------------------------------------------------------------

const DEFAULT_TIMING: TimingConfig = {
  vscodeLaunchWait: 8000,
  previewInitWait: 2500,
  sectionSettleWait: 1500,
  defaultDuration: 5,
};

// ---------------------------------------------------------------------------
// Timing config loader
// ---------------------------------------------------------------------------

/**
 * Build a `TimingConfig` by merging defaults with environment-variable
 * overrides.
 *
 * Recognised env vars (all optional):
 *  - `DEMO_VSCODE_WAIT`  → `vscodeLaunchWait`  (ms)
 *  - `DEMO_PREVIEW_WAIT` → `previewInitWait`    (ms)
 *  - `DEMO_SETTLE_WAIT`  → `sectionSettleWait`  (ms)
 *  - `DEMO_DURATION`     → `defaultDuration`    (seconds)
 *
 * Non-numeric or non-positive values are silently ignored and the
 * corresponding default is kept.
 */
export function loadTimingConfig(
  env: Record<string, string | undefined> = process.env,
): TimingConfig {
  const parse = (key: string): number | undefined => {
    const raw = env[key];
    if (raw === undefined || raw === '') return undefined;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  };

  return {
    vscodeLaunchWait: parse('DEMO_VSCODE_WAIT') ?? DEFAULT_TIMING.vscodeLaunchWait,
    previewInitWait: parse('DEMO_PREVIEW_WAIT') ?? DEFAULT_TIMING.previewInitWait,
    sectionSettleWait: parse('DEMO_SETTLE_WAIT') ?? DEFAULT_TIMING.sectionSettleWait,
    defaultDuration: parse('DEMO_DURATION') ?? DEFAULT_TIMING.defaultDuration,
  };
}

// ---------------------------------------------------------------------------
// Output path resolver
// ---------------------------------------------------------------------------

/**
 * Resolve the output GIF path for a given section.
 *
 * - If `outputArg` is provided, use it directly under `demo/`.
 * - Otherwise look up the section in `OUTPUT_FILES`.
 * - If the section has no entry, fall back to `{sectionName}.gif`.
 */
export function getOutputPath(sectionName: string, outputArg?: string): string {
  if (outputArg !== undefined) {
    return path.join('demo', outputArg);
  }
  const filename = OUTPUT_FILES[sectionName] ?? `${sectionName}.gif`;
  return path.join('demo', filename);
}
