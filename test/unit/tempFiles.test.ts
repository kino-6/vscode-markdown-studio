import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:fs/promises', () => {
  const mkdirMock = vi.fn().mockResolvedValue(undefined);
  const writeFileMock = vi.fn().mockResolvedValue(undefined);
  const unlinkMock = vi.fn().mockResolvedValue(undefined);
  return {
    default: {
      mkdir: mkdirMock,
      writeFile: writeFileMock,
      unlink: unlinkMock,
    },
    __mkdirMock: mkdirMock,
    __writeFileMock: writeFileMock,
    __unlinkMock: unlinkMock,
  };
});

import * as fsModule from 'node:fs/promises';
import {
  createTempFile,
  cleanupTempFiles,
  _getTrackedFiles,
  _resetTrackedFiles,
} from '../../src/infra/tempFiles';

const unlinkMock = (fsModule as any).__unlinkMock as ReturnType<typeof vi.fn>;

describe('tempFiles tracking & cleanup', () => {
  beforeEach(() => {
    _resetTrackedFiles();
    unlinkMock.mockReset().mockResolvedValue(undefined);
  });

  it('tracks files created via createTempFile', async () => {
    const p = await createTempFile('puml', '@startuml\nA->B\n@enduml');
    expect(_getTrackedFiles()).toContain(p);
  });

  it('cleanupTempFiles deletes tracked .puml and its .svg sibling', async () => {
    const p = await createTempFile('puml', 'content');
    await cleanupTempFiles();

    const deleted = unlinkMock.mock.calls.map((c: any[]) => c[0] as string);
    expect(deleted).toContain(p);
    expect(deleted).toContain(p.replace(/\.puml$/, '.svg'));
  });

  it('cleanupTempFiles clears the tracking array', async () => {
    await createTempFile('puml', 'a');
    await createTempFile('txt', 'b');
    expect(_getTrackedFiles().length).toBe(2);

    await cleanupTempFiles();
    expect(_getTrackedFiles().length).toBe(0);
  });

  it('cleanupTempFiles does not add .svg sibling for non-.puml files', async () => {
    const p = await createTempFile('txt', 'hello');
    await cleanupTempFiles();

    const deleted = unlinkMock.mock.calls.map((c: any[]) => c[0] as string);
    expect(deleted).toEqual([p]);
  });

  it('cleanupTempFiles ignores unlink errors gracefully', async () => {
    await createTempFile('puml', 'x');
    unlinkMock.mockRejectedValue(new Error('ENOENT'));

    // Should not throw
    await expect(cleanupTempFiles()).resolves.toBeUndefined();
  });
});
