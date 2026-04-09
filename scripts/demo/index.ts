/**
 * Demo GIF automation — CLI entry point.
 *
 * Orchestrates: cleanup → build → install → launch → preview → scroll → record → convert → cleanup → summary.
 */

import { execFile, execSync } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, mkdir, stat, readdir } from 'node:fs/promises';
import path from 'node:path';

import type { CliOptions, SectionAnchor, SectionResult } from './config.js';
import { loadTimingConfig, getOutputPath, SECTION_MAP } from './config.js';
import { parseAnchors } from './anchorParser.js';
import { resolveSection, buildSectionError } from './sectionResolver.js';
import { launchVSCode, closeVSCode } from './vscodeLauncher.js';
import { startRecording } from './recorder.js';
import { convertToGif } from './converter.js';
import * as log from './logger.js';

const execFileAsync = promisify(execFile);

const AUTOMATION_DIR = path.join(__dirname, '.');
const AUTOMATION_SCRIPT = path.join(AUTOMATION_DIR, 'automation.py');
const DEMO_USER_DATA_DIR = path.join(__dirname, '.vscode-demo');

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

export function parseCliArgs(argv: string[]): CliOptions {
  const opts: CliOptions = {
    duration: 5,
    width: 1280,
    height: 800,
    keepMp4: false,
  };
  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--section':  opts.section = argv[++i]; break;
      case '--duration': opts.duration = Number(argv[++i]); break;
      case '--output':   opts.output = argv[++i]; break;
      case '--keep-mp4': opts.keepMp4 = true; break;
      case '--width':    opts.width = Number(argv[++i]); break;
      case '--height':   opts.height = Number(argv[++i]); break;
    }
  }
  return opts;
}

// ---------------------------------------------------------------------------
// Cleanup — kill ALL VSCode instances using the demo profile
// ---------------------------------------------------------------------------

