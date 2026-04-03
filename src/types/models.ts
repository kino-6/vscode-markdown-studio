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
