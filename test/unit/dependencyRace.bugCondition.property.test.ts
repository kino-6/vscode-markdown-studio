import { describe, it, expect, vi, beforeEach } from "vitest";
import fc from "fast-check";
import type { DependencyStatus } from "../../src/deps/types";

// ---------------------------------------------------------------------------
// Task 4.1: Bug Condition — Dependency Gate Blocks Chromium Commands
// ---------------------------------------------------------------------------

// Mock vscode
const showErrorMessage = vi.fn();
const showWarningMessage = vi.fn();

vi.mock("vscode", () => ({
  workspace: {
    getConfiguration: () => ({ get: (_: string, f: unknown) => f }),
    onWillSaveTextDocument: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  },
  window: {
    showInformationMessage: vi.fn(),
    showWarningMessage: (...args: unknown[]) => showWarningMessage(...args),
    showErrorMessage: (...args: unknown[]) => showErrorMessage(...args),
    withProgress: vi.fn(
      (_opts: unknown, task: (progress: unknown) => Promise<unknown>) =>
        task({ report: vi.fn() })
    ),
  },
  ProgressLocation: { Notification: 15 },
  commands: {
    registerCommand: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  },
  Position: class {
    constructor(public line: number, public character: number) {}
  },
  Range: class {
    constructor(public start: unknown, public end: unknown) {}
  },
  TextEdit: { replace: vi.fn() },
}));

// Mock DependencyManager so we can control the status returned by ensureAll
const ensureAllMock = vi.fn();
const reinstallMock = vi.fn();
let isSetupInProgressValue = false;

vi.mock("../../src/deps/dependencyManager", () => ({
  DependencyManager: vi.fn().mockImplementation(() => ({
    ensureAll: ensureAllMock,
    reinstall: reinstallMock,
    get isSetupInProgress() {
      return isSetupInProgressValue;
    },
  })),
}));

// Mock command modules to avoid side effects
vi.mock("../../src/commands/exportPdf", () => ({ exportPdfCommand: vi.fn() }));
vi.mock("../../src/commands/openPreview", () => ({ openPreviewCommand: vi.fn() }));
vi.mock("../../src/commands/validateEnvironment", () => ({ validateEnvironmentCommand: vi.fn() }));
vi.mock("../../src/commands/insertToc", () => ({ insertTocCommand: vi.fn() }));
vi.mock("../../src/infra/tempFiles", () => ({ cleanupTempFiles: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../../src/preview/webviewPanel", () => ({ destroyPreviewPanel: vi.fn() }));
vi.mock("../../src/parser/scanFencedBlocks", () => ({ scanFencedBlocks: vi.fn().mockReturnValue([]) }));
vi.mock("../../src/toc/tocCommentMarker", () => ({
  findTocCommentMarkers: vi.fn(), replaceTocContent: vi.fn(), wrapWithMarkers: vi.fn(),
}));
vi.mock("../../src/parser/parseMarkdown", () => ({ createMarkdownParser: vi.fn().mockReturnValue({}) }));
vi.mock("../../src/toc/extractHeadings", () => ({ extractHeadings: vi.fn().mockReturnValue([]) }));
vi.mock("../../src/toc/anchorResolver", () => ({ resolveAnchors: vi.fn().mockReturnValue([]) }));
vi.mock("../../src/toc/buildTocMarkdown", () => ({ buildTocMarkdown: vi.fn().mockReturnValue("") }));
vi.mock("../../src/infra/config", () => ({
  getConfig: () => ({ toc: { minLevel: 1, maxLevel: 3, orderedList: false, pageBreak: true } }),
}));

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/**
 * Generates random DependencyStatus objects where browserPath is always
 * undefined (simulating Chromium not installed). Other fields vary randomly.
 */
const statusWithoutBrowserArb: fc.Arbitrary<DependencyStatus> = fc
  .record({
    allReady: fc.constant(false),
    javaPath: fc.option(
      fc.stringMatching(/^\/[a-z]{1,8}(\/[a-z]{1,8}){1,3}$/),
      { nil: undefined }
    ),
    errors: fc.array(
      fc.stringMatching(/^[A-Za-z0-9: ]{1,40}$/),
      { minLength: 0, maxLength: 3 }
    ),
  })
  .map(({ allReady, javaPath, errors }) => ({
    allReady,
    javaPath,
    browserPath: undefined,
    errors,
  }));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Bug Condition Exploration: Dependency Gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isSetupInProgressValue = false;
  });

  /**
   * Property: For any DependencyStatus where browserPath is undefined,
   * checkDependency('chromium') SHALL return false and show an error message
   * containing "Setup Dependencies".
   *
   * This test confirms the bug condition: without the gate fix, commands
   * requiring Chromium would proceed despite the dependency being unavailable.
   * On the FIXED code, the gate correctly blocks execution.
   *
   * **Validates: Requirements 2.1, 2.3**
   */
  it("Property: checkDependency('chromium') blocks when browserPath is undefined for any DependencyStatus", async () => {
    await fc.assert(
      fc.asyncProperty(statusWithoutBrowserArb, async (status) => {
        // Reset mocks for each property run
        showErrorMessage.mockClear();
        showWarningMessage.mockClear();
        ensureAllMock.mockClear();

        // Activate the extension with the generated status
        ensureAllMock.mockResolvedValue(status);
        const ext = await import("../../src/extension");
        const context = {
          globalStorageUri: { fsPath: "/tmp/test-storage" },
          subscriptions: { push: vi.fn() },
        } as any;
        await ext.activate(context);

        // Clear any error messages from activation itself
        showErrorMessage.mockClear();

        const result = ext.checkDependency("chromium");

        // The gate should block execution (return false)
        expect(result).toBe(false);

        // An error message should be shown to the user
        expect(showErrorMessage).toHaveBeenCalledOnce();
        expect(showErrorMessage).toHaveBeenCalledWith(
          expect.stringContaining("Setup Dependencies")
        );
        expect(showErrorMessage).toHaveBeenCalledWith(
          expect.stringContaining("Chromium")
        );
      }),
      { numRuns: 100 }
    );
  });
});
