export type PreviewThemeMode = 'auto' | 'light' | 'dark';
export type PreviewContentWidth = 'a4' | 'full';

export type FencedBlockKind = 'mermaid' | 'plantuml' | 'puml' | 'svg' | 'wavedrom';

export interface FencedBlock {
  id: string;
  kind: FencedBlockKind;
  content: string;
  startLine: number;
  endLine: number;
  startOffset: number;
  endOffset: number;
  raw: string;
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

/** Extracted heading entry. */
export interface HeadingEntry {
  level: number;       // 1-6
  text: string;        // Plain text with inline markup removed.
  line: number;        // 0-based source line number.
}

/** Mapping between a heading and its anchor ID. */
export interface AnchorMapping {
  heading: HeadingEntry;
  anchorId: string;
}

/** TOC generation settings. */
export interface TocConfig {
  minLevel: number;
  maxLevel: number;
  orderedList: boolean;
  pageBreak: boolean;
}

/** Diagnostic information for TOC validation. */
export interface TocDiagnostic {
  line: number;
  anchorId: string;
  expectedHeading: string;
  message: string;
}

/** TOC generation result. */
export interface TocResult {
  html: string;
  headings: HeadingEntry[];
  anchors: AnchorMapping[];
  diagnostics: TocDiagnostic[];
}

/** Code block settings. */
export interface CodeBlockConfig {
  lineNumbers: boolean;
}

/** Custom CSS loading result. */
export interface CustomCssResult {
  /** CSS string when loading succeeds, otherwise an empty string. */
  css: string;
  /** Warning and error messages for logging. */
  warnings: string[];
}

/** PDF index settings. */
export interface PdfIndexConfig {
  enabled: boolean;
  title: string;
}

/** PDF inline TOC visibility settings. */
export interface PdfTocConfig {
  hidden: boolean;
}

/** PDF bookmark settings. */
export interface PdfBookmarksConfig {
  enabled: boolean;
}

/** Lightweight heading entry for bookmark generation. */
export interface BookmarkEntry {
  level: number;
  text: string;
  pageNumber: number;  // 1-based page number.
}
