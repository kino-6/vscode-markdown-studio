import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  values: {} as Record<string, unknown>,
  updates: [] as Array<{ key: string; value: unknown; target: unknown }>,
  showQuickPick: vi.fn(),
  showInputBox: vi.fn(),
  showOpenDialog: vi.fn(),
  showSaveDialog: vi.fn(),
  showInformationMessage: vi.fn(),
  showWarningMessage: vi.fn(),
  showErrorMessage: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
  createDirectory: vi.fn(),
  readDirectory: vi.fn(),
  delete: vi.fn(),
  language: 'en',
  workspaceFolders: [{ uri: { fsPath: '/workspace' } }],
}));

vi.mock('vscode', () => ({
  ConfigurationTarget: {
    Global: 1,
    Workspace: 2,
  },
  FileType: {
    File: 1,
    Directory: 2,
  },
  Uri: {
    file: (fsPath: string) => ({ fsPath }),
    joinPath: (base: { fsPath: string }, ...paths: string[]) => ({
      fsPath: [base.fsPath, ...paths].join('/').replace(/\/+/g, '/'),
    }),
  },
  env: {
    get language() {
      return mocks.language;
    },
  },
  workspace: {
    get workspaceFolders() {
      return mocks.workspaceFolders;
    },
    getConfiguration: () => ({
      get: (key: string, fallback: unknown) =>
        Object.prototype.hasOwnProperty.call(mocks.values, key) ? mocks.values[key] : fallback,
      inspect: (key: string) =>
        Object.prototype.hasOwnProperty.call(mocks.values, key)
          ? { globalValue: mocks.values[key] }
          : undefined,
      update: vi.fn(async (key: string, value: unknown, target: unknown) => {
        mocks.values[key] = value;
        mocks.updates.push({ key, value, target });
      }),
    }),
    fs: {
      readFile: (...args: unknown[]) => mocks.readFile(...args),
      writeFile: (...args: unknown[]) => mocks.writeFile(...args),
      createDirectory: (...args: unknown[]) => mocks.createDirectory(...args),
      readDirectory: (...args: unknown[]) => mocks.readDirectory(...args),
      delete: (...args: unknown[]) => mocks.delete(...args),
    },
  },
  window: {
    showQuickPick: (...args: unknown[]) => mocks.showQuickPick(...args),
    showInputBox: (...args: unknown[]) => mocks.showInputBox(...args),
    showOpenDialog: (...args: unknown[]) => mocks.showOpenDialog(...args),
    showSaveDialog: (...args: unknown[]) => mocks.showSaveDialog(...args),
    showInformationMessage: (...args: unknown[]) => mocks.showInformationMessage(...args),
    showWarningMessage: (...args: unknown[]) => mocks.showWarningMessage(...args),
    showErrorMessage: (...args: unknown[]) => mocks.showErrorMessage(...args),
  },
}));

import { exportProfileToJsonCommand } from '../../src/commands/exportProfileToJson';
import { importExportProfileCommand } from '../../src/commands/importExportProfile';
import { saveCurrentSettingsExport } from '../../src/infra/portableSettings';

