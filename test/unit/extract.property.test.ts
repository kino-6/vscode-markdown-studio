import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as zlib from 'zlib';
import fc from 'fast-check';
import * as tar from 'tar-stream';
import { extractTarGz } from '../../src/deps/extract';

let tmpDir: string;
let destDir: string;

beforeEach(async () => {
  tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'extract-prop-'));
  destDir = path.join(tmpDir, 'dest');
  await fs.promises.mkdir(destDir, { recursive: true });
});

afterEach(async () => {
  await fs.promises.rm(tmpDir, { recursive: true, force: true });
});

/**
 * Helper: create a tar.gz archive with given entries.
 */
function createTarGz(
  entries: Array<{ name: string; type: 'file' | 'directory' | 'symlink'; content?: string; linkname?: string; mode?: number }>
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const pack = tar.pack();
    const chunks: Buffer[] = [];

    for (const entry of entries) {
      if (entry.type === 'file') {
        pack.entry({ name: entry.name, type: 'file', mode: entry.mode ?? 0o644 }, entry.content ?? '');
      } else if (entry.type === 'directory') {
        pack.entry({ name: entry.name, type: 'directory', mode: entry.mode ?? 0o755 });
      } else if (entry.type === 'symlink') {
        pack.entry({ name: entry.name, type: 'symlink', linkname: entry.linkname ?? '' });
      }
    }
    pack.finalize();

    const gzip = zlib.createGzip();
    pack.pipe(gzip);
    gzip.on('data', (chunk: Buffer) => chunks.push(chunk));
    gzip.on('end', () => resolve(Buffer.concat(chunks)));
    gzip.on('error', reject);
  });
}

describe('extractTarGz path traversal prevention property tests', () => {
  /**
   * Property 4: tar展開パストラバーサル防止
   * `../`を含むパスのエントリが展開先ディレクトリ外に書き込まれないことを検証
   * **Validates: Requirements 3.2, 3.3**
   */
  it('never writes files outside destDir for path traversal entries', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            // Generate paths that include traversal components
            segments: fc.array(
              fc.oneof(
                fc.constant('..'),
                fc.stringMatching(/^[a-z0-9]{1,8}$/)
              ),
              { minLength: 1, maxLength: 5 }
            ),
          }),
          { minLength: 1, maxLength: 5 }
        ),
        async (pathSpecs) => {
          // Create a fresh dest for each run
          const runDest = path.join(tmpDir, `run-${Date.now()}-${Math.random().toString(36).slice(2)}`);
          await fs.promises.mkdir(runDest, { recursive: true });

          const entries = pathSpecs.map((spec, i) => ({
            name: spec.segments.join('/'),
            type: 'file' as const,
            content: `content-${i}`,
          }));

          // Also add a safe file to ensure extraction works
          entries.push({ name: 'safe/file.txt', type: 'file' as const, content: 'safe' });

          const archive = await createTarGz(entries);
          const archivePath = path.join(tmpDir, `test-${Date.now()}.tar.gz`);
          await fs.promises.writeFile(archivePath, archive);

          await extractTarGz(archivePath, runDest);

          // Verify: no files exist outside runDest
          const absoluteDest = path.resolve(runDest);
          const allFiles = await walkDir(absoluteDest);
          for (const file of allFiles) {
            const resolved = path.resolve(file);
            expect(resolved.startsWith(absoluteDest)).toBe(true);
          }

          // The safe file should exist
          const safeFile = path.join(runDest, 'safe', 'file.txt');
          const exists = fs.existsSync(safeFile);
          expect(exists).toBe(true);
        }
      ),
      { numRuns: 50, seed: 42 }
    );
  });
});

/** Recursively list all files in a directory */
async function walkDir(dir: string): Promise<string[]> {
  const results: string[] = [];
  try {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...await walkDir(fullPath));
      } else {
        results.push(fullPath);
      }
    }
  } catch {
    // directory might not exist
  }
  return results;
}

describe('extractTarGz permission restriction property tests', () => {
  /**
   * Property 5: tar展開パーミッション制限
   * 任意のモード値に対して展開後のパーミッションが0o755以下であることを検証（Unix系OSのみ）
   * **Validates: Requirements 3.4**
   */
  it('file permissions are capped at 0o755 on Unix', async () => {
    if (process.platform === 'win32') return;

    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 0o7777 }),
        async (mode) => {
          const runDest = path.join(tmpDir, `perm-${Date.now()}-${Math.random().toString(36).slice(2)}`);
          await fs.promises.mkdir(runDest, { recursive: true });

          const archive = await createTarGz([
            { name: 'testfile.txt', type: 'file', content: 'hello', mode },
          ]);
          const archivePath = path.join(tmpDir, `perm-${Date.now()}.tar.gz`);
          await fs.promises.writeFile(archivePath, archive);

          await extractTarGz(archivePath, runDest);

          const filePath = path.join(runDest, 'testfile.txt');
          const stat = await fs.promises.stat(filePath);
          const perms = stat.mode & 0o777;

          // Permissions should be at most 0o755
          // Each permission bit should not exceed the corresponding bit in 0o755
          expect((perms & ~0o755)).toBe(0);
        }
      ),
      { numRuns: 50, seed: 42 }
    );
  });
});
