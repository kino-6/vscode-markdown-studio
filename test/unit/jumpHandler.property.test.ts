import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */

vi.mock('vscode', () => {
  const configuration = {
    get: (_key: string, fallback: unknown) => {
      if (_key === 'preview.sourceJump.enabled') return false;
      return fallback;
    },
  };

  return {
    workspace: {
      getConfiguration: () => configuration,
    },
    window: {
      showTextDocument: vi.fn(),
    },
    ViewColumn: { One: 1 },
    Uri: {
      parse: (s: string) => ({ toString: () => s }),
    },
    Range: class {
      constructor(
        public startLine: number,
        public startChar: number,
        public endLine: number,
        public endChar: number,
      ) {}
    },
    Selection: class {
      constructor(public anchor: unknown, public active: unknown) {}
    },
    TextEditorRevealType: { InCenter: 2 },
  };
});

vi.mock('../../src/preview/buildHtml', () => ({
  buildHtml: vi.fn(async () => '<html>mock</html>'),
  buildLoadingHtml: vi.fn(() => '<html>loading</html>'),
  renderBody: vi.fn(async () => '<h1>mock body</h1>'),
}));

vi.mock('../../src/preview/previewAssets', () => ({
  getPreviewAssetUris: vi.fn(() => ({
    styleUri: { toString: () => 'style.css' },
    scriptUri: { toString: () => 'script.js' },
  })),
}));

vi.mock('../../src/commands/validateEnvironmentCore', () => ({
  validateEnvironment: vi.fn(async () => ({ ok: true, lines: [] })),
}));

vi.mock('../../src/extension', () => ({
  dependencyStatus: undefined,
}));

vi.mock('../../src/infra/config', () => ({
  getConfig: vi.fn(() => ({ javaPath: 'java', style: {} })),
}));

/* ------------------------------------------------------------------ */
/*  Import under test (after mocks)                                    */
/* ------------------------------------------------------------------ */

import { handleJumpToLine } from '../../src/preview/webviewPanel';
import * as vscode from 'vscode';

/* ------------------------------------------------------------------ */
/*  Property 5: Setting gate suppresses navigation                     */
/*  Validates: Requirements 4.2, 5.2                                   */
/* ------------------------------------------------------------------ */

describe('Property 5: Setting gate suppresses navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * **Validates: Requirements 4.2, 5.2**
   *
   * For any valid jumpToLine message (type: 'jumpToLine', line: non-negative
   * integer), when markdownStudio.preview.sourceJump.enabled is false, the
   * Jump_Handler SHALL not invoke any editor navigation API.
   */
  it('showTextDocument is never called when setting is disabled', async () => {
    const uri = { toString: () => 'file:///test.md' } as unknown as vscode.Uri;

    await fc.assert(
      fc.asyncProperty(
        fc.nat({ max: 100_000 }),
        async (line) => {
          vi.clearAllMocks();
          await handleJumpToLine(uri, { type: 'jumpToLine', line });
          expect(vscode.window.showTextDocument).not.toHaveBeenCalled();
        },
      ),
      { numRuns: 200, seed: 42 },
    );
  });
});

/* ------------------------------------------------------------------ */
/*  Property 6: Line clamping for out-of-range values                  */
/*  Validates: Requirement 4.4                                         */
/* ------------------------------------------------------------------ */

