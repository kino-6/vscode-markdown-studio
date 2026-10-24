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
import { clearPlantUmlCache, plantUmlProcessEnv, renderPlantUml, renderPlantUmlBatch, setJavaMissingHandler } from '../../src/renderers/renderPlantUml';

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

  it('retries after a timeout instead of caching the failure', async () => {
    accessMock.mockResolvedValue(undefined);
    createTempFileMock.mockResolvedValue('/tmp/in.puml');
    runProcessMock
      .mockResolvedValueOnce({ exitCode: -1, stdout: '', stderr: '', timedOut: true })
      .mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '', timedOut: false });
    readFileMock.mockResolvedValue('<svg><rect/></svg>');

    const first = await renderPlantUml('@startuml\nA->B\n@enduml', context);
    const second = await renderPlantUml('@startuml\nA->B\n@enduml', context);
    expect(first.ok).toBe(false);
    expect(second.ok).toBe(true);
    expect(runProcessMock).toHaveBeenCalledTimes(2);
  });

  it('drops PLANTUML_SECURITY_PROFILE so a user environment cannot enable URL fetching', () => {
    const env = plantUmlProcessEnv({ PATH: '/bin', PLANTUML_SECURITY_PROFILE: 'UNSECURE', plantuml_security_profile: 'INTERNET', JAVA_HOME: '/jdk' });
    expect(env).toEqual({ PATH: '/bin', JAVA_HOME: '/jdk' });
  });

  it('passes the sanitized environment to the Java process', async () => {
    accessMock.mockResolvedValue(undefined);
    createTempFileMock.mockResolvedValue('/tmp/in.puml');
    runProcessMock.mockResolvedValue({ exitCode: 0, stdout: '', stderr: '', timedOut: false });
    readFileMock.mockResolvedValue('<svg/>');
    process.env.PLANTUML_SECURITY_PROFILE = 'UNSECURE';
    try {
      await renderPlantUml('@startuml\nA->B\n@enduml', context);
    } finally {
      delete process.env.PLANTUML_SECURITY_PROFILE;
    }
    const env = runProcessMock.mock.calls[0][4] as NodeJS.ProcessEnv;
    expect(env).toBeDefined();
    expect(env.PLANTUML_SECURITY_PROFILE).toBeUndefined();
  });

  it('notifies the Java-missing handler so the extension can offer a download', async () => {
    const handler = vi.fn();
    setJavaMissingHandler(handler);
    accessMock.mockResolvedValue(undefined);
    createTempFileMock.mockResolvedValue('/tmp/in.puml');
    runProcessMock.mockResolvedValue({ exitCode: 127, stdout: '', stderr: 'java: command not found', timedOut: false });

    await renderPlantUml('@startuml\nA->B\n@enduml', context);
    setJavaMissingHandler(undefined);
    expect(handler).toHaveBeenCalled();
  });

  it('does not notify the Java-missing handler for diagram syntax errors', async () => {
    const handler = vi.fn();
    setJavaMissingHandler(handler);
    accessMock.mockResolvedValue(undefined);
    createTempFileMock.mockResolvedValue('/tmp/in.puml');
    runProcessMock.mockResolvedValue({ exitCode: 200, stdout: '', stderr: 'Syntax Error?', timedOut: false });

    await renderPlantUml('@startuml\nA->\n@enduml', context);
    setJavaMissingHandler(undefined);
    expect(handler).not.toHaveBeenCalled();
  });

  it('retries after Java could not be started', async () => {
    accessMock.mockResolvedValue(undefined);
    createTempFileMock.mockResolvedValue('/tmp/in.puml');
    runProcessMock
      .mockResolvedValueOnce({ exitCode: 127, stdout: '', stderr: 'java: command not found', timedOut: false })
      .mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '', timedOut: false });
    readFileMock.mockResolvedValue('<svg><rect/></svg>');

    await renderPlantUml('@startuml\nA->B\n@enduml', context);
    const second = await renderPlantUml('@startuml\nA->B\n@enduml', context);
    expect(second.ok).toBe(true);
  });

  it('does not cache setup failures such as a missing bundled JAR', async () => {
    accessMock.mockRejectedValueOnce(new Error('no jar')).mockResolvedValue(undefined);
    createTempFileMock.mockResolvedValue('/tmp/in.puml');
    runProcessMock.mockResolvedValue({ exitCode: 0, stdout: '', stderr: '', timedOut: false });
    readFileMock.mockResolvedValue('<svg><rect/></svg>');

    expect((await renderPlantUml('@startuml\nA->B\n@enduml', context)).ok).toBe(false);
    expect((await renderPlantUml('@startuml\nA->B\n@enduml', context)).ok).toBe(true);
  });

  it('caches syntax errors so a broken diagram does not start Java on every render', async () => {
    accessMock.mockResolvedValue(undefined);
    createTempFileMock.mockResolvedValue('/tmp/in.puml');
    runProcessMock.mockResolvedValue({ exitCode: 200, stdout: '', stderr: 'Syntax Error?', timedOut: false });

    await renderPlantUml('@startuml\nA->\n@enduml', context);
    const second = await renderPlantUml('@startuml\nA->\n@enduml', context);
    expect(second.ok).toBe(false);
    expect(runProcessMock).toHaveBeenCalledTimes(1);
  });

  it('batch rendering also retries timed-out diagrams', async () => {
    accessMock.mockResolvedValue(undefined);
    createTempFileMock.mockResolvedValue('/tmp/in.puml');
    runProcessMock.mockResolvedValue({ exitCode: -1, stdout: '', stderr: '', timedOut: true });

    await renderPlantUmlBatch(['@startuml\nA->B\n@enduml'], context);
    const callsAfterFirst = runProcessMock.mock.calls.length;
    runProcessMock.mockResolvedValue({ exitCode: 0, stdout: '', stderr: '', timedOut: false });
    readFileMock.mockResolvedValue('<svg><rect/></svg>');
    const [second] = await renderPlantUmlBatch(['@startuml\nA->B\n@enduml'], context);
    expect(second.ok).toBe(true);
    expect(runProcessMock.mock.calls.length).toBeGreaterThan(callsAfterFirst);
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
      0,
      undefined,
      expect.any(Object),
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
      0,
      undefined,
      expect.any(Object),
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

  it('renders multiple diagrams with one PlantUML process', async () => {
    accessMock.mockResolvedValue(undefined);
    createTempFileMock
      .mockResolvedValueOnce('/tmp/one.puml')
      .mockResolvedValueOnce('/tmp/two.puml');
    runProcessMock.mockResolvedValue({ exitCode: 0, stdout: '', stderr: '', timedOut: false });
    readFileMock.mockImplementation(async (filePath: string) => {
      if (filePath === '/tmp/one.svg') return '<svg><text>one</text></svg>';
      if (filePath === '/tmp/two.svg') return '<svg><text>two</text></svg>';
      throw new Error('missing');
    });

    const results = await renderPlantUmlBatch([
      '@startuml\nA->B: one\n@enduml',
      '@startuml\nA->B: two\n@enduml',
    ], context);

    expect(runProcessMock).toHaveBeenCalledTimes(1);
    expect(runProcessMock).toHaveBeenCalledWith(
      'java',
      expect.arrayContaining(['/tmp/one.puml', '/tmp/two.puml']),
      0,
      undefined,
      expect.any(Object),
    );
    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({ ok: true, svg: '<svg><text>one</text></svg>' });
    expect(results[1]).toMatchObject({ ok: true, svg: '<svg><text>two</text></svg>' });
  });

  it('falls back to individual renders when the batch process fails', async () => {
    accessMock.mockResolvedValue(undefined);
    createTempFileMock
      .mockResolvedValueOnce('/tmp/batch-one.puml')
      .mockResolvedValueOnce('/tmp/batch-two.puml')
      .mockResolvedValueOnce('/tmp/single-one.puml')
      .mockResolvedValueOnce('/tmp/single-two.puml');
    runProcessMock
      .mockResolvedValueOnce({ exitCode: 1, stdout: '', stderr: 'batch failed', timedOut: false })
      .mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '', timedOut: false })
      .mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '', timedOut: false });
    readFileMock.mockImplementation(async (filePath: string) => {
      if (filePath === '/tmp/single-one.svg') return '<svg><text>one</text></svg>';
      if (filePath === '/tmp/single-two.svg') return '<svg><text>two</text></svg>';
      throw new Error('missing');
    });

    const results = await renderPlantUmlBatch([
      '@startuml\nA->B: one\n@enduml',
      '@startuml\nA->B: two\n@enduml',
    ], context);

    expect(runProcessMock).toHaveBeenCalledTimes(3);
    expect(results[0]).toMatchObject({ ok: true, svg: '<svg><text>one</text></svg>' });
    expect(results[1]).toMatchObject({ ok: true, svg: '<svg><text>two</text></svg>' });
  });
});
