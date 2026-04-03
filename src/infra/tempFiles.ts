import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export async function ensureTempRoot(): Promise<string> {
  const dir = path.join(os.tmpdir(), 'markdown-studio');
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export async function createTempFile(ext: string, content: string): Promise<string> {
  const root = await ensureTempRoot();
  const filePath = path.join(root, `${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`);
  await fs.writeFile(filePath, content, 'utf8');
  return filePath;
}
