/**
 * Demo GIF automation — ffmpeg screen recorder.
 *
 * Uses ffmpeg with the macOS `avfoundation` input device to capture the
 * screen to an mp4 file. Provides a pre-flight check (`checkFfmpeg`) and
 * a Promise-based recording function (`startRecording`).
 */

import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { unlink } from 'node:fs/promises';
import type { RecordOptions } from './config.js';
import * as log from './logger.js';

const execFileAsync = promisify(execFile);

/**
 * Verify that ffmpeg is installed and reachable on `$PATH`.
 */
export async function checkFfmpeg(): Promise<void> {
  try {
    await execFileAsync('ffmpeg', ['-version']);
  } catch {
    throw new Error(
      'ffmpeg is not installed or not found on PATH. ' +
        'Install it with: brew install ffmpeg',
    );
  }
}

/**
 * Record the screen to an mp4 file using ffmpeg + avfoundation.
 *
 * Uses `spawn` instead of `execFile` because ffmpeg writes a lot of
 * progress data to stderr which can exceed the default buffer limit.
 */
export async function startRecording(options: RecordOptions): Promise<void> {
  await checkFfmpeg();

  const fps = options.fps ?? 30;
  const args = [
    '-y',
    '-f', 'avfoundation',
    '-framerate', String(fps),
    '-capture_cursor', '1',
    '-i', '2:none',
    '-t', String(options.duration),
    '-vf', 'format=yuv420p',
    options.outputPath,
  ];

  log.info(`Recording ${options.duration}s to ${options.outputPath}...`);

  // Timeout: recording duration + 15s grace period for ffmpeg startup.
  // If ffmpeg hangs (e.g. screen recording permission denied), we kill it.
  const timeoutMs = (options.duration + 15) * 1000;

  return new Promise<void>((resolve, reject) => {
    const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        proc.kill('SIGKILL');
        unlink(options.outputPath).catch(() => {});
        reject(new Error(
          `Recording timed out after ${timeoutMs / 1000}s. ` +
          'Check that screen recording permission is granted in ' +
          'System Settings → Privacy & Security → Screen Recording.',
        ));
      }
    }, timeoutMs);

    let stderr = '';
    proc.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    proc.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code === 0) {
        resolve();
      } else {
        unlink(options.outputPath).catch(() => {});
        const lastLine = stderr.trim().split('\n').pop() ?? '';
        reject(new Error(`Recording failed (exit ${code}): ${lastLine}`));
      }
    });

    proc.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      unlink(options.outputPath).catch(() => {});
      reject(new Error(`Recording failed: ${err.message}`));
    });
  });
}
