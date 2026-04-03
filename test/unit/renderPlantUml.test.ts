import { beforeEach, describe, expect, it, vi } from 'vitest';

const accessMock = vi.fn();
const readFileMock = vi.fn();
const runProcessMock = vi.fn();
const createTempFileMock = vi.fn();
const getConfigMock = vi.fn();

vi.mock('node:fs/promises', () => ({
  default: {
    access: accessMock,
    readFile: readFileMock
  }
}));

vi.mock('../../src/infra/runProcess', () => ({
  runProcess: runProcessMock
}));

vi.mock('../../src/infra/tempFiles', () => ({
  createTempFile: createTempFileMock
}));

vi.mock('../../src/infra/config', () => ({
  getConfig: getConfigMock
}));

import { renderPlantUml } from '../../src/renderers/renderPlantUml';

describe('renderPlantUml', () => {
  const context = { extensionPath: '/ext' } as any;

  beforeEach(() => {
    accessMock.mockReset();
    readFileMock.mockReset();
    runProcessMock.mockReset();
    createTempFileMock.mockReset();
    getConfigMock.mockReset();
    getConfigMock.mockReturnValue({ plantUmlMode: 'bundled-jar', javaPath: 'java' });
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

  it('returns process failure (java missing / syntax error)', async () => {
    accessMock.mockResolvedValue(undefined);
    createTempFileMock.mockResolvedValue('/tmp/in.puml');
    runProcessMock.mockResolvedValue({ exitCode: 1, stdout: '', stderr: 'java: command not found', timedOut: false });

    const result = await renderPlantUml('@startuml\nA->\n@enduml', context);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('java: command not found');
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
