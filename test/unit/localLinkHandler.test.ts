import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as path from 'node:path';

const existing = new Set<string>();
const files = new Map<string, string>();

vi.mock('vscode', () => {
  const makeUri = (p: string) => ({ path: p, fsPath: p, toString: () => `file://${p}` });
  return {
    Uri: {
      joinPath: (base: { path: string }, ...parts: string[]) => makeUri(path.posix.normalize(path.posix.join(base.path, ...parts))),
      parse: (s: string) => ({ toString: () => s, scheme: s.split(':')[0] }),
    },
    workspace: {
      fs: {
        stat: vi.fn(async (uri: { path: string }) => {
          if (!existing.has(uri.path)) throw new Error('ENOENT');
          return {};
        }),
      },
      getWorkspaceFolder: vi.fn(() => ({ uri: makeUri('/ws') })),
      openTextDocument: vi.fn(async (uri: { path: string }) => ({ uri, getText: () => files.get(uri.path) ?? '' })),
      getConfiguration: vi.fn(() => ({ get: (_k: string, fallback: unknown) => fallback })),
    },
    window: {
      showTextDocument: vi.fn(),
      showWarningMessage: vi.fn(),
    },
    commands: { executeCommand: vi.fn() },
    ViewColumn: { One: 1 },
    Position: class { constructor(public line: number, public character: number) {} },
    Selection: class { constructor(public anchor: unknown, public active: unknown) {} },
    Range: class { constructor(public start: unknown, public end: unknown) {} },
    TextEditorRevealType: { InCenter: 2, AtTop: 3 },
    languages: { createDiagnosticCollection: vi.fn() },
  };
});

vi.mock('../../src/preview/buildHtml', () => ({
  buildHtml: vi.fn(), buildLoadingHtml: vi.fn(), renderBody: vi.fn(),
}));
vi.mock('../../src/preview/previewAssets', () => ({ getPreviewAssetUris: vi.fn() }));
vi.mock('../../src/commands/validateEnvironmentCore', () => ({ validateEnvironment: vi.fn() }));
vi.mock('../../src/extension', () => ({ dependencyStatus: undefined }));
vi.mock('../../src/infra/config', () => ({ getConfig: vi.fn(() => ({})) }));

import * as vscode from 'vscode';
import { handleOpenLocalLinkMessage } from '../../src/preview/webviewPanel';

const docUri = { path: '/ws/docs/guide.md', fsPath: '/ws/docs/guide.md', toString: () => 'file:///ws/docs/guide.md' } as unknown as vscode.Uri;

function mockEditor() {
  const editor = { selection: undefined as unknown, revealRange: vi.fn() };
  vi.mocked(vscode.window.showTextDocument).mockResolvedValue(editor as unknown as vscode.TextEditor);
  return editor;
}

describe('handleOpenLocalLinkMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    existing.clear();
    files.clear();
  });

  it('opens a relative Markdown file in the editor', async () => {
    existing.add('/ws/docs/other.md');
    mockEditor();
    await handleOpenLocalLinkMessage(docUri, { type: 'openLocalLink', href: './other.md' });
    expect(vscode.workspace.openTextDocument).toHaveBeenCalledWith(expect.objectContaining({ path: '/ws/docs/other.md' }));
    expect(vscode.window.showTextDocument).toHaveBeenCalled();
  });

  it('reveals the heading named by the fragment', async () => {
    existing.add('/ws/docs/other.md');
    files.set('/ws/docs/other.md', '# Title\n\ntext\n\n## Setup Steps\n');
    const editor = mockEditor();
    await handleOpenLocalLinkMessage(docUri, { type: 'openLocalLink', href: 'other.md#setup-steps' });
    expect(editor.revealRange).toHaveBeenCalledTimes(1);
    expect((editor.selection as { anchor: { line: number } }).anchor.line).toBe(4);
  });

  it('decodes encoded paths and resolves parent directories', async () => {
    existing.add('/ws/My Notes.md');
    mockEditor();
    await handleOpenLocalLinkMessage(docUri, { type: 'openLocalLink', href: '../My%20Notes.md' });
    expect(vscode.workspace.openTextDocument).toHaveBeenCalledWith(expect.objectContaining({ path: '/ws/My Notes.md' }));
  });

  it('resolves root-relative links against the workspace folder', async () => {
    existing.add('/ws/README.md');
    mockEditor();
    await handleOpenLocalLinkMessage(docUri, { type: 'openLocalLink', href: '/README.md' });
    expect(vscode.workspace.openTextDocument).toHaveBeenCalledWith(expect.objectContaining({ path: '/ws/README.md' }));
  });

  it('opens non-Markdown files with the default VS Code handler', async () => {
    existing.add('/ws/docs/diagram.png');
    await handleOpenLocalLinkMessage(docUri, { type: 'openLocalLink', href: 'diagram.png' });
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith('vscode.open', expect.objectContaining({ path: '/ws/docs/diagram.png' }), 1);
    expect(vscode.workspace.openTextDocument).not.toHaveBeenCalled();
  });

  it('warns when the target does not exist', async () => {
    await handleOpenLocalLinkMessage(docUri, { type: 'openLocalLink', href: 'missing.md' });
    expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(expect.stringContaining('missing.md'));
    expect(vscode.workspace.openTextDocument).not.toHaveBeenCalled();
  });

  it('ignores other message types', async () => {
    await handleOpenLocalLinkMessage(docUri, { type: 'openExternal', href: 'other.md' });
    expect(vscode.workspace.fs.stat).not.toHaveBeenCalled();
  });
});