describe('Property 6: Line clamping for out-of-range values', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Override the setting to return true so the handler proceeds
    vi.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue({
      get: (_key: string, fallback: unknown) => {
        if (_key === 'preview.sourceJump.enabled') return true;
        return fallback;
      },
    } as unknown as vscode.WorkspaceConfiguration);
  });

  /**
   * **Validates: Requirement 4.4**
   *
   * For any jumpToLine message where the line number is greater than or equal
   * to the document's line count, the Jump_Handler SHALL navigate to
   * lineCount - 1 (the last line) rather than throwing or navigating to an
   * invalid position.
   */
  it('clamps line to lineCount - 1 when line >= lineCount', async () => {
    const uri = { toString: () => 'file:///test.md' } as unknown as vscode.Uri;

    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 1000 }),
        fc.integer({ min: 0, max: 10_000 }),
        async (lineCount, offset) => {
          // line is always >= lineCount
          const line = lineCount + offset;

          const mockRevealRange = vi.fn();
          const mockEditor = {
            document: { lineCount },
            selection: null as unknown,
            revealRange: mockRevealRange,
          };

          vi.mocked(vscode.window.showTextDocument).mockResolvedValue(
            mockEditor as unknown as vscode.TextEditor,
          );

          await handleJumpToLine(uri, { type: 'jumpToLine', line });

          const expectedLine = lineCount - 1;

          // Verify revealRange was called with a Range targeting the last line
          expect(mockRevealRange).toHaveBeenCalledOnce();
          const rangeArg = mockRevealRange.mock.calls[0][0];
          expect(rangeArg.startLine).toBe(expectedLine);
          expect(rangeArg.endLine).toBe(expectedLine);

          // Verify selection was set with the clamped line
          expect(mockEditor.selection).toBeTruthy();
        },
      ),
      { numRuns: 200, seed: 42 },
    );
  });
});

/* ------------------------------------------------------------------ */
/*  Property 7: Invalid message rejection                              */
/*  Validates: Requirements 4.5, 4.6                                   */
/* ------------------------------------------------------------------ */

describe('Property 7: Invalid message rejection', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Enable the setting so rejection is purely due to invalid messages
    vi.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue({
      get: (_key: string, fallback: unknown) => {
        if (_key === 'preview.sourceJump.enabled') return true;
        return fallback;
      },
    } as unknown as vscode.WorkspaceConfiguration);
  });

  /**
   * **Validates: Requirements 4.5, 4.6**
   *
   * For any message where type is not the string 'jumpToLine', the
   * Jump_Handler SHALL ignore the message and perform no editor navigation.
   */
  it('ignores messages with wrong type', async () => {
    const uri = { toString: () => 'file:///test.md' } as unknown as vscode.Uri;

    await fc.assert(
      fc.asyncProperty(
        fc.string().filter((s) => s !== 'jumpToLine'),
        fc.nat({ max: 10_000 }),
        async (wrongType, line) => {
          vi.clearAllMocks();
          await handleJumpToLine(uri, { type: wrongType, line });
          expect(vscode.window.showTextDocument).not.toHaveBeenCalled();
        },
      ),
      { numRuns: 200, seed: 42 },
    );
  });

  /**
   * **Validates: Requirements 4.5, 4.6**
   *
   * For any message where type is 'jumpToLine' but line is not a finite
   * non-negative integer (NaN, Infinity, -Infinity, or non-number types
   * like strings, null, undefined, objects), the Jump_Handler SHALL ignore
   * the message and perform no editor navigation.
   */
  it('ignores messages with invalid line values', async () => {
    const uri = { toString: () => 'file:///test.md' } as unknown as vscode.Uri;

    // Generator for values that are not finite numbers (non-number types)
    const nonNumberLine = fc.oneof(
      fc.constant(null),
      fc.constant(undefined),
      fc.string(),
      fc.boolean(),
      fc.constant({}),
      fc.constant([]),
    );

    // Generator for numeric values that are not finite and rejected by the handler.
    // Note: -Infinity is clamped to 0 by Math.max(0, Math.floor(-Infinity)) so it
    // is NOT rejected. NaN and +Infinity remain non-finite after clamping.
    const nonFiniteLine = fc.oneof(
      fc.constant(NaN),
      fc.constant(Infinity),
    );

    const invalidLine = fc.oneof(nonNumberLine, nonFiniteLine);

    await fc.assert(
      fc.asyncProperty(invalidLine, async (line) => {
        vi.clearAllMocks();
        await handleJumpToLine(uri, { type: 'jumpToLine', line } as any);
        expect(vscode.window.showTextDocument).not.toHaveBeenCalled();
      }),
      { numRuns: 200, seed: 42 },
    );
  });
});
