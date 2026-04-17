import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── vscode mock (factory must be self-contained — no top-level refs) ─
vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: () => ({ get: (_: string, f: unknown) => f }),
  },
  window: {
    showErrorMessage: vi.fn(),
    showInformationMessage: vi.fn(),
    showWarningMessage: vi.fn(),
    withProgress: vi.fn(),
    activeTextEditor: undefined as any,
  },
  ProgressLocation: { Notification: 15 },
}));

// ── exportToPdf mock ─────────────────────────────────────────────────
vi.mock('../../src/export/exportPdf', () => {
  class CancellationError extends Error {
    constructor() {
      super('Export cancelled by user');
      this.name = 'CancellationError';
    }
  }
  return {
    exportToPdf: vi.fn(),
    CancellationError,
  };
});

// ── renderPlantUml dependencies ──────────────────────────────────────
vi.mock('node:fs/promises', () => {
  const accessMock = vi.fn();
  const readFileMock = vi.fn();
  return {
    default: { access: accessMock, readFile: readFileMock },
    __accessMock: accessMock,
    __readFileMock: readFileMock,
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
  dependencyStatus: undefined,
}));

import * as vscode from 'vscode';
import * as fsModule from 'node:fs/promises';
import * as runProcessModule from '../../src/infra/runProcess';
import * as tempFilesModule from '../../src/infra/tempFiles';
import * as configModule from '../../src/infra/config';
import * as extensionModule from '../../src/extension';
import { exportToPdf } from '../../src/export/exportPdf';
import { exportPdfCommand } from '../../src/commands/exportPdf';
import { clearPlantUmlCache, renderPlantUml } from '../../src/renderers/renderPlantUml';

const showErrorMessage = vscode.window.showErrorMessage as unknown as ReturnType<typeof vi.fn>;
const withProgress = vscode.window.withProgress as unknown as ReturnType<typeof vi.fn>;
const exportToPdfMock = exportToPdf as unknown as ReturnType<typeof vi.fn>;

const accessMock = (fsModule as any).__accessMock as ReturnType<typeof vi.fn>;
const readFileMock = (fsModule as any).__readFileMock as ReturnType<typeof vi.fn>;
const runProcessMock = (runProcessModule as any).__runProcessMock as ReturnType<typeof vi.fn>;
const createTempFileMock = (tempFilesModule as any).__createTempFileMock as ReturnType<typeof vi.fn>;
const getConfigMock = (configModule as any).__getConfigMock as ReturnType<typeof vi.fn>;

// ── Tests ────────────────────────────────────────────────────────────

describe('PDF export error message contains "Setup Dependencies"', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set up activeTextEditor so the command doesn't bail early
    (vscode.window as any).activeTextEditor = {
      document: { languageId: 'markdown', getText: () => '# Hello', uri: { fsPath: '/tmp/test.md' } },
    };
  });

  it('shows Setup Dependencies message when Chromium executable is missing', async () => {
    withProgress.mockImplementation(async (_opts: unknown, task: Function) => {
      return task({ report: vi.fn() }, { isCancellationRequested: false });
    });
    exportToPdfMock.mockRejectedValue(new Error("Executable doesn't exist at /path/to/chromium"));

    await exportPdfCommand({} as any);

    expect(showErrorMessage).toHaveBeenCalledWith(
      expect.stringContaining('Setup Dependencies')
    );
    expect(showErrorMessage).toHaveBeenCalledWith(
      expect.stringContaining('Chromium is not installed')
    );
  });

  it('shows Setup Dependencies message when browserType.launch fails', async () => {
    withProgress.mockImplementation(async (_opts: unknown, task: Function) => {
      return task({ report: vi.fn() }, { isCancellationRequested: false });
    });
    exportToPdfMock.mockRejectedValue(new Error('browserType.launch: Target page, context or browser has been closed'));

    await exportPdfCommand({} as any);

    expect(showErrorMessage).toHaveBeenCalledWith(
      expect.stringContaining('Setup Dependencies')
    );
  });

  it('does not mention npx playwright install in error message', async () => {
    withProgress.mockImplementation(async (_opts: unknown, task: Function) => {
      return task({ report: vi.fn() }, { isCancellationRequested: false });
    });
    exportToPdfMock.mockRejectedValue(new Error("Executable doesn't exist at /path/to/chromium"));

    await exportPdfCommand({} as any);

    const errorMsg = showErrorMessage.mock.calls[0][0] as string;
    expect(errorMsg).not.toContain('npx playwright install');
  });
});

describe('PlantUML rendering error message contains "Setup Dependencies"', () => {
  const context = { extensionPath: '/ext' } as any;

  beforeEach(() => {
    clearPlantUmlCache();
    vi.clearAllMocks();
    getConfigMock.mockReturnValue({ plantUmlMode: 'bundled-jar', javaPath: '' });
    (extensionModule as any).dependencyStatus = undefined;
    accessMock.mockResolvedValue(undefined);
  });

  it('returns Setup Dependencies error when Java is unavailable (early check, no javaPath)', async () => {
    // No managed javaPath, no config javaPath → early check should catch this
    getConfigMock.mockReturnValue({ plantUmlMode: 'bundled-jar', javaPath: '' });
    (extensionModule as any).dependencyStatus = undefined;

    const result = await renderPlantUml('@startuml\nA->B\n@enduml', context);

    expect(result.ok).toBe(false);
    expect(result.error).toContain('Setup Dependencies');
    expect(result.error).toContain('Java (Corretto) is not installed');
  });

  it('returns Setup Dependencies error when runProcess detects missing Java', async () => {
    // Config has a javaPath but it doesn't actually exist on disk
    getConfigMock.mockReturnValue({ plantUmlMode: 'bundled-jar', javaPath: '/nonexistent/java' });
    (extensionModule as any).dependencyStatus = undefined;
    createTempFileMock.mockResolvedValue('/tmp/in.puml');
    runProcessMock.mockResolvedValue({
      exitCode: 127,
      stdout: '',
      stderr: 'java: command not found',
      timedOut: false,
    });

    const result = await renderPlantUml('@startuml\nA->B\n@enduml', context);

    expect(result.ok).toBe(false);
    expect(result.error).toContain('Setup Dependencies');
    expect(result.error).toContain('Java (Corretto) is not installed');
  });

  it('does not show Setup Dependencies when managed Java is available', async () => {
    (extensionModule as any).dependencyStatus = {
      allReady: true,
      javaPath: '/managed/java',
      browserPath: '/managed/chromium',
      errors: [],
    };
    createTempFileMock.mockResolvedValue('/tmp/in.puml');
    runProcessMock.mockResolvedValue({
      exitCode: 0,
      stdout: '',
      stderr: '',
      timedOut: false,
    });
    readFileMock.mockResolvedValue('<svg><rect/></svg>');

    const result = await renderPlantUml('@startuml\nA->B\n@enduml', context);

    expect(result.ok).toBe(true);
  });
});
