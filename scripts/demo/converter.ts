/**
 * Demo GIF automation — mp4 → GIF converter.
 *
 * Uses ffmpeg to convert a recorded mp4 file into an optimised GIF
 * with a two-pass palette generation filter.
 */

import { spawn } from 'node:child_process';
import { unlink } from 'node:fs/promises';
import type { ConvertOptions } from './config.js';
import * as log from './logger.js';

/**
 * Build the ffmpeg `-vf` filter string for high-quality GIF conversion.
 */
export function buildFfmpegFilter(fps: number, width: number): string {
  return `fps=${fps},scale=${width}:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`;
}

/**
 * Convert an mp4 file to GIF using ffmpeg.
 *
 * Uses `spawn` to avoid buffer overflow from ffmpeg's stderr output.
 * On failure the mp4 is kept for debugging.
 */
export async function convertToGif(options: ConvertOptions): Promise<void> {
  const fps = options.fps ?? 10;
  const width = options.width ?? 600;
  const filter = buildFfmpegFilter(fps, width);

  const args = ['-y', '-i', options.inputPath, '-vf', filter, options.outputPath];

  log.info(`Converting ${options.inputPath} → ${options.outputPath}...`);

  await new Promise<void>((resolve, reject) => {
    const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });

    let stderr = '';
    proc.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        const lastLine = stderr.trim().split('\n').pop() ?? '';
        reject(new Error(`GIF conversion failed (exit ${code}): ${lastLine}`));
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`GIF conversion failed: ${err.message}`));
    });
  });

  // Successful — remove source mp4 unless told to keep it
  if (!options.keepSource) {
    try {
      await unlink(options.inputPath);
    } catch {
      // ignore
    }
  }
}
