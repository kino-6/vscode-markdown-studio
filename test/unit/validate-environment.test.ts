import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createVscodeMock } from '../helpers/vscodeMock';

describe('validateEnvironmentCommand', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('reports success path', async () => {
    const { module, state } = createVscodeMock({ 'markdownStudio.java.path': 'java' });
    vi.doMock('vscode', () => module);
    vi.doMock('../../src/infra/runProcess', () => ({
      runProcess: vi.fn().mockResolvedValue({ exitCode: 0, stdout: '', stderr: 'java version "17"', timedOut: false })
    }));
    vi.doMock('node:fs/promises', () => ({
      default: {
        access: vi.fn().mockResolvedValue(undefined),
        writeFile: vi.fn().mockResolvedValue(undefined),
        unlink: vi.fn().mockResolvedValue(undefined)
      },
      access: vi.fn().mockResolvedValue(undefined),
      writeFile: vi.fn().mockResolvedValue(undefined),
      unlink: vi.fn().mockResolvedValue(undefined)
    }));

    const { validateEnvironmentCommand } = await import('../../src/commands/validateEnvironment');
    await validateEnvironmentCommand({ extensionPath: '/ext' } as any);

    expect(state.infoMessages).toHaveLength(1);
    expect(state.infoMessages[0]).toContain('✅ Java detected');
    expect(state.infoMessages[0]).toContain('✅ Bundled PlantUML jar found');
    expect(state.infoMessages[0]).toContain('✅ Temp directory writable');
  });

  it('reports missing Java', async () => {
    const { module, state } = createVscodeMock({ 'markdownStudio.java.path': '/missing/java' });
    vi.doMock('vscode', () => module);
    vi.doMock('../../src/infra/runProcess', () => ({
      runProcess: vi.fn().mockResolvedValue({ exitCode: -1, stdout: '', stderr: 'ENOENT', timedOut: false })
    }));
    vi.doMock('node:fs/promises', () => ({
      default: {
        access: vi.fn().mockResolvedValue(undefined),
        writeFile: vi.fn().mockResolvedValue(undefined),
        unlink: vi.fn().mockResolvedValue(undefined)
      },
      access: vi.fn().mockResolvedValue(undefined),
      writeFile: vi.fn().mockResolvedValue(undefined),
      unlink: vi.fn().mockResolvedValue(undefined)
    }));

    const { validateEnvironmentCommand } = await import('../../src/commands/validateEnvironment');
    await validateEnvironmentCommand({ extensionPath: '/ext' } as any);

    expect(state.warningMessages).toHaveLength(1);
    expect(state.warningMessages[0]).toContain('❌ Java missing or inaccessible');
  });

  it('reports missing jar and unwritable temp directory', async () => {
    const { module, state } = createVscodeMock({ 'markdownStudio.java.path': 'java' });
    vi.doMock('vscode', () => module);
    vi.doMock('../../src/infra/runProcess', () => ({
      runProcess: vi.fn().mockResolvedValue({ exitCode: 0, stdout: '', stderr: 'java version "17"', timedOut: false })
    }));
    vi.doMock('node:fs/promises', () => ({
      default: {
        access: vi.fn().mockRejectedValue(new Error('missing')),
        writeFile: vi.fn().mockRejectedValue(new Error('readonly')),
        unlink: vi.fn()
      },
      access: vi.fn().mockRejectedValue(new Error('missing')),
      writeFile: vi.fn().mockRejectedValue(new Error('readonly')),
      unlink: vi.fn()
    }));

    const { validateEnvironmentCommand } = await import('../../src/commands/validateEnvironment');
    await validateEnvironmentCommand({ extensionPath: '/ext' } as any);

    expect(state.warningMessages).toHaveLength(1);
    const message = state.warningMessages[0];
    expect(message).toContain('❌ Bundled PlantUML jar missing');
    expect(message).toContain('❌ Temp directory is not writable');
  });
});
