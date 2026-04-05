import * as vscode from 'vscode';
import { PdfHeaderFooterConfig } from '../types/models';

export interface MarkdownStudioConfig {
  plantUmlMode: 'bundled-jar' | 'external-command' | 'docker';
  javaPath: string;
  pageFormat: 'A4' | 'Letter';
  blockExternalLinks: boolean;
  pdfHeaderFooter: PdfHeaderFooterConfig;
  sourceJumpEnabled: boolean;
}

export function getConfig(): MarkdownStudioConfig {
  const cfg = vscode.workspace.getConfiguration('markdownStudio');
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
  };
}
