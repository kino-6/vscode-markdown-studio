import * as vscode from 'vscode';
import { PdfHeaderFooterConfig, StyleConfig } from '../types/models';

export function clampFontSize(n: number): number {
  return Math.max(8, Math.min(32, n));
}

export function clampLineHeight(n: number): number {
  return Math.max(1.0, Math.min(3.0, n));
}

const DEFAULT_FONT_FAMILY = '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif';

export interface MarkdownStudioConfig {
  plantUmlMode: 'bundled-jar' | 'external-command' | 'docker';
  javaPath: string;
  pageFormat: 'A3' | 'A4' | 'A5' | 'Letter' | 'Legal' | 'Tabloid';
  blockExternalLinks: boolean;
  pdfHeaderFooter: PdfHeaderFooterConfig;
  sourceJumpEnabled: boolean;
  style: StyleConfig;
}

export function getConfig(): MarkdownStudioConfig {
  const cfg = vscode.workspace.getConfiguration('markdownStudio');
  const rawFontFamily = cfg.get<string>('style.fontFamily', DEFAULT_FONT_FAMILY);
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
    style: {
      fontFamily: rawFontFamily.trim() === '' ? DEFAULT_FONT_FAMILY : rawFontFamily,
      fontSize: clampFontSize(cfg.get<number>('style.fontSize', 14)),
      lineHeight: clampLineHeight(cfg.get<number>('style.lineHeight', 1.6)),
      margin: cfg.get<string>('export.margin', '20mm'),
    },
  };
}
