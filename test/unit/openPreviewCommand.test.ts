import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  showWarningMessage: vi.fn(),
  openOrRefreshPreview: vi.fn(),
  activeEditor: undefined as any,
}));

vi.mock('vscode', () => ({
  window: {
    get activeTextEditor() {
      return mocks.activeEditor;
    },
    showWarningMessage: mocks.showWarningMessage,
  },
  ViewColumn: {
    One: 1,
    Beside: -2,
  },
}));

vi.mock('../../src/preview/webviewPanel', () => ({
  openOrRefreshPreview: (...args: unknown[]) => mocks.openOrRefreshPreview(...args),
}));

import { openPreviewCommand } from '../../src/commands/openPreview';

function markdownEditor(viewColumn = 3) {
  return {
    viewColumn,
    document: {
      languageId: 'markdown',
      uri: { toString: () => 'file:///test.md' },
    },
  };
}

describe('openPreviewCommand', () => {
  const context = { extensionPath: '/ext' } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.activeEditor = markdownEditor();
  });

  it('opens the default preview beside the editor', async () => {
    await openPreviewCommand(context);

    expect(mocks.openOrRefreshPreview).toHaveBeenCalledWith(
      context,
      mocks.activeEditor.document,
      { viewColumn: -2, previewContentWidth: undefined }
    );
  });

  it('opens preview in the current editor group when requested', async () => {
    await openPreviewCommand(context, { location: 'current' });

    expect(mocks.openOrRefreshPreview).toHaveBeenCalledWith(
      context,
      mocks.activeEditor.document,
      { viewColumn: 3, previewContentWidth: undefined }
    );
  });

  it('passes the full-width preview override', async () => {
    await openPreviewCommand(context, { previewContentWidth: 'full' });

    expect(mocks.openOrRefreshPreview).toHaveBeenCalledWith(
      context,
      mocks.activeEditor.document,
      { viewColumn: -2, previewContentWidth: 'full' }
    );
  });

  it('warns when the active editor is not Markdown', async () => {
    mocks.activeEditor = { document: { languageId: 'typescript' } };

    await openPreviewCommand(context);

    expect(mocks.openOrRefreshPreview).not.toHaveBeenCalled();
    expect(mocks.showWarningMessage).toHaveBeenCalled();
  });
});
