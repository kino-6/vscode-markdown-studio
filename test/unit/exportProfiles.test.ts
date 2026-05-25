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
      securityMode: 'block-all',
      includeBookmarks: true,
      includePdfIndex: false,
    });

    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.profile).toEqual({
      schemaVersion: 1,
      name: 'Company Spec A4',
      pageFormat: 'A4',
      stylePreset: 'github',
      securityMode: 'block-all',
      includeBookmarks: true,
      includePdfIndex: false,
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
      includeBookmarks: 'yes',
    });

    expect(result.profile).toEqual({
      schemaVersion: 1,
      name: 'Loose',
    });
    expect(result.warnings).toHaveLength(3);
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