describe('export settings JSON commands', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.values = {};
    mocks.updates = [];
    mocks.language = 'en';
    mocks.workspaceFolders = [{ uri: { fsPath: '/workspace' } }];
    mocks.showInputBox.mockResolvedValue('Current Settings');
    mocks.createDirectory.mockResolvedValue(undefined);
    mocks.readDirectory.mockResolvedValue([]);
    mocks.delete.mockResolvedValue(undefined);
  });

  it('exports the current Markdown Studio settings to .vscode with a timestamped filename', async () => {
    mocks.values = {
      'export.pageFormat': 'A5',
      'style.preset': 'github',
      'style.theme': 'modern',
      'style.fontFamily': 'Inter, sans-serif',
      'style.fontSize': 15,
      'style.lineHeight': 1.7,
      'style.customCss': 'h1 { color: navy; }',
      'export.margin': '12mm',
      'security.externalResources.mode': 'block-all',
      'security.externalResources.allowedDomains': ['docs.example.com'],
      'export.header.enabled': false,
      'export.header.template': '<span class="title"></span>',
      'export.footer.enabled': true,
      'export.footer.template': '<span class="pageNumber"></span>',
      'export.pageBreak.enabled': false,
      'export.pdfBookmarks.enabled': false,
      'export.pdfIndex.enabled': true,
      'export.pdfIndex.title': 'Index',
      'export.pdfToc.hidden': false,
      'export.cover.enabled': true,
      'export.cover.path': 'covers/company.md',
      'toc.levels': '2-4',
      'toc.orderedList': true,
      'toc.pageBreak': false,
      'codeBlock.lineNumbers': false,
      'export.outputFilename': '${filename}-${datetime}',
    };

    await exportProfileToJsonCommand();

    expect(mocks.showInputBox).toHaveBeenCalledWith(expect.objectContaining({
      value: 'Current Settings',
    }));
    expect(mocks.showSaveDialog).not.toHaveBeenCalled();
    expect(mocks.createDirectory).toHaveBeenCalledWith({ fsPath: '/workspace/.vscode' });
    expect(mocks.writeFile).toHaveBeenCalledTimes(1);
    const [uri, bytes] = mocks.writeFile.mock.calls[0];
    expect(uri.fsPath).toMatch(/^\/workspace\/\.vscode\/markdown-studio-settings-\d{8}-\d{6}\.json$/);
    const profile = JSON.parse(new TextDecoder().decode(bytes));
    expect(profile).toMatchObject({
      schemaVersion: 1,
      name: 'Current Settings',
      source: 'manual-export',
      pageFormat: 'A5',
      stylePreset: 'github',
      styleTheme: 'modern',
      fontFamily: 'Inter, sans-serif',
      fontSize: 15,
      lineHeight: 1.7,
      margin: '12mm',
      customCss: 'h1 { color: navy; }',
      securityMode: 'block-all',
      allowedDomains: ['docs.example.com'],
      headerEnabled: false,
      headerTemplate: '<span class="title"></span>',
      footerEnabled: true,
      footerTemplate: '<span class="pageNumber"></span>',
      pageBreakEnabled: false,
      includeBookmarks: false,
      includePdfIndex: true,
      pdfIndexTitle: 'Index',
      hidePdfToc: false,
      coverEnabled: true,
      coverPath: 'covers/company.md',
      tocLevels: '2-4',
      tocOrderedList: true,
      tocPageBreak: false,
      codeBlockLineNumbers: false,
      outputFilename: '${filename}-${datetime}',
    });
    expect(profile).not.toHaveProperty('plantUmlMode');
    expect(profile).not.toHaveProperty('javaPath');
    expect(profile).not.toHaveProperty('networkCaCertificates');
    expect(profile).not.toHaveProperty('previewTheme');
    expect(profile).not.toHaveProperty('previewContentWidth');
    expect(Date.parse(profile.createdAt)).not.toBeNaN();
    expect(mocks.showInformationMessage).toHaveBeenCalledWith(
      expect.stringContaining('Exported settings to /workspace/.vscode/markdown-studio-settings-'),
    );
  });

  it('uses the manual export name entered by the user', async () => {
    mocks.showInputBox.mockResolvedValue('Company Spec A4');

    await exportProfileToJsonCommand();

    const [, bytes] = mocks.writeFile.mock.calls[0];
    const profile = JSON.parse(new TextDecoder().decode(bytes));
    expect(profile.name).toBe('Company Spec A4');
  });

  it('cancels manual export when the settings name input is cancelled', async () => {
    mocks.showInputBox.mockResolvedValue(undefined);

    await exportProfileToJsonCommand();

    expect(mocks.writeFile).not.toHaveBeenCalled();
    expect(mocks.showInformationMessage).not.toHaveBeenCalled();
  });

  it('does not prune manual settings exports', async () => {
    mocks.readDirectory.mockResolvedValue([
      ['markdown-studio-settings-20260526-010000.json', 1],
      ['markdown-studio-settings-20260526-020000.json', 1],
      ['markdown-studio-settings-20260526-030000.json', 1],
      ['markdown-studio-settings-20260526-040000.json', 1],
      ['markdown-studio-pdf-settings-20260520-010000.json', 1],
      ['other.json', 1],
    ]);

    await exportProfileToJsonCommand();

    expect(mocks.readDirectory).not.toHaveBeenCalled();
    expect(mocks.delete).not.toHaveBeenCalled();
  });

  it('keeps only the latest three automatic PDF settings exports', async () => {
    mocks.readDirectory.mockResolvedValue([
      ['markdown-studio-pdf-settings-20260526-010000.json', 1],
      ['markdown-studio-pdf-settings-20260526-020000.json', 1],
      ['markdown-studio-pdf-settings-20260526-030000.json', 1],
      ['markdown-studio-pdf-settings-20260526-040000.json', 1],
      ['markdown-studio-settings-20260520-010000.json', 1],
      ['other.json', 1],
    ]);

    await saveCurrentSettingsExport({ fallbackToSaveDialog: false, kind: 'pdf' });

    const [, bytes] = mocks.writeFile.mock.calls[0];
    const profile = JSON.parse(new TextDecoder().decode(bytes));
    expect(profile.source).toBe('pdf-export');
    expect(Date.parse(profile.createdAt)).not.toBeNaN();
    expect(mocks.delete).toHaveBeenCalledWith({
      fsPath: '/workspace/.vscode/markdown-studio-pdf-settings-20260526-020000.json',
    });
    expect(mocks.delete).toHaveBeenCalledWith({
      fsPath: '/workspace/.vscode/markdown-studio-pdf-settings-20260526-010000.json',
    });
    expect(mocks.delete).toHaveBeenCalledTimes(2);
  });

  it('falls back to a save dialog when no workspace is open', async () => {
    mocks.workspaceFolders = [];
    mocks.showSaveDialog.mockResolvedValue({ fsPath: '/tmp/settings.json' });

    await exportProfileToJsonCommand();

    expect(mocks.showSaveDialog).toHaveBeenCalledTimes(1);
    expect(mocks.writeFile.mock.calls[0][0]).toEqual({ fsPath: '/tmp/settings.json' });
  });

  it('uses a Japanese export notification in Japanese locale', async () => {
    mocks.language = 'ja';

    await exportProfileToJsonCommand();

    expect(mocks.showInformationMessage).toHaveBeenCalledWith(
      expect.stringContaining('設定を書き出しました'),
    );
  });

  it('imports a JSON settings file into workspace settings', async () => {
    const profileJson = JSON.stringify({
      name: 'Company Spec A4',
      pageFormat: 'A4',
      stylePreset: 'github',
      styleTheme: 'minimal',
      fontFamily: 'Noto Sans, sans-serif',
      fontSize: 16,
      lineHeight: 1.8,
      margin: '18mm',
      customCss: 'h2 { break-before: page; }',
      securityMode: 'block-all',
      allowedDomains: ['docs.example.com', 'assets.example.com'],
      headerEnabled: false,
      headerTemplate: null,
      footerEnabled: true,
      footerTemplate: '<span class="pageNumber"></span>',
      pageBreakEnabled: false,
      includeBookmarks: true,
      includePdfIndex: false,
      pdfIndexTitle: 'Contents',
      hidePdfToc: false,
      coverEnabled: true,
      coverPath: 'cover.md',
      tocLevels: '1-4',
      tocOrderedList: true,
      tocPageBreak: false,
      codeBlockLineNumbers: false,
      outputFilename: '${filename}-${datetime}',
    });
    mocks.readDirectory.mockResolvedValue([]);
    mocks.showOpenDialog.mockResolvedValue([{ fsPath: '/tmp/profile.json' }]);
    mocks.showQuickPick.mockImplementation(async (items: any[]) => items[0]);
    mocks.readFile.mockResolvedValue(new TextEncoder().encode(profileJson));

    await importExportProfileCommand();

    expect(mocks.updates).toEqual([
      { key: 'export.pageFormat', value: 'A4', target: 2 },
      { key: 'style.preset', value: 'github', target: 2 },
      { key: 'style.theme', value: 'minimal', target: 2 },
      { key: 'style.fontFamily', value: 'Noto Sans, sans-serif', target: 2 },
      { key: 'style.fontSize', value: 16, target: 2 },
      { key: 'style.lineHeight', value: 1.8, target: 2 },
      { key: 'export.margin', value: '18mm', target: 2 },
      { key: 'style.customCss', value: 'h2 { break-before: page; }', target: 2 },
      { key: 'security.externalResources.mode', value: 'block-all', target: 2 },
      { key: 'security.externalResources.allowedDomains', value: ['docs.example.com', 'assets.example.com'], target: 2 },
      { key: 'export.header.enabled', value: false, target: 2 },
      { key: 'export.header.template', value: null, target: 2 },
      { key: 'export.footer.enabled', value: true, target: 2 },
      { key: 'export.footer.template', value: '<span class="pageNumber"></span>', target: 2 },
      { key: 'export.pageBreak.enabled', value: false, target: 2 },
      { key: 'export.pdfBookmarks.enabled', value: true, target: 2 },
      { key: 'export.pdfIndex.enabled', value: false, target: 2 },
      { key: 'export.pdfIndex.title', value: 'Contents', target: 2 },
      { key: 'export.pdfToc.hidden', value: false, target: 2 },
      { key: 'export.cover.enabled', value: true, target: 2 },
      { key: 'export.cover.path', value: 'cover.md', target: 2 },
      { key: 'toc.levels', value: '1-4', target: 2 },
      { key: 'toc.orderedList', value: true, target: 2 },
      { key: 'toc.pageBreak', value: false, target: 2 },
      { key: 'codeBlock.lineNumbers', value: false, target: 2 },
      { key: 'export.outputFilename', value: '${filename}-${datetime}', target: 2 },
    ]);
  });

  it('lets the user choose one entry when the JSON contains multiple settings', async () => {
    const profileJson = JSON.stringify({
      profiles: [
        { name: 'A4', pageFormat: 'A4' },
        { name: 'Letter', pageFormat: 'Letter' },
      ],
    });
    mocks.readDirectory.mockResolvedValue([]);
    mocks.showOpenDialog.mockResolvedValue([{ fsPath: '/tmp/profiles.json' }]);
    mocks.showQuickPick
      .mockImplementationOnce(async (items: any[]) => items[1])
      .mockImplementationOnce(async (items: any[]) => items[0]);
    mocks.readFile.mockResolvedValue(new TextEncoder().encode(profileJson));

    await importExportProfileCommand();

    expect(mocks.updates).toEqual([
      { key: 'export.pageFormat', value: 'Letter', target: 2 },
    ]);
  });

  it('lets the user choose a recent workspace settings export when importing', async () => {
    const profileJson = JSON.stringify({
      name: 'Recent',
      createdAt: '2026-05-26T04:00:00.000Z',
      pageFormat: 'A5',
      stylePreset: 'github',
      securityMode: 'block-all',
    });
    mocks.readDirectory.mockResolvedValue([
      ['markdown-studio-pdf-settings-20260526-040000.json', 1],
      ['markdown-studio-settings-20260526-030000.json', 1],
      ['markdown-studio-settings-20260526-020000.json', 1],
    ]);
    mocks.showQuickPick
      .mockImplementationOnce(async (items: any[]) => items[0])
      .mockImplementationOnce(async (items: any[]) => items[0]);
    mocks.readFile.mockResolvedValue(new TextEncoder().encode(profileJson));

    await importExportProfileCommand();

    expect(mocks.showOpenDialog).not.toHaveBeenCalled();
    expect(mocks.showQuickPick.mock.calls[0][0][0]).toMatchObject({
      label: 'Recent',
      description: expect.stringContaining('A5 · github · block-all · PDF export history · 2026-05-26'),
      detail: 'markdown-studio-pdf-settings-20260526-040000.json',
    });
    expect(mocks.readFile).toHaveBeenCalledWith({
      fsPath: '/workspace/.vscode/markdown-studio-pdf-settings-20260526-040000.json',
    });
    expect(mocks.updates).toEqual([
      { key: 'export.pageFormat', value: 'A5', target: 2 },
      { key: 'style.preset', value: 'github', target: 2 },
      { key: 'security.externalResources.mode', value: 'block-all', target: 2 },
    ]);
  });
});
