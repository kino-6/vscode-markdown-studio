import type { ExportProfile, ExternalResourceMode, PageFormat, PresetName } from '../types/models';

export interface ExportProfileValidationResult {
  profile?: ExportProfile;
  errors: string[];
  warnings: string[];
}

const PAGE_FORMATS = new Set<PageFormat>(['A3', 'A4', 'A5', 'Letter', 'Legal', 'Tabloid']);
const STYLE_PRESETS = new Set<PresetName>(['markdown-pdf', 'github', 'minimal', 'academic', 'custom']);
const STYLE_THEMES = new Set(['default', 'modern', 'markdown-pdf', 'minimal']);
const SECURITY_MODES = new Set<ExternalResourceMode>(['block-all', 'whitelist', 'allow-all']);
const NORMALIZED_PROFILE_FIELDS = [
  'pageFormat',
  'stylePreset',
  'styleTheme',
  'fontFamily',
  'fontSize',
  'lineHeight',
  'margin',
  'customCss',
  'securityMode',
  'allowedDomains',
  'headerEnabled',
  'headerTemplate',
  'footerEnabled',
  'footerTemplate',
  'pageBreakEnabled',
  'includeBookmarks',
  'includePdfIndex',
  'pdfIndexTitle',
  'hidePdfToc',
  'coverEnabled',
  'coverPath',
  'tocLevels',
  'tocOrderedList',
  'tocPageBreak',
  'codeBlockLineNumbers',
  'outputFilename',
] as const satisfies readonly (keyof ExportProfile)[];

const STRING_FIELDS = [
  'fontFamily',
  'margin',
  'customCss',
  'pdfIndexTitle',
  'coverPath',
  'tocLevels',
  'outputFilename',
] as const satisfies readonly (keyof ExportProfile)[];

const NUMBER_FIELDS = [
  'fontSize',
  'lineHeight',
] as const satisfies readonly (keyof ExportProfile)[];

const BOOLEAN_FIELDS = [
  'headerEnabled',
  'footerEnabled',
  'pageBreakEnabled',
  'includeBookmarks',
  'includePdfIndex',
  'hidePdfToc',
  'coverEnabled',
  'tocOrderedList',
  'tocPageBreak',
  'codeBlockLineNumbers',
] as const satisfies readonly (keyof ExportProfile)[];

const NULLABLE_STRING_FIELDS = [
  'headerTemplate',
  'footerTemplate',
] as const satisfies readonly (keyof ExportProfile)[];

const STRING_ARRAY_FIELDS = [
  'allowedDomains',
] as const satisfies readonly (keyof ExportProfile)[];

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

function readString(
  raw: Record<string, unknown>,
  key: string,
  warnings: string[],
): string | undefined {
  const value = raw[key];
  if (value === undefined) return undefined;
  if (typeof value === 'string') return value;
  warnings.push(`Ignored invalid export profile field "${key}".`);
  return undefined;
}

function readNullableString(
  raw: Record<string, unknown>,
  key: string,
  warnings: string[],
): string | null | undefined {
  const value = raw[key];
  if (value === undefined) return undefined;
  if (value === null || typeof value === 'string') return value;
  warnings.push(`Ignored invalid export profile field "${key}".`);
  return undefined;
}

function readNumber(
  raw: Record<string, unknown>,
  key: string,
  warnings: string[],
): number | undefined {
  const value = raw[key];
  if (value === undefined) return undefined;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  warnings.push(`Ignored invalid export profile field "${key}".`);
  return undefined;
}

function readStringArray(
  raw: Record<string, unknown>,
  key: string,
  warnings: string[],
): string[] | undefined {
  const value = raw[key];
  if (value === undefined) return undefined;
  if (Array.isArray(value) && value.every(item => typeof item === 'string')) {
    return [...value];
  }
  warnings.push(`Ignored invalid export profile field "${key}".`);
  return undefined;
}

function assignIfDefined<T>(
  profile: ExportProfile,
  key: keyof ExportProfile,
  value: T | undefined,
): void {
  if (value !== undefined) {
    profile[key] = value;
  }
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
  for (const field of NORMALIZED_PROFILE_FIELDS) {
    delete profile[field];
  }

  assignIfDefined(profile, 'pageFormat', readStringEnum(input, 'pageFormat', PAGE_FORMATS, warnings));
  assignIfDefined(profile, 'stylePreset', readStringEnum(input, 'stylePreset', STYLE_PRESETS, warnings));
  assignIfDefined(profile, 'styleTheme', readStringEnum(input, 'styleTheme', STYLE_THEMES, warnings));
  assignIfDefined(profile, 'securityMode', readStringEnum(input, 'securityMode', SECURITY_MODES, warnings));

  for (const field of STRING_FIELDS) {
    assignIfDefined(profile, field, readString(input, field, warnings));
  }
  for (const field of NUMBER_FIELDS) {
    assignIfDefined(profile, field, readNumber(input, field, warnings));
  }
  for (const field of BOOLEAN_FIELDS) {
    assignIfDefined(profile, field, readBoolean(input, field, warnings));
  }
  for (const field of NULLABLE_STRING_FIELDS) {
    assignIfDefined(profile, field, readNullableString(input, field, warnings));
  }
  for (const field of STRING_ARRAY_FIELDS) {
    assignIfDefined(profile, field, readStringArray(input, field, warnings));
  }


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
