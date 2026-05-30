import { describe, expect, it } from 'vitest';
import {
  normalizeExportProfile,
  normalizeExportProfiles,
} from '../../src/infra/exportProfiles';

describe('normalizeExportProfile', () => {
  it('normalizes a valid v1 profile', () => {
    const result = normalizeExportProfile({
      name: 'Company Spec A4',
      pageFormat: 'A4',
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
      headerTemplate: null,
      footerEnabled: true,
      footerTemplate: '<span class="pageNumber"></span>',
      pageBreakEnabled: false,
      includeBookmarks: true,
      includePdfIndex: false,
      pdfIndexTitle: 'Contents',
      hidePdfToc: false,
      tocLevels: '1-4',
      tocOrderedList: true,
      tocPageBreak: false,
      codeBlockLineNumbers: false,
      outputFilename: '${filename}-${datetime}',
    });

    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.profile).toEqual({
      schemaVersion: 1,
      name: 'Company Spec A4',
      pageFormat: 'A4',
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
      headerTemplate: null,
      footerEnabled: true,
      footerTemplate: '<span class="pageNumber"></span>',
      pageBreakEnabled: false,
      includeBookmarks: true,
      includePdfIndex: false,
      pdfIndexTitle: 'Contents',
      hidePdfToc: false,
      tocLevels: '1-4',
      tocOrderedList: true,
      tocPageBreak: false,
      codeBlockLineNumbers: false,
      outputFilename: '${filename}-${datetime}',
    });
  });

  it('treats missing schemaVersion as version 1', () => {
    const result = normalizeExportProfile({ name: 'Default' });

    expect(result.profile).toEqual({
      schemaVersion: 1,
      name: 'Default',
    });
  });

  it('fails when name is missing', () => {
    const result = normalizeExportProfile({ pageFormat: 'A4' });

    expect(result.profile).toBeUndefined();
    expect(result.errors).toContain('Export profile requires a non-empty name.');
  });

  it('drops invalid optional fields with warnings', () => {
    const result = normalizeExportProfile({
      name: 'Loose',
      pageFormat: 'B4',
      stylePreset: 123,
      fontSize: 'large',
      allowedDomains: ['ok.example.com', 123],
      includeBookmarks: 'yes',
    });

    expect(result.profile).toEqual({
      schemaVersion: 1,
      name: 'Loose',
    });
    expect(result.warnings).toHaveLength(5);
  });

  it('preserves unknown fields for future compatibility', () => {
    const result = normalizeExportProfile({
      name: 'Future Friendly',
      pageFormat: 'A4',
      futureField: { nested: true },
    });

    expect(result.profile).toMatchObject({
      schemaVersion: 1,
      name: 'Future Friendly',
      pageFormat: 'A4',
      futureField: { nested: true },
    });
  });

  it('rejects unsupported schema versions', () => {
    const result = normalizeExportProfile({
      schemaVersion: 99,
      name: 'Future',
    });

    expect(result.profile).toBeUndefined();
    expect(result.errors[0]).toContain('Unsupported export profile schemaVersion');
  });
});

describe('configured export profiles', () => {
  it('normalizes profiles from arrays', () => {
    const result = normalizeExportProfiles([
      { name: 'A4', pageFormat: 'A4' },
      { name: 'Letter', pageFormat: 'Letter' },
    ]);

    expect(result.profiles.map(profile => profile.name)).toEqual(['A4', 'Letter']);
  });

  it('warns when array input contains invalid profiles', () => {
    const result = normalizeExportProfiles([{ name: 'A4' }, { pageFormat: 'A5' }]);

    expect(result.profiles).toHaveLength(1);
    expect(result.warnings[0]).toContain('requires a non-empty name');
  });
});
