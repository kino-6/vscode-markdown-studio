import * as vscode from 'vscode';
import { CodeBlockConfig, ExportConfigOverlay, ExternalResourceConfig, ExternalResourceMode, PageFormat, PdfBookmarksConfig, PdfCoverConfig, PdfHeaderFooterConfig, PdfIndexConfig, PdfTocConfig, PreviewContentWidth, PreviewThemeMode, ResolvedStyleConfig, StyleConfigOverrides, TocConfig } from '../types/models';
import { CONFIG_DEFAULTS, CONFIG_KEYS, CONFIG_SECTION } from './configurationRegistry';
import { resolvePreset } from './presets';

export function clampFontSize(n: number): number {
  return Math.max(8, Math.min(32, n));
}

export function clampLineHeight(n: number): number {
  return Math.max(1.0, Math.min(3.0, n));
}

export interface MarkdownStudioConfig {
  plantUmlMode: 'bundled-jar' | 'external-command' | 'docker';
  javaPath: string;
  pageFormat: PageFormat;
  externalResources: ExternalResourceConfig;
  pdfHeaderFooter: PdfHeaderFooterConfig;
  sourceJumpEnabled: boolean;
  style: ResolvedStyleConfig;
  toc: TocConfig;
  codeBlock: CodeBlockConfig;
  pdfIndex: PdfIndexConfig;
  pdfToc: PdfTocConfig;
  pdfBookmarks: PdfBookmarksConfig;
  pdfCover: PdfCoverConfig;
  theme: string;
  customCss: string;
  outputFilename: string;
  previewTheme: PreviewThemeMode;
  previewContentWidth: PreviewContentWidth;
  diagramTimeout: number;
}

/**
 * Parse a levels string (e.g. "1-3") into minLevel/maxLevel.
 * Returns defaults (1, 3) for invalid values.
 */
export function parseLevels(levels: string): { minLevel: number; maxLevel: number } {
  const match = /^([1-6])-([1-6])$/.exec(levels.trim());
  if (!match) {
    return { minLevel: 1, maxLevel: 3 };
  }
  const min = Number(match[1]);
  const max = Number(match[2]);
  if (min > max) {
    return { minLevel: 1, maxLevel: 3 };
  }
  return { minLevel: min, maxLevel: max };
}

function hasUserValue(cfg: vscode.WorkspaceConfiguration, key: string): boolean {
  const inspection = cfg.inspect(key);
  if (!inspection) return false;
  return (
    inspection.globalValue !== undefined ||
    inspection.workspaceValue !== undefined ||
    inspection.workspaceFolderValue !== undefined
  );
}

export function resolveExternalResourceConfig(
  cfg: vscode.WorkspaceConfiguration,
  modeOverride?: ExternalResourceMode,
): ExternalResourceConfig {
  if (modeOverride) {
    return {
      mode: modeOverride,
      allowedDomains: cfg.get<string[]>(CONFIG_KEYS.externalResourceAllowedDomains, [...CONFIG_DEFAULTS.externalResourceAllowedDomains]),
    };
  }

  const hasNewMode = hasUserValue(cfg, CONFIG_KEYS.externalResourceMode);
  const hasLegacy = hasUserValue(cfg, CONFIG_KEYS.legacyBlockExternalLinks);

  if (hasNewMode) {
    return {
      mode: cfg.get<ExternalResourceMode>(CONFIG_KEYS.externalResourceMode, CONFIG_DEFAULTS.externalResourceMode),
      allowedDomains: cfg.get<string[]>(CONFIG_KEYS.externalResourceAllowedDomains, [...CONFIG_DEFAULTS.externalResourceAllowedDomains]),
    };
  }

  if (hasLegacy) {
    const blockAll = cfg.get<boolean>(CONFIG_KEYS.legacyBlockExternalLinks, CONFIG_DEFAULTS.legacyBlockExternalLinks);
    return {
      mode: blockAll ? 'block-all' : 'allow-all',
      allowedDomains: [...CONFIG_DEFAULTS.externalResourceAllowedDomains],
    };
  }

  return {
    mode: CONFIG_DEFAULTS.externalResourceMode,
    allowedDomains: [...CONFIG_DEFAULTS.externalResourceAllowedDomains],
  };
}

