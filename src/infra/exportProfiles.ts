import type { ExportProfile, ExternalResourceMode, PageFormat, PresetName } from '../types/models';

export interface ExportProfileValidationResult {
  profile?: ExportProfile;
  errors: string[];
  warnings: string[];
}

const PAGE_FORMATS = new Set<PageFormat>(['A3', 'A4', 'A5', 'Letter', 'Legal', 'Tabloid']);
const STYLE_PRESETS = new Set<PresetName>(['markdown-pdf', 'github', 'minimal', 'academic', 'custom']);
const SECURITY_MODES = new Set<ExternalResourceMode>(['block-all', 'whitelist', 'allow-all']);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readStringEnum<T extends string>(
  raw: Record<string, unknown>,
  key: string,
  allowed: ReadonlySet<T>,
  warnings: string[],
): T | undefined {
  const value = raw[key];
  if (value === undefined) return undefined;
  if (typeof value === 'string' && allowed.has(value as T)) return value as T;
  warnings.push(`Ignored invalid export profile field "${key}".`);
  return undefined;
}

function readBoolean(
  raw: Record<string, unknown>,
  key: string,
  warnings: string[],
): boolean | undefined {
  const value = raw[key];
  if (value === undefined) return undefined;
  if (typeof value === 'boolean') return value;
  warnings.push(`Ignored invalid export profile field "${key}".`);
  return undefined;
}

export function normalizeExportProfile(input: unknown): ExportProfileValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!isObject(input)) {
    return { errors: ['Export profile must be a JSON object.'], warnings };
  }

  const schemaVersion = input.schemaVersion ?? 1;
  if (schemaVersion !== 1) {
    return { errors: [`Unsupported export profile schemaVersion: ${String(schemaVersion)}.`], warnings };
  }

  if (typeof input.name !== 'string' || input.name.trim() === '') {
    return { errors: ['Export profile requires a non-empty name.'], warnings };
  }

  const profile: ExportProfile = {
    ...input,
    schemaVersion: 1,
    name: input.name.trim(),
  };
  delete profile.pageFormat;
  delete profile.stylePreset;
  delete profile.securityMode;
  delete profile.includeBookmarks;
  delete profile.includePdfIndex;

  const pageFormat = readStringEnum(input, 'pageFormat', PAGE_FORMATS, warnings);
  if (pageFormat) profile.pageFormat = pageFormat;

  const stylePreset = readStringEnum(input, 'stylePreset', STYLE_PRESETS, warnings);
  if (stylePreset) profile.stylePreset = stylePreset;

  const securityMode = readStringEnum(input, 'securityMode', SECURITY_MODES, warnings);
  if (securityMode) profile.securityMode = securityMode;

  const includeBookmarks = readBoolean(input, 'includeBookmarks', warnings);
  if (includeBookmarks !== undefined) profile.includeBookmarks = includeBookmarks;

  const includePdfIndex = readBoolean(input, 'includePdfIndex', warnings);
  if (includePdfIndex !== undefined) profile.includePdfIndex = includePdfIndex;

  return { profile, errors, warnings };
}

export function normalizeExportProfiles(input: unknown): { profiles: ExportProfile[]; warnings: string[] } {
  const warnings: string[] = [];
  if (!Array.isArray(input)) {
    return { profiles: [], warnings: ['Export profiles setting must be an array.'] };
  }

  const profiles: ExportProfile[] = [];
  for (const item of input) {
    const result = normalizeExportProfile(item);
    warnings.push(...result.warnings);
    if (result.profile) {
      profiles.push(result.profile);
    } else {
      warnings.push(...result.errors);
    }
  }
  return { profiles, warnings };
}
