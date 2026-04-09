export type PreviewThemeMode = 'auto' | 'light' | 'dark';

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

/** 抽出された見出しエントリ */
export interface HeadingEntry {
  level: number;       // 1〜6
  text: string;        // プレーンテキスト（インライン書式除去済み）
  line: number;        // ソース行番号（0-based）
}

/** 見出しとアンカーIDのマッピング */
export interface AnchorMapping {
  heading: HeadingEntry;
  anchorId: string;
}

/** TOC生成設定 */
export interface TocConfig {
  minLevel: number;
  maxLevel: number;
  orderedList: boolean;
  pageBreak: boolean;
}

/** TOC検証の診断情報 */
export interface TocDiagnostic {
  line: number;
  anchorId: string;
  expectedHeading: string;
  message: string;
}

/** TOC生成結果 */
export interface TocResult {
  html: string;
  headings: HeadingEntry[];
  anchors: AnchorMapping[];
  diagnostics: TocDiagnostic[];
}

/** コードブロック設定 */
export interface CodeBlockConfig {
  lineNumbers: boolean;
}

/** カスタムCSS読み込み結果 */
export interface CustomCssResult {
  /** 読み込み成功時のCSS文字列。失敗時は空文字列 */
  css: string;
  /** 警告・エラーメッセージ（ログ出力用） */
  warnings: string[];
}

/** PDF Index設定 */
export interface PdfIndexConfig {
  enabled: boolean;
  title: string;
}

/** PDF ToC表示設定 */
export interface PdfTocConfig {
  hidden: boolean;
}

/** PDFブックマーク設定 */
export interface PdfBookmarksConfig {
  enabled: boolean;
}

/** ブックマーク生成用の見出しエントリ（HeadingPageEntryからanchorIdを除いた軽量版） */
export interface BookmarkEntry {
  level: number;
  text: string;
  pageNumber: number;  // 1-based ページ番号
}