function getConfigFromWorkspace(
  cfg: vscode.WorkspaceConfiguration,
  overlay?: ExportConfigOverlay,
): MarkdownStudioConfig {
  const presetName = overlay?.stylePreset ?? cfg.get<string>(CONFIG_KEYS.stylePreset, CONFIG_DEFAULTS.stylePreset);

  const overrides: Partial<StyleConfigOverrides> = {};
  if (hasUserValue(cfg, CONFIG_KEYS.styleFontFamily)) {
    overrides.fontFamily = cfg.get<string>(CONFIG_KEYS.styleFontFamily)!;
  }
  if (hasUserValue(cfg, CONFIG_KEYS.styleFontSize)) {
    overrides.fontSize = clampFontSize(cfg.get<number>(CONFIG_KEYS.styleFontSize)!);
  }
  if (hasUserValue(cfg, CONFIG_KEYS.styleLineHeight)) {
    overrides.lineHeight = clampLineHeight(cfg.get<number>(CONFIG_KEYS.styleLineHeight)!);
  }
  if (hasUserValue(cfg, CONFIG_KEYS.exportMargin)) {
    overrides.margin = cfg.get<string>(CONFIG_KEYS.exportMargin)!;
  }

  const style = resolvePreset(presetName, overrides);

  return {
    plantUmlMode: cfg.get(CONFIG_KEYS.plantUmlMode, CONFIG_DEFAULTS.plantUmlMode),
    javaPath: cfg.get(CONFIG_KEYS.javaPath, CONFIG_DEFAULTS.javaPath),
    pageFormat: overlay?.pageFormat ?? cfg.get(CONFIG_KEYS.pageFormat, CONFIG_DEFAULTS.pageFormat),
    externalResources: resolveExternalResourceConfig(cfg, overlay?.securityMode),
    pdfHeaderFooter: {
      headerEnabled: cfg.get<boolean>(CONFIG_KEYS.exportHeaderEnabled, CONFIG_DEFAULTS.exportHeaderEnabled),
      headerTemplate: cfg.get<string | null>(CONFIG_KEYS.exportHeaderTemplate, CONFIG_DEFAULTS.exportHeaderTemplate),
      footerEnabled: cfg.get<boolean>(CONFIG_KEYS.exportFooterEnabled, CONFIG_DEFAULTS.exportFooterEnabled),
      footerTemplate: cfg.get<string | null>(CONFIG_KEYS.exportFooterTemplate, CONFIG_DEFAULTS.exportFooterTemplate),
      pageBreakEnabled: cfg.get<boolean>(CONFIG_KEYS.exportPageBreakEnabled, CONFIG_DEFAULTS.exportPageBreakEnabled),
    },
    sourceJumpEnabled: cfg.get<boolean>(CONFIG_KEYS.previewSourceJumpEnabled, CONFIG_DEFAULTS.previewSourceJumpEnabled),
    style,
    toc: {
      ...parseLevels(cfg.get<string>(CONFIG_KEYS.tocLevels, CONFIG_DEFAULTS.tocLevels)),
      orderedList: cfg.get<boolean>(CONFIG_KEYS.tocOrderedList, CONFIG_DEFAULTS.tocOrderedList),
      pageBreak: cfg.get<boolean>(CONFIG_KEYS.tocPageBreak, CONFIG_DEFAULTS.tocPageBreak),
    },
    codeBlock: {
      lineNumbers: cfg.get<boolean>(CONFIG_KEYS.codeBlockLineNumbers, CONFIG_DEFAULTS.codeBlockLineNumbers),
    },
    pdfIndex: {
      enabled: overlay?.includePdfIndex ?? cfg.get<boolean>(CONFIG_KEYS.exportPdfIndexEnabled, CONFIG_DEFAULTS.exportPdfIndexEnabled),
      title: cfg.get<string>(CONFIG_KEYS.exportPdfIndexTitle, CONFIG_DEFAULTS.exportPdfIndexTitle),
    },
    pdfToc: {
      hidden: cfg.get<boolean>(CONFIG_KEYS.exportPdfTocHidden, CONFIG_DEFAULTS.exportPdfTocHidden),
    },
    pdfBookmarks: {
      enabled: overlay?.includeBookmarks ?? cfg.get<boolean>(CONFIG_KEYS.exportPdfBookmarksEnabled, CONFIG_DEFAULTS.exportPdfBookmarksEnabled),
    },
    pdfCover: {
      enabled: cfg.get<boolean>(CONFIG_KEYS.exportCoverEnabled, CONFIG_DEFAULTS.exportCoverEnabled),
      path: cfg.get<string>(CONFIG_KEYS.exportCoverPath, CONFIG_DEFAULTS.exportCoverPath),
    },
    theme: cfg.get<string>(CONFIG_KEYS.styleTheme, CONFIG_DEFAULTS.styleTheme),
    customCss: cfg.get<string>(CONFIG_KEYS.styleCustomCss, CONFIG_DEFAULTS.styleCustomCss),
    outputFilename: cfg.get<string>(CONFIG_KEYS.exportOutputFilename, CONFIG_DEFAULTS.exportOutputFilename),
    previewTheme: cfg.get<PreviewThemeMode>(CONFIG_KEYS.previewTheme, CONFIG_DEFAULTS.previewTheme),
    previewContentWidth: cfg.get<PreviewContentWidth>(CONFIG_KEYS.previewContentWidth, CONFIG_DEFAULTS.previewContentWidth),
    diagramTimeout: cfg.get<number>(CONFIG_KEYS.exportDiagramTimeout, CONFIG_DEFAULTS.exportDiagramTimeout),
  };
}

export function getConfig(): MarkdownStudioConfig {
  return getConfigFromWorkspace(vscode.workspace.getConfiguration(CONFIG_SECTION));
}

export function getExportConfig(overlay?: ExportConfigOverlay): MarkdownStudioConfig {
  return getConfigFromWorkspace(vscode.workspace.getConfiguration(CONFIG_SECTION), overlay);
}
