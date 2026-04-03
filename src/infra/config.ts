import * as vscode from 'vscode';

export interface MarkdownStudioConfig {
  plantUmlMode: 'bundled-jar' | 'external-command' | 'docker';
  javaPath: string;
  pageFormat: 'A4' | 'Letter';
  blockExternalLinks: boolean;
}

export function getConfig(): MarkdownStudioConfig {
  const cfg = vscode.workspace.getConfiguration('markdownStudio');
  return {
    plantUmlMode: cfg.get('plantuml.mode', 'bundled-jar'),
    javaPath: cfg.get('java.path', 'java'),
    pageFormat: cfg.get('export.pageFormat', 'A4'),
    blockExternalLinks: cfg.get('security.blockExternalLinks', true)
  };
}
