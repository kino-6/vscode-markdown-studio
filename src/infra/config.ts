import * as vscode from 'vscode';
import { PdfHeaderFooterConfig, ResolvedStyleConfig, StyleConfigOverrides } from '../types/models';
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
  blockExternalLinks: boolean;
  pdfHeaderFooter: PdfHeaderFooterConfig;
  sourceJumpEnabled: boolean;
  style: ResolvedStyleConfig;
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
    blockExternalLinks: cfg.get('security.blockExternalLinks', true),
    pdfHeaderFooter: {
      headerEnabled: cfg.get<boolean>('export.header.enabled', true),
      headerTemplate: cfg.get<string | null>('export.header.template', null),
      footerEnabled: cfg.get<boolean>('export.footer.enabled', true),
      footerTemplate: cfg.get<string | null>('export.footer.template', null),
      pageBreakEnabled: cfg.get<boolean>('export.pageBreak.enabled', true),
    },
    sourceJumpEnabled: cfg.get<boolean>('preview.sourceJump.enabled', false),
    style,
  };
}
