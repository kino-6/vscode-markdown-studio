import type MarkdownIt from 'markdown-it';
import { createMarkdownParser } from '../parser/parseMarkdown';
import { extractHeadings } from '../toc/extractHeadings';

/** Context required to resolve filename template variables. */
export interface FilenameContext {
  /** Source file name without extension. */
  filename: string;
  /** Source file extension without the leading dot. */
  ext: string;
  /** First H1 heading text in the document, if one exists. */
  title?: string;
  /** Export timestamp, injectable for tests. */
  now?: Date;
}

/**
 * Extracts the plain text of the first H1 heading from Markdown.
 * Uses the same parser as the preview, so `#` lines inside code blocks and
 * front matter are ignored and setext (`Title` + `===`) headings are found.
 * Returns undefined when no H1 exists.
 */
export function extractH1Title(markdown: string): string | undefined {
  const heading = extractHeadings(markdown, getTitleParser()).find((entry) => entry.level === 1);
  const text = heading?.text.trim();
  return text ? text : undefined;
}

let titleParser: MarkdownIt | undefined;
function getTitleParser(): MarkdownIt {
  titleParser ??= createMarkdownParser();
  return titleParser;
}

/**
 * Converts a Date to a local YYYY-MM-DD date string.
 */
function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Converts a Date to a local YYYY-MM-DD_HHmmss datetime string.
 */
function formatDatetime(d: Date): string {
  const date = formatDate(d);
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  return `${date}_${h}${min}${s}`;
}

/**
 * Replaces known `${variableName}` patterns in a template.
 * Unknown variables are left unchanged.
 */
export function resolveVariables(template: string, ctx: FilenameContext): string {
  const now = ctx.now ?? new Date();
  const titleValue = ctx.title ?? ctx.filename;

  const variables: Record<string, string> = {
    filename: ctx.filename,
    ext: ctx.ext,
    date: formatDate(now),
    datetime: formatDatetime(now),
    title: titleValue,
  };

  return template.replace(/\$\{([^}]+)\}/g, (match, name: string) => {
    return Object.prototype.hasOwnProperty.call(variables, name) ? variables[name] : match;
  });
}

/**
 * Removes filesystem-forbidden characters and trims leading/trailing
 * whitespace and dots.
 */
export function sanitizeFilename(name: string): string {
  // Remove forbidden characters: / \ : * ? " < > |
  let sanitized = name.replace(/[/\\:*?"<>|]/g, '');
  // Trim leading/trailing whitespace and dots
  sanitized = sanitized.replace(/^[\s.]+|[\s.]+$/g, '');
  return sanitized;
}

/**
 * Adds the `.pdf` extension unless the name already ends with `.pdf`.
 */
export function ensurePdfExtension(name: string): string {
  if (name.toLowerCase().endsWith('.pdf')) {
    return name;
  }
  return `${name}.pdf`;
}

/**
 * Resolves a template string and returns a sanitized filename with `.pdf`.
 * Empty templates fall back to `${filename}`.
 */
export function resolveOutputFilename(template: string, ctx: FilenameContext): string {
  // Empty template fallback
  const effectiveTemplate = template.trim() === '' ? '${filename}' : template;

  // Resolve variables
  const resolved = resolveVariables(effectiveTemplate, ctx);

  // Sanitize
  let sanitized = sanitizeFilename(resolved);

  // Empty result fallback (after sanitize)
  if (sanitized === '') {
    sanitized = ctx.filename;
  }

  // Ensure .pdf extension
  return ensurePdfExtension(sanitized);
}
