import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:fs/promises', () => {
  const accessMock = vi.fn();
  const readFileMock = vi.fn();
  return {
    default: { access: accessMock, readFile: readFileMock },
    __accessMock: accessMock,
    __readFileMock: readFileMock
  };
});

vi.mock('../../src/infra/runProcess', () => {
  const runProcessMock = vi.fn();
  return { runProcess: runProcessMock, __runProcessMock: runProcessMock };
});

vi.mock('../../src/infra/tempFiles', () => {
  const createTempFileMock = vi.fn();
  return { createTempFile: createTempFileMock, __createTempFileMock: createTempFileMock };
});

vi.mock('../../src/infra/config', () => {
  const getConfigMock = vi.fn();
  return { getConfig: getConfigMock, __getConfigMock: getConfigMock };
});

vi.mock('../../src/extension', () => ({
  dependencyStatus: undefined
}));

import * as fsModule from 'node:fs/promises';
import * as runProcessModule from '../../src/infra/runProcess';
import * as tempFilesModule from '../../src/infra/tempFiles';
import * as configModule from '../../src/infra/config';
import * as extensionModule from '../../src/extension';
import { clearPlantUmlCache, renderPlantUml } from '../../src/renderers/renderPlantUml';

const accessMock = (fsModule as any).__accessMock as ReturnType<typeof vi.fn>;
const readFileMock = (fsModule as any).__readFileMock as ReturnType<typeof vi.fn>;
const runProcessMock = (runProcessModule as any).__runProcessMock as ReturnType<typeof vi.fn>;
const createTempFileMock = (tempFilesModule as any).__createTempFileMock as ReturnType<typeof vi.fn>;
const getConfigMock = (configModule as any).__getConfigMock as ReturnType<typeof vi.fn>;

describe('renderPlantUml', () => {
  const context = { extensionPath: '/ext' } as any;

  beforeEach(() => {
    clearPlantUmlCache();
    accessMock.mockReset();
    readFileMock.mockReset();
    runProcessMock.mockReset();
    createTempFileMock.mockReset();
    getConfigMock.mockReset();
    getConfigMock.mockReturnValue({ plantUmlMode: 'bundled-jar', javaPath: 'java' });
    (extensionModule as any).dependencyStatus = undefined;
  });

  it('returns unsupported mode error', async () => {
    getConfigMock.mockReturnValue({ plantUmlMode: 'docker', javaPath: 'java' });

    const result = await renderPlantUml('@startuml\nA->B\n@enduml', context);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('reserved for future MVP iterations');
  });

  it('returns missing jar error', async () => {
    accessMock.mockRejectedValue(new Error('no jar'));

    const result = await renderPlantUml('@startuml\nA->B\n@enduml', context);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('jar missing');
  });

  it('returns actionable error when java is missing and no managed path', async () => {
    accessMock.mockResolvedValue(undefined);
    createTempFileMock.mockResolvedValue('/tmp/in.puml');
    runProcessMock.mockResolvedValue({ exitCode: 1, stdout: '', stderr: 'java: command not found', timedOut: false });

    const result = await renderPlantUml('@startuml\nA->\n@enduml', context);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('Setup Dependencies');
  });

  it('uses managed java path when dependencyStatus is available', async () => {
    (extensionModule as any).dependencyStatus = { allReady: true, javaPath: '/managed/java', errors: [] };
    accessMock.mockResolvedValue(undefined);
    createTempFileMock.mockResolvedValue('/tmp/in.puml');
    runProcessMock.mockResolvedValue({ exitCode: 0, stdout: '', stderr: '', timedOut: false });
    readFileMock.mockResolvedValue('<svg><rect/></svg>');

    await renderPlantUml('@startuml\nA->B\n@enduml', context);
    expect(runProcessMock).toHaveBeenCalledWith(
      '/managed/java',
      expect.any(Array),
      15000
    );
  });

  it('falls back to config javaPath when dependencyStatus has no javaPath', async () => {
    (extensionModule as any).dependencyStatus = { allReady: false, errors: ['Corretto failed'] };
    getConfigMock.mockReturnValue({ plantUmlMode: 'bundled-jar', javaPath: '/custom/java' });
    accessMock.mockResolvedValue(undefined);
    createTempFileMock.mockResolvedValue('/tmp/in.puml');
    runProcessMock.mockResolvedValue({ exitCode: 0, stdout: '', stderr: '', timedOut: false });
    readFileMock.mockResolvedValue('<svg><rect/></svg>');

    await renderPlantUml('@startuml\nA->B\n@enduml', context);
    expect(runProcessMock).toHaveBeenCalledWith(
      '/custom/java',
      expect.any(Array),
      15000
    );
  });

  it('returns sanitized svg on success', async () => {
    accessMock.mockResolvedValue(undefined);
    createTempFileMock.mockResolvedValue('/tmp/in.puml');
    runProcessMock.mockResolvedValue({ exitCode: 0, stdout: '', stderr: '', timedOut: false });
    readFileMock.mockResolvedValue('<svg><script>alert(1)</script><rect/></svg>');

    const result = await renderPlantUml('@startuml\nA->B\n@enduml', context);
    expect(result.ok).toBe(true);
    expect(result.svg).toContain('<rect');
    expect(result.svg).not.toContain('<script');
  });
});
