import { describe, it, expect, vi, beforeEach } from 'vitest';

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */

let settingEnabled = false;

vi.mock('vscode', () => {
  return {
    workspace: {
      getConfiguration: vi.fn(() => ({
        get: (_key: string, fallback: unknown) => {
          if (_key === 'preview.sourceJump.enabled') return settingEnabled;
          return fallback;
        },
      })),
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
      get start() { return { line: this.startLine, character: this.startChar }; }
      get end() { return { line: this.endLine, character: this.endChar }; }
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
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function fakeUri(): vscode.Uri {
  return { toString: () => 'file:///test.md' } as unknown as vscode.Uri;
}

function mockEditor(lineCount = 100) {
  const editor: { document: { lineCount: number }; selection: any; revealRange: ReturnType<typeof vi.fn> } = {
    document: { lineCount },
    selection: null,
    revealRange: vi.fn(),
  };
  vi.mocked(vscode.window.showTextDocument).mockResolvedValue(
    editor as unknown as vscode.TextEditor,
  );
  return editor;
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('handleJumpToLine – unit tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    settingEnabled = false;
  });

  /* ---- Requirement 4.1, 4.3: enabled + valid message ---- */

  describe('when enabled and valid message', () => {
    beforeEach(() => {
      settingEnabled = true;
    });

    it('calls showTextDocument with the correct URI and options', async () => {
      const uri = fakeUri();
      const editor = mockEditor(50);

      await handleJumpToLine(uri, { type: 'jumpToLine', line: 10 });

      expect(vscode.window.showTextDocument).toHaveBeenCalledOnce();
      expect(vscode.window.showTextDocument).toHaveBeenCalledWith(uri, {
        viewColumn: vscode.ViewColumn.One,
        preserveFocus: false,
      });
    });

    it('sets selection at the beginning of the target line (column 0)', async () => {
      const uri = fakeUri();
      const editor = mockEditor(50);

      await handleJumpToLine(uri, { type: 'jumpToLine', line: 7 });

      // Selection anchor and active should both be at (7, 0)
      expect(editor.selection).toBeTruthy();
      expect(editor.selection.anchor).toEqual({ line: 7, character: 0 });
      expect(editor.selection.active).toEqual({ line: 7, character: 0 });
    });

    it('calls revealRange with InCenter', async () => {
      const uri = fakeUri();
      const editor = mockEditor(50);

      await handleJumpToLine(uri, { type: 'jumpToLine', line: 5 });

      expect(editor.revealRange).toHaveBeenCalledOnce();
      expect(editor.revealRange).toHaveBeenCalledWith(
        expect.anything(),
        vscode.TextEditorRevealType.InCenter,
      );
    });

    it('navigates to line 0 for line: 0', async () => {
      const uri = fakeUri();
      const editor = mockEditor(50);

      await handleJumpToLine(uri, { type: 'jumpToLine', line: 0 });

      const rangeArg = editor.revealRange.mock.calls[0][0];
      expect(rangeArg.startLine).toBe(0);
    });
  });

  /* ---- Requirement 4.2: disabled setting ---- */

  describe('when setting is disabled', () => {
    it('does NOT call showTextDocument', async () => {
      settingEnabled = false;
      await handleJumpToLine(fakeUri(), { type: 'jumpToLine', line: 5 });
      expect(vscode.window.showTextDocument).not.toHaveBeenCalled();
    });
  });

  /* ---- Requirement 4.4: line clamping ---- */

  describe('line clamping', () => {
    beforeEach(() => {
      settingEnabled = true;
    });

    it('clamps line to lineCount - 1 when line >= lineCount', async () => {
      const editor = mockEditor(10);

      await handleJumpToLine(fakeUri(), { type: 'jumpToLine', line: 50 });

      const rangeArg = editor.revealRange.mock.calls[0][0];
      expect(rangeArg.startLine).toBe(9); // lineCount - 1
      expect(rangeArg.endLine).toBe(9);
    });

    it('clamps line exactly at lineCount', async () => {
      const editor = mockEditor(20);

      await handleJumpToLine(fakeUri(), { type: 'jumpToLine', line: 20 });

      const rangeArg = editor.revealRange.mock.calls[0][0];
      expect(rangeArg.startLine).toBe(19);
    });

    it('does not clamp when line is within range', async () => {
      const editor = mockEditor(100);

      await handleJumpToLine(fakeUri(), { type: 'jumpToLine', line: 42 });

      const rangeArg = editor.revealRange.mock.calls[0][0];
      expect(rangeArg.startLine).toBe(42);
    });
  });

  /* ---- Requirements 4.5, 4.6: invalid messages ---- */

  describe('invalid messages', () => {
    beforeEach(() => {
      settingEnabled = true;
    });

    it('ignores message with wrong type', async () => {
      await handleJumpToLine(fakeUri(), { type: 'otherMessage', line: 5 });
      expect(vscode.window.showTextDocument).not.toHaveBeenCalled();
    });

    it('ignores message with missing type', async () => {
      await handleJumpToLine(fakeUri(), { line: 5 } as any);
      expect(vscode.window.showTextDocument).not.toHaveBeenCalled();
    });

    it('ignores message with non-number line', async () => {
      await handleJumpToLine(fakeUri(), { type: 'jumpToLine', line: '5' as any });
      expect(vscode.window.showTextDocument).not.toHaveBeenCalled();
    });

    it('ignores message with NaN line', async () => {
      const editor = mockEditor(50);
      await handleJumpToLine(fakeUri(), { type: 'jumpToLine', line: NaN });
      expect(vscode.window.showTextDocument).not.toHaveBeenCalled();
    });

    it('ignores message with Infinity line', async () => {
      const editor = mockEditor(50);
      await handleJumpToLine(fakeUri(), { type: 'jumpToLine', line: Infinity });
      expect(vscode.window.showTextDocument).not.toHaveBeenCalled();
    });

    it('clamps negative line to 0', async () => {
      const editor = mockEditor(50);
      await handleJumpToLine(fakeUri(), { type: 'jumpToLine', line: -5 });

      // Negative numbers are finite numbers, so the handler proceeds
      // Math.max(0, Math.floor(-5)) = 0
      expect(vscode.window.showTextDocument).toHaveBeenCalledOnce();
      const rangeArg = editor.revealRange.mock.calls[0][0];
      expect(rangeArg.startLine).toBe(0);
    });
  });

  /* ---- Requirement 4.3: cursor placement ---- */

  describe('cursor placement', () => {
    beforeEach(() => {
      settingEnabled = true;
    });

    it('places cursor at column 0 of the target line', async () => {
      const editor = mockEditor(100);

      await handleJumpToLine(fakeUri(), { type: 'jumpToLine', line: 25 });

      // The Range should be (25, 0, 25, 0)
      const rangeArg = editor.revealRange.mock.calls[0][0];
      expect(rangeArg.startLine).toBe(25);
      expect(rangeArg.startChar).toBe(0);
      expect(rangeArg.endLine).toBe(25);
      expect(rangeArg.endChar).toBe(0);

      // Selection anchor and active at (25, 0)
      expect(editor.selection.anchor).toEqual({ line: 25, character: 0 });
      expect(editor.selection.active).toEqual({ line: 25, character: 0 });
    });
  });
});