function killDemoVSCode(): void {
  try {
    // Find and kill any VSCode processes using our demo user-data-dir
    execSync(`pkill -f "user-data-dir.*\\.vscode-demo" 2>/dev/null || true`, { stdio: 'ignore' });
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Dependency checks
// ---------------------------------------------------------------------------

async function checkDependencies(): Promise<void> {
  try { await execFileAsync('ffmpeg', ['-version']); } catch {
    throw new Error('ffmpeg is not installed. Install with: brew install ffmpeg');
  }
  try { await execFileAsync('uv', ['--version']); } catch {
    throw new Error('uv is not installed. Install with: brew install uv');
  }
  try { await execFileAsync('code', ['--version']); } catch {
    throw new Error('VSCode CLI not available. Ensure "code" is on PATH.');
  }
}

// ---------------------------------------------------------------------------
// Automation helper
// ---------------------------------------------------------------------------

async function runAutomation(action: string, extraArgs: string[] = []): Promise<void> {
  await execFileAsync('uv', [
    'run', '--project', AUTOMATION_DIR, 'python',
    AUTOMATION_SCRIPT, action, ...extraArgs,
  ]);
}

// ---------------------------------------------------------------------------
// Build & install extension
// ---------------------------------------------------------------------------

async function buildAndInstallExtension(): Promise<void> {
  log.info('Building extension VSIX...');
  try {
    await execFileAsync('npm', ['run', 'package']);
  } catch (err) {
    throw new Error(`Failed to build VSIX: ${err instanceof Error ? err.message : String(err)}`);
  }

  const distFiles = await readdir('dist');
  const vsix = distFiles.find(f => f.endsWith('.vsix'));
  if (!vsix) throw new Error('No .vsix found in dist/');

  log.info('Installing extension into demo profile...');
  try {
    await execFileAsync('code', [
      `--user-data-dir=${DEMO_USER_DATA_DIR}`,
      '--install-extension', path.join('dist', vsix),
      '--force',
    ]);
  } catch (err) {
    throw new Error(`Failed to install extension: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ---------------------------------------------------------------------------
// Process one section
// ---------------------------------------------------------------------------

async function processSection(
  name: string,
  anchor: SectionAnchor,
  opts: CliOptions,
  timing: ReturnType<typeof loadTimingConfig>,
  duration: number,
): Promise<SectionResult> {
  log.step(name, 'start');
  let pid: number | undefined;

  try {
    // Launch VSCode
    const launchResult = await launchVSCode({
      filePath: 'examples/demo.md',
      width: opts.width ?? 1280,
      height: opts.height ?? 800,
      waitAfterLaunch: timing.vscodeLaunchWait,
    });
    pid = launchResult.pid;

    // Open preview
    log.info(`Opening preview...`);
    await runAutomation('open_preview');

    // Scroll to section line
    log.info(`Scrolling to line ${anchor.line}...`);
    await runAutomation('scroll_to_line', ['--line', String(anchor.line)]);

    // Record
    const mp4Path = getOutputPath(name, opts.output).replace(/\.gif$/, '.mp4');
    const gifPath = getOutputPath(name, opts.output);

    await startRecording({ outputPath: mp4Path, duration });

    // Convert
    await convertToGif({
      inputPath: mp4Path,
      outputPath: gifPath,
      keepSource: opts.keepMp4,
    });

    // Close VSCode
    if (pid !== undefined) {
      await closeVSCode(pid);
      pid = undefined;
    }
    // Extra cleanup: kill any lingering demo VSCode
    killDemoVSCode();

    // Get file size
    let fileSize: number | undefined;
    try { fileSize = (await stat(gifPath)).size; } catch { /* */ }

    log.step(name, 'done');
    return { section: name, status: 'success', outputPath: gifPath, fileSize };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.step(name, 'fail');
    log.error(`${name}: ${message}`);

    // Always cleanup VSCode
    if (pid !== undefined) {
      try { await closeVSCode(pid); } catch { /* */ }
    }
    killDemoVSCode();

    return { section: name, status: 'skipped', error: message };
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  // 0. Kill any leftover demo VSCode instances
  log.info('Cleaning up previous demo VSCode instances...');
  killDemoVSCode();

  // 1. Check dependencies
  await checkDependencies();

  // 2. Build & install extension
  await buildAndInstallExtension();

  // 3. Parse CLI args
  const opts = parseCliArgs(process.argv.slice(2));
  const timing = loadTimingConfig();
  const duration = opts.duration ?? timing.defaultDuration;

  // 4. Read & parse demo.md
  const demoPath = path.resolve('examples/demo.md');
  const content = await readFile(demoPath, 'utf-8');
  const anchors = parseAnchors(content);

  if (anchors.length === 0) {
    log.error('No section anchors found in demo.md.');
    process.exit(1);
  }

  // 5. Resolve sections
  let targetSections: { name: string; anchor: SectionAnchor }[];
  if (opts.section) {
    const resolved = resolveSection(anchors, opts.section);
    if (!resolved) {
      log.error(buildSectionError(opts.section, anchors));
      process.exit(1);
    }
    targetSections = [{ name: opts.section, anchor: resolved }];
  } else {
    targetSections = Object.keys(SECTION_MAP)
      .map(name => ({ name, anchor: resolveSection(anchors, name) }))
      .filter((s): s is { name: string; anchor: SectionAnchor } => s.anchor !== undefined);
  }

  // 6. Create output dir
  await mkdir('demo', { recursive: true });

  // 7. Process each section
  const results: SectionResult[] = [];
  try {
    for (const { name, anchor } of targetSections) {
      const result = await processSection(name, anchor, opts, timing, duration);
      results.push(result);

      if (result.status === 'failed') break;
    }
  } finally {
    // Final cleanup — always kill demo VSCode
    killDemoVSCode();
  }

  // 8. Summary
  log.summary(results);

  // Exit with error code if any failures
  const hasFailure = results.some(r => r.status === 'failed');
  if (hasFailure) process.exit(1);
}

const isDirectRun =
  typeof require !== 'undefined'
    ? require.main === module
    : process.argv[1]?.endsWith('index.ts');

if (isDirectRun) {
  main().catch((err) => {
    killDemoVSCode(); // cleanup on crash too
    log.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
