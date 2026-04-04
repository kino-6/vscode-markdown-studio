import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

/** Tracks all temp files created so they can be cleaned up on deactivate. */
const trackedFiles: string[] = [];

export async function ensureTempRoot(): Promise<string> {
  const dir = path.join(os.tmpdir(), 'markdown-studio');
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export async function createTempFile(ext: string, content: string): Promise<string> {
  const root = await ensureTempRoot();
  const filePath = path.join(root, `${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`);
  await fs.writeFile(filePath, content, 'utf8');
  trackedFiles.push(filePath);
  return filePath;
}

/**
 * Deletes all tracked temp files and their corresponding `.svg` outputs.
 * Errors on individual files are silently ignored (files may already be gone).
 */
export async function cleanupTempFiles(): Promise<void> {
  const targets = new Set<string>();
  for (const f of trackedFiles) {
    targets.add(f);
    // PlantUML generates a .svg next to the .puml input
    if (f.endsWith('.puml')) {
      targets.add(f.replace(/\.puml$/, '.svg'));
    }
  }
  trackedFiles.length = 0;

  await Promise.allSettled(
    [...targets].map((t) => fs.unlink(t))
  );
}

/** @internal Exposed for testing only. */
export function _getTrackedFiles(): readonly string[] {
  return trackedFiles;
}

/** @internal Exposed for testing only. */
export function _resetTrackedFiles(): void {
  trackedFiles.length = 0;
}
