import * as vscode from 'vscode';
import { CodeBlockConfig, DEFAULT_ALLOWED_DOMAINS, ExternalResourceConfig, ExternalResourceMode, PdfHeaderFooterConfig, ResolvedStyleConfig, StyleConfigOverrides, TocConfig } from '../types/models';
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
  pageFormat: 'A3' | 'A4' | 'A5' | 'Letter' | 'Legal' | 'Tabloid';
  externalResources: ExternalResourceConfig;
  pdfHeaderFooter: PdfHeaderFooterConfig;
  sourceJumpEnabled: boolean;
  style: ResolvedStyleConfig;
  toc: TocConfig;
  codeBlock: CodeBlockConfig;
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
  cfg: vscode.WorkspaceConfiguration
): ExternalResourceConfig {
  const hasNewMode = hasUserValue(cfg, 'security.externalResources.mode');
  const hasLegacy = hasUserValue(cfg, 'security.blockExternalLinks');

  // New settings explicitly set → use new settings
  if (hasNewMode) {
    return {
      mode: cfg.get<ExternalResourceMode>('security.externalResources.mode', 'whitelist'),
      allowedDomains: cfg.get<string[]>('security.externalResources.allowedDomains', [...DEFAULT_ALLOWED_DOMAINS]),
    };
  }

  // Legacy only → migrate
  if (hasLegacy) {
    const blockAll = cfg.get<boolean>('security.blockExternalLinks', true);
    return {
      mode: blockAll ? 'block-all' : 'allow-all',
      allowedDomains: [...DEFAULT_ALLOWED_DOMAINS],
    };
  }

  // Neither set → defaults
  return {
    mode: 'whitelist',
    allowedDomains: [...DEFAULT_ALLOWED_DOMAINS],
  };
}

export function getConfig(): MarkdownStudioConfig {
  const cfg = vscode.workspace.getConfiguration('markdownStudio');

  const presetName = cfg.get<string>('style.preset', 'markdown-pdf');

  const overrides: Partial<StyleConfigOverrides> = {};
  if (hasUserValue(cfg, 'style.fontFamily')) {
    overrides.fontFamily = cfg.get<string>('style.fontFamily')!;
  }
  if (hasUserValue(cfg, 'style.fontSize')) {
    overrides.fontSize = clampFontSize(cfg.get<number>('style.fontSize')!);
  }
  if (hasUserValue(cfg, 'style.lineHeight')) {
    overrides.lineHeight = clampLineHeight(cfg.get<number>('style.lineHeight')!);
  }
  if (hasUserValue(cfg, 'export.margin')) {
    overrides.margin = cfg.get<string>('export.margin')!;
  }

  const style = resolvePreset(presetName, overrides);

  return {
    plantUmlMode: cfg.get('plantuml.mode', 'bundled-jar'),
    javaPath: cfg.get('java.path', 'java'),
    pageFormat: cfg.get('export.pageFormat', 'A4'),
    externalResources: resolveExternalResourceConfig(cfg),
    pdfHeaderFooter: {
      headerEnabled: cfg.get<boolean>('export.header.enabled', true),
      headerTemplate: cfg.get<string | null>('export.header.template', null),
      footerEnabled: cfg.get<boolean>('export.footer.enabled', true),
      footerTemplate: cfg.get<string | null>('export.footer.template', null),
      pageBreakEnabled: cfg.get<boolean>('export.pageBreak.enabled', true),
    },
    sourceJumpEnabled: cfg.get<boolean>('preview.sourceJump.enabled', false),
    style,
    toc: {
      ...parseLevels(cfg.get<string>('toc.levels', '1-3')),
      orderedList: cfg.get<boolean>('toc.orderedList', false),
      pageBreak: cfg.get<boolean>('toc.pageBreak', true),
    },
    codeBlock: {
      lineNumbers: cfg.get<boolean>('codeBlock.lineNumbers', false),
    },
  };
}
