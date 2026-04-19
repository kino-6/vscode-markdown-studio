import { describe, it, expect, vi, beforeEach } from "vitest";
import fc from "fast-check";
import type { DependencyStatus } from "../../src/deps/types";

// ---------------------------------------------------------------------------
// Task 6: Preservation — Property-Based Tests (6.1 & 6.2)
// ---------------------------------------------------------------------------

// Mock vscode
const showErrorMessage = vi.fn();
const showWarningMessage = vi.fn();
const showInformationMessage = vi.fn();
const registerCommandMock = vi.fn().mockReturnValue({ dispose: vi.fn() });

vi.mock("vscode", () => ({
  workspace: {
    getConfiguration: () => ({ get: (_: string, f: unknown) => f }),
    onWillSaveTextDocument: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  },
  window: {
    showInformationMessage: (...args: unknown[]) => showInformationMessage(...args),
    showWarningMessage: (...args: unknown[]) => showWarningMessage(...args),
    showErrorMessage: (...args: unknown[]) => showErrorMessage(...args),
    withProgress: vi.fn(
      (_opts: unknown, task: (progress: unknown) => Promise<unknown>) =>
        task({ report: vi.fn() })
    ),
  },
  ProgressLocation: { Notification: 15 },
  commands: {
    registerCommand: (...args: unknown[]) => registerCommandMock(...args),
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

// Mock command modules — track calls to verify they are (or aren't) invoked
const exportPdfCommandMock = vi.fn().mockResolvedValue(undefined);
const openPreviewCommandMock = vi.fn().mockResolvedValue(undefined);
const validateEnvironmentCommandMock = vi.fn().mockResolvedValue(undefined);
const insertTocCommandMock = vi.fn().mockResolvedValue(undefined);

vi.mock("../../src/commands/exportPdf", () => ({ exportPdfCommand: (...args: unknown[]) => exportPdfCommandMock(...args) }));
vi.mock("../../src/commands/openPreview", () => ({ openPreviewCommand: (...args: unknown[]) => openPreviewCommandMock(...args) }));
vi.mock("../../src/commands/validateEnvironment", () => ({ validateEnvironmentCommand: (...args: unknown[]) => validateEnvironmentCommandMock(...args) }));
vi.mock("../../src/commands/insertToc", () => ({ insertTocCommand: (...args: unknown[]) => insertTocCommandMock(...args) }));
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
// Helpers
// ---------------------------------------------------------------------------

/**
 * Activates the extension with the given DependencyStatus and returns
 * a map of command name → handler function extracted from registerCommand calls.
 */
async function activateAndGetHandlers(status: DependencyStatus) {
  registerCommandMock.mockClear();

  ensureAllMock.mockResolvedValue(status);
  const ext = await import("../../src/extension");
  const context = {
    globalStorageUri: { fsPath: "/tmp/test-storage" },
    subscriptions: { push: vi.fn() },
  } as any;
  await ext.activate(context);

  // Build a map of command name → handler from registerCommand calls
  const handlers: Record<string, (...args: unknown[]) => unknown> = {};
  for (const call of registerCommandMock.mock.calls) {
    const [name, handler] = call as [string, (...args: unknown[]) => unknown];
    handlers[name] = handler;
  }

  return { ext, handlers };
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/**
 * Generates random valid file-system-like paths for use as dependency paths.
 */
const validPathArb = fc.stringMatching(/^\/[a-z]{1,8}(\/[a-z]{1,8}){1,4}$/);

/**
 * Generates random DependencyStatus objects where allReady is true and
 * both javaPath and browserPath are set with random valid paths.
 */
const allReadyStatusArb: fc.Arbitrary<DependencyStatus> = fc
  .record({
    javaPath: validPathArb,
    browserPath: validPathArb,
    errors: fc.constant([] as string[]),
  })
  .map(({ javaPath, browserPath, errors }) => ({
    allReady: true,
    javaPath,
    browserPath,
    errors,
  }));

/**
 * Generates random DependencyStatus objects with arbitrary states —
 * dependencies may or may not be available.
 */
const anyStatusArb: fc.Arbitrary<DependencyStatus> = fc
  .record({
    allReady: fc.boolean(),
    javaPath: fc.option(validPathArb, { nil: undefined }),
    browserPath: fc.option(validPathArb, { nil: undefined }),
    errors: fc.array(
      fc.stringMatching(/^[A-Za-z0-9: ]{1,40}$/),
      { minLength: 0, maxLength: 3 }
    ),
  })
  .map(({ allReady, javaPath, browserPath, errors }) => ({
    allReady,
    javaPath,
    browserPath,
    errors,
  }));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Preservation: Dependency Gate Passes When All Ready", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isSetupInProgressValue = false;
  });

  /**
   * 6.1 Property: For any DependencyStatus where allReady is true and both
   * paths are set, the gate SHALL pass for all command types with no blocking.
   *
   * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**
   */
  it("Property 6.1: checkDependency passes for both 'chromium' and 'java' when allReady is true and both paths are set", async () => {
    await fc.assert(
      fc.asyncProperty(allReadyStatusArb, async (status) => {
        // Reset mocks for each property run
        showErrorMessage.mockClear();
        showWarningMessage.mockClear();
        ensureAllMock.mockClear();

        // Activate the extension with the generated all-ready status
        ensureAllMock.mockResolvedValue(status);
        const ext = await import("../../src/extension");
        const context = {
          globalStorageUri: { fsPath: "/tmp/test-storage" },
          subscriptions: { push: vi.fn() },
        } as any;
        await ext.activate(context);

        // Clear any messages from activation
        showErrorMessage.mockClear();
        showWarningMessage.mockClear();

        // Gate SHALL pass for chromium
        const chromiumResult = ext.checkDependency("chromium");
        expect(chromiumResult).toBe(true);

        // Gate SHALL pass for java
        const javaResult = ext.checkDependency("java");
        expect(javaResult).toBe(true);

        // No error messages SHALL be shown
        expect(showErrorMessage).not.toHaveBeenCalled();
      }),
      { numRuns: 100 }
    );
  });
});

describe("Preservation: Non-Dependency Commands Execute Regardless of State", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isSetupInProgressValue = false;
  });

  /**
   * 6.2 Property: For any command that does not require dependencies
   * (insertToc, validateEnvironment, openPreview without PlantUML),
   * the command SHALL execute regardless of dependency state.
   *
   * **Validates: Requirements 2.5, 3.3, 3.4**
   */
  it("Property 6.2: non-dependency commands (openPreview, insertToc, validateEnvironment) execute regardless of dependency state", async () => {
    await fc.assert(
      fc.asyncProperty(anyStatusArb, async (status) => {
        // Reset all mocks for each property run
        showErrorMessage.mockClear();
        showWarningMessage.mockClear();
        showInformationMessage.mockClear();
        exportPdfCommandMock.mockClear();
        openPreviewCommandMock.mockClear();
        validateEnvironmentCommandMock.mockClear();
        insertTocCommandMock.mockClear();

        // Activate the extension and capture command handlers
        const { handlers } = await activateAndGetHandlers(status);

        // Clear any messages from activation
        showErrorMessage.mockClear();
        showWarningMessage.mockClear();
        showInformationMessage.mockClear();

        // openPreview SHALL execute regardless of dependency state
        const previewHandler = handlers["markdownStudio.openPreview"];
        expect(previewHandler).toBeDefined();
        await previewHandler();
        expect(openPreviewCommandMock).toHaveBeenCalled();

        // insertToc SHALL execute regardless of dependency state
        const tocHandler = handlers["markdownStudio.insertToc"];
        expect(tocHandler).toBeDefined();
        await tocHandler();
        expect(insertTocCommandMock).toHaveBeenCalled();

        // validateEnvironment SHALL execute regardless of dependency state
        const validateHandler = handlers["markdownStudio.validateEnvironment"];
        expect(validateHandler).toBeDefined();
        await validateHandler();
        expect(validateEnvironmentCommandMock).toHaveBeenCalled();

        // None of these commands should have been blocked by the dependency gate
        // (no "Setup Dependencies" error messages from the gate)
        const gateErrorCalls = showErrorMessage.mock.calls.filter(
          (call: unknown[]) =>
            typeof call[0] === "string" &&
            call[0].includes("Setup Dependencies")
        );
        expect(gateErrorCalls).toHaveLength(0);
      }),
      { numRuns: 100 }
    );
  });
});
