export type FencedBlockKind = 'mermaid' | 'plantuml' | 'puml' | 'svg';

export interface FencedBlock {
  id: string;
  kind: FencedBlockKind;
  content: string;
  startLine: number;
  endLine: number;
}

export interface RenderError {
  title: string;
  detail: string;
}

export interface RenderedMarkdown {
  htmlBody: string;
  errors: RenderError[];
}

export interface PlantUmlResult {
  ok: boolean;
  svg?: string;
  error?: string;
}

export interface PdfHeaderFooterConfig {
  headerEnabled: boolean;
  headerTemplate: string | null;
  footerEnabled: boolean;
  footerTemplate: string | null;
  pageBreakEnabled: boolean;
}

export interface PdfTemplateOptions {
  displayHeaderFooter: boolean;
  headerTemplate: string;
  footerTemplate: string;
  margin: { top: string; bottom: string; left: string; right: string };
}
