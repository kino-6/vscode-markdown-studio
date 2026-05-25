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
  it('leaves normal getConfig unaffected by active export profiles', () => {
    mocks.values = {
      'export.pageFormat': 'Letter',
      activeExportProfile: 'Company Spec A4',
      exportProfiles: [
        {
          name: 'Company Spec A4',
          pageFormat: 'A4',
          stylePreset: 'github',
          securityMode: 'block-all',
          includeBookmarks: false,
          includePdfIndex: false,
        },
      ],
    };

    const normalConfig = getConfig();
    const exportConfig = getExportConfig();

    expect(normalConfig.pageFormat).toBe('Letter');
    expect(normalConfig.style.presetName).toBe('markdown-pdf');
    expect(normalConfig.externalResources.mode).toBe('whitelist');
    expect(normalConfig.pdfBookmarks.enabled).toBe(true);
    expect(normalConfig.pdfIndex.enabled).toBe(true);

    expect(exportConfig.pageFormat).toBe('A4');
    expect(exportConfig.style.presetName).toBe('github');
    expect(exportConfig.externalResources.mode).toBe('block-all');
    expect(exportConfig.pdfBookmarks.enabled).toBe(false);
    expect(exportConfig.pdfIndex.enabled).toBe(false);
  });

  it('falls back to normal settings when active profile is missing', () => {
    mocks.values = {
      'export.pageFormat': 'Letter',
      activeExportProfile: 'Missing',
      exportProfiles: [{ name: 'Other', pageFormat: 'A4' }],
    };

    expect(getExportConfig().pageFormat).toBe('Letter');
  });

  it('applies an explicit one-time overlay without requiring an active profile', () => {
    mocks.values = {
      'export.pageFormat': 'Letter',
      activeExportProfile: 'Company Spec A4',
      exportProfiles: [{ name: 'Company Spec A4', pageFormat: 'A4' }],
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
