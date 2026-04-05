import {
  PresetName,
  PresetStyleDefaults,
  ResolvedStyleConfig,
  StyleConfigOverrides,
} from '../types/models';

const VALID_PRESET_NAMES: ReadonlySet<string> = new Set<PresetName>([
  'markdown-pdf',
  'github',
  'minimal',
  'academic',
  'custom',
]);

const MARKDOWN_PDF_DEFAULTS: PresetStyleDefaults = {
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
  fontSize: 14,
  lineHeight: 1.6,
  margin: '20mm',
  codeFontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
  headingStyle: {
    h1FontWeight: 600,
    h1MarginTop: '24px',
    h1MarginBottom: '16px',
    h2MarginTop: '24px',
    h2MarginBottom: '16px',
  },
  codeBlockStyle: {
    background: '#f6f8fa',
    border: '1px solid #d0d7de',
    borderRadius: '6px',
    padding: '1em',
  },
};

export const PRESET_DEFAULTS: Record<PresetName, PresetStyleDefaults> = {
  'markdown-pdf': MARKDOWN_PDF_DEFAULTS,
  'github': {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Noto Sans, Helvetica, Arial, sans-serif',
    fontSize: 16,
    lineHeight: 1.5,
    margin: '20mm',
    codeFontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
    headingStyle: {
      h1FontWeight: 600,
      h1MarginTop: '24px',
      h1MarginBottom: '16px',
      h2MarginTop: '24px',
      h2MarginBottom: '16px',
    },
    codeBlockStyle: {
      background: '#f6f8fa',
      border: '1px solid #d0d7de',
      borderRadius: '6px',
      padding: '16px',
    },
  },
  'minimal': {
    fontFamily: 'system-ui, sans-serif',
    fontSize: 15,
    lineHeight: 1.8,
    margin: '25mm',
    codeFontFamily: 'ui-monospace, monospace',
    headingStyle: {
      h1FontWeight: 600,
      h1MarginTop: '32px',
      h1MarginBottom: '16px',
      h2MarginTop: '28px',
      h2MarginBottom: '12px',
    },
    codeBlockStyle: {
      background: '#fafafa',
      border: '1px solid #eaeaea',
      borderRadius: '4px',
      padding: '1.2em',
    },
  },
  'academic': {
    fontFamily: 'Georgia, "Times New Roman", serif',
    fontSize: 12,
    lineHeight: 2.0,
    margin: '25mm',
    codeFontFamily: '"Courier New", Courier, monospace',
    headingStyle: {
      h1FontWeight: 700,
      h1MarginTop: '32px',
      h1MarginBottom: '20px',
      h1TextAlign: 'center',
      h2MarginTop: '28px',
      h2MarginBottom: '14px',
    },
    codeBlockStyle: {
      background: '#f5f5f5',
      border: '1px solid #ccc',
      borderRadius: '3px',
      padding: '1em',
    },
  },
  'custom': MARKDOWN_PDF_DEFAULTS,
};

export function resolvePreset(
  presetName: string,
  overrides: Partial<StyleConfigOverrides>,
): ResolvedStyleConfig {
  const validName: PresetName = VALID_PRESET_NAMES.has(presetName)
    ? (presetName as PresetName)
    : 'markdown-pdf';

  const defaults = PRESET_DEFAULTS[validName];

  return {
    fontFamily: overrides.fontFamily ?? defaults.fontFamily,
    fontSize: overrides.fontSize ?? defaults.fontSize,
    lineHeight: overrides.lineHeight ?? defaults.lineHeight,
    margin: overrides.margin ?? defaults.margin,
    codeFontFamily: defaults.codeFontFamily,
    headingStyle: { ...defaults.headingStyle },
    codeBlockStyle: { ...defaults.codeBlockStyle },
    presetName: validName,
  };
}
