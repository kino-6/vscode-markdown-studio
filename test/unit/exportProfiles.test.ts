import { describe, expect, it } from 'vitest';
import {
  getConfiguredExportProfiles,
  normalizeExportProfile,
  resolveActiveExportProfile,
} from '../../src/infra/exportProfiles';

function configuration(values: Record<string, unknown>) {
  return {
    get: (key: string, fallback: unknown) => values[key] ?? fallback,
  } as any;
}

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
  it('normalizes profiles from configuration arrays', () => {
    const cfg = configuration({
      exportProfiles: [
        { name: 'A4', pageFormat: 'A4' },
        { name: 'Letter', pageFormat: 'Letter' },
      ],
    });

    expect(getConfiguredExportProfiles(cfg).profiles.map(profile => profile.name)).toEqual(['A4', 'Letter']);
  });

  it('resolves the active profile by name', () => {
    const cfg = configuration({
      activeExportProfile: 'Letter',
      exportProfiles: [
        { name: 'A4', pageFormat: 'A4' },
        { name: 'Letter', pageFormat: 'Letter' },
      ],
    });

    expect(resolveActiveExportProfile(cfg).profile).toMatchObject({
      name: 'Letter',
      pageFormat: 'Letter',
    });
  });

  it('warns when active profile is missing', () => {
    const cfg = configuration({
      activeExportProfile: 'Missing',
      exportProfiles: [{ name: 'A4', pageFormat: 'A4' }],
    });

    const result = resolveActiveExportProfile(cfg);

    expect(result.profile).toBeUndefined();
    expect(result.warnings[0]).toContain('Missing');
  });
});
