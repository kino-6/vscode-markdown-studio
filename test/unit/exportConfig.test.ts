import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  values: {} as Record<string, unknown>,
}));

vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: () => ({
      get: (key: string, fallback: unknown) =>
        Object.prototype.hasOwnProperty.call(mocks.values, key) ? mocks.values[key] : fallback,
      inspect: (_key: string) => undefined,
    }),
  },
}));

import { getConfig, getExportConfig } from '../../src/infra/config';

describe('getExportConfig', () => {
  it('uses normal settings by default', () => {
    mocks.values = {
      'export.pageFormat': 'Letter',
    };

    const normalConfig = getConfig();
    const exportConfig = getExportConfig();

    expect(normalConfig.pageFormat).toBe('Letter');
    expect(exportConfig.pageFormat).toBe('Letter');
    expect(exportConfig.pdfCover).toEqual({ enabled: true, path: 'cover.md' });
  });

  it('applies an explicit one-time overlay', () => {
    mocks.values = {
      'export.pageFormat': 'Letter',
    };

    const config = getExportConfig({
      pageFormat: 'A5',
      stylePreset: 'minimal',
      securityMode: 'allow-all',
      includeBookmarks: false,
      includePdfIndex: false,
    });

    expect(config.pageFormat).toBe('A5');
    expect(config.style.presetName).toBe('minimal');
    expect(config.externalResources.mode).toBe('allow-all');
    expect(config.pdfBookmarks.enabled).toBe(false);
    expect(config.pdfIndex.enabled).toBe(false);
  });
});
