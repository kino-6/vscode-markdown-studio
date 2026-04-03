import { beforeEach, describe, expect, it, vi } from 'vitest';

const parseMock = vi.fn();

vi.mock('mermaid', () => ({
  default: {
    parse: parseMock
  }
}));

describe('mermaid renderer', () => {
  beforeEach(() => {
    parseMock.mockReset();
  });

  it('returns placeholder html for valid syntax', async () => {
    parseMock.mockResolvedValue(undefined);
    const { renderMermaidBlock } = await import('../../src/renderers/renderMermaid');
    const result = await renderMermaidBlock('graph TD;A-->B;');

    expect(result.ok).toBe(true);
    expect(result.html).toContain('mermaid-host');
    expect(result.html).toContain('data-mermaid-src=');
  });

  it('returns readable block error for invalid syntax', async () => {
    parseMock.mockRejectedValue(new Error('Mermaid parse error'));
    const { renderMermaidBlock } = await import('../../src/renderers/renderMermaid');
    const result = await renderMermaidBlock('graph ???');

    expect(result.ok).toBe(false);
    expect(result.error).toContain('Mermaid parse error');
    expect(result.html).toContain('Mermaid render error');
    expect(result.html).toContain('ms-error');
  });
});

describe('plantuml renderer', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns svg on successful local process render', async () => {
    vi.doMock('vscode', () => ({
      workspace: {
        getConfiguration: () => ({
          get: (k: string, fallback: unknown) => {
            if (k === 'plantuml.mode') return 'bundled-jar';
            if (k === 'java.path') return 'java';
            return fallback;
          }
        })
      }
    }));

    vi.doMock('node:fs/promises', () => ({
      default: {
        access: vi.fn().mockResolvedValue(undefined),
        readFile: vi.fn().mockResolvedValue('<svg><rect width="10" /></svg>')
      },
      access: vi.fn().mockResolvedValue(undefined),
      readFile: vi.fn().mockResolvedValue('<svg><rect width="10" /></svg>')
    }));

    vi.doMock('../../src/infra/runProcess', () => ({
      runProcess: vi.fn().mockResolvedValue({ exitCode: 0, stdout: '', stderr: '', timedOut: false })
    }));

    vi.doMock('../../src/infra/tempFiles', () => ({
      createTempFile: vi.fn().mockResolvedValue('/tmp/diagram.puml')
    }));

    const { renderPlantUml } = await import('../../src/renderers/renderPlantUml');
    const result = await renderPlantUml('@startuml\nA->B:hi\n@enduml', { extensionPath: '/ext' } as any);
    expect(result.ok).toBe(true);
    expect(result.svg).toContain('<svg');
  });

  it('returns syntax/process error when plantuml fails', async () => {
    vi.doMock('vscode', () => ({
      workspace: {
        getConfiguration: () => ({
          get: (k: string, fallback: unknown) => {
            if (k === 'plantuml.mode') return 'bundled-jar';
            if (k === 'java.path') return 'java';
            return fallback;
          }
        })
      }
    }));

    vi.doMock('node:fs/promises', () => ({
      default: {
        access: vi.fn().mockResolvedValue(undefined),
        readFile: vi.fn()
      },
      access: vi.fn().mockResolvedValue(undefined),
      readFile: vi.fn()
    }));

    vi.doMock('../../src/infra/runProcess', () => ({
      runProcess: vi.fn().mockResolvedValue({ exitCode: 1, stdout: '', stderr: 'Syntax Error?', timedOut: false })
    }));

    vi.doMock('../../src/infra/tempFiles', () => ({
      createTempFile: vi.fn().mockResolvedValue('/tmp/diagram.puml')
    }));

    const { renderPlantUml } = await import('../../src/renderers/renderPlantUml');
    const result = await renderPlantUml('@startuml\nA->\n@enduml', { extensionPath: '/ext' } as any);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('Syntax Error?');
  });

  it('handles java missing (process spawn failure) gracefully', async () => {
    vi.doMock('vscode', () => ({
      workspace: {
        getConfiguration: () => ({
          get: (k: string, fallback: unknown) => {
            if (k === 'plantuml.mode') return 'bundled-jar';
            if (k === 'java.path') return '/missing/java';
            return fallback;
          }
        })
      }
    }));

    vi.doMock('node:fs/promises', () => ({
      default: {
        access: vi.fn().mockResolvedValue(undefined),
        readFile: vi.fn()
      },
      access: vi.fn().mockResolvedValue(undefined),
      readFile: vi.fn()
    }));

    vi.doMock('../../src/infra/runProcess', () => ({
      runProcess: vi.fn().mockResolvedValue({ exitCode: -1, stdout: '', stderr: 'ENOENT', timedOut: false })
    }));

    vi.doMock('../../src/infra/tempFiles', () => ({
      createTempFile: vi.fn().mockResolvedValue('/tmp/diagram.puml')
    }));

    const { renderPlantUml } = await import('../../src/renderers/renderPlantUml');
    const result = await renderPlantUml('@startuml\nA->B:hi\n@enduml', { extensionPath: '/ext' } as any);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('ENOENT');
  });
});
