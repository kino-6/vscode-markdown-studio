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

export interface StyleConfig {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  margin: string;
}

export type PresetName = 'markdown-pdf' | 'github' | 'minimal' | 'academic' | 'custom';

export interface HeadingStyle {
  h1FontWeight: number;
  h1MarginTop: string;
  h1MarginBottom: string;
  h1TextAlign?: string;
  h2MarginTop: string;
  h2MarginBottom: string;
}

export interface CodeBlockStyle {
  background: string;
  border: string;
  borderRadius: string;
  padding: string;
}

export interface PresetStyleDefaults {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  margin: string;
  codeFontFamily: string;
  headingStyle: HeadingStyle;
  codeBlockStyle: CodeBlockStyle;
}

export interface ResolvedStyleConfig {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  margin: string;
  codeFontFamily: string;
  headingStyle: HeadingStyle;
  codeBlockStyle: CodeBlockStyle;
  presetName: PresetName;
}

export interface StyleConfigOverrides {
  fontFamily?: string;
  fontSize?: number;
  lineHeight?: number;
  margin?: string;
}


export type ExternalResourceMode = "block-all" | "whitelist" | "allow-all";

export const DEFAULT_ALLOWED_DOMAINS: readonly string[] = [
  "github.com",
  "raw.githubusercontent.com",
  "user-images.githubusercontent.com",
] as const;

export interface ExternalResourceConfig {
  mode: ExternalResourceMode;
  allowedDomains: string[];
}
