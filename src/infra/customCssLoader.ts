import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { CustomCssResult } from '../types/models';
import { RUNTIME_MESSAGES } from './messages';

/** Maximum CSS file size (1 MB). */
export const MAX_CSS_FILE_SIZE = 1 * 1024 * 1024;

/** Bundled theme names that can be used without a file path. */
export const BUNDLED_THEMES: ReadonlySet<string> = new Set([
  'modern',
  'markdown-pdf',
  'minimal',
]);

/**
 * Removes dangerous content from CSS.
 * - Strips <script> tags
 * - Strips javascript: URLs
 */
export function sanitizeCss(css: string): string {
  // Remove <script>...</script> tags (case-insensitive, dotAll)
  let result = css.replace(/<script[\s>][\s\S]*?<\/script\s*>/gi, '');
  // Remove self-closing or unclosed <script .../> or <script>
  result = result.replace(/<script\b[^>]*\/?>/gi, '');
  // Remove javascript: URLs (case-insensitive)
  result = result.replace(/javascript\s*:/gi, '');
  return result;
}

/**
 * Resolves a bundled theme name to a CSS file path.
 * Returns null for "default" or an empty theme name.
 */
export function resolveThemePath(
  theme: string,
  extensionPath: string
): string | null {
  if (!theme || theme === 'default') {
    return null;
  }
  if (BUNDLED_THEMES.has(theme)) {
    return path.join(extensionPath, 'media', 'themes', `${theme}.css`);
  }
  return null;
}

/**
 * Returns bundled theme CSS plus inline custom CSS.
 * Processing order: read theme file, sanitize, then append inline CSS.
 */
export async function loadCustomCss(
  theme: string,
  customCss: string,
  extensionPath: string
): Promise<CustomCssResult> {
  const warnings: string[] = [];
  const parts: string[] = [];

  // 1. Read bundled theme CSS.
  const themePath = resolveThemePath(theme, extensionPath);
  if (themePath) {
    try {
      const stat = await fs.stat(themePath);
      if (stat.size > MAX_CSS_FILE_SIZE) {
        warnings.push(`Theme CSS file exceeds maximum size of 1MB: ${themePath}`);
      } else {
        const raw = await fs.readFile(themePath, 'utf-8');
        const sanitized = sanitizeCss(raw);
        if (sanitized !== raw) {
          warnings.push('Potentially unsafe content was removed from theme CSS');
        }
        parts.push(sanitized);
      }
    } catch (err: unknown) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') {
        warnings.push(`Theme CSS file not found: ${themePath}`);
      } else {
        warnings.push(`Failed to read theme CSS: ${themePath} (${err instanceof Error ? err.message : String(err)})`);
      }
    }
  }

  // 2. Append inline custom CSS unless syntax validation fails.
  if (customCss.trim()) {
    const syntaxErrors = validateCssSyntax(customCss);
    if (syntaxErrors.length > 0) {
      warnings.push(...syntaxErrors);
      warnings.push(RUNTIME_MESSAGES.customCss.skippedForSyntaxErrors);
    } else {
      const sanitized = sanitizeCss(customCss);
      if (sanitized !== customCss) {
        warnings.push('Potentially unsafe content was removed from custom CSS');
      }
      parts.push(sanitized);
    }
  }

  return { css: parts.join('\n'), warnings };
}

/**
 * Lightweight CSS validation.
 * Checks brace matching and basic syntax errors.
 * Returns warning messages when problems are found, otherwise an empty array.
 */
export function validateCssSyntax(css: string): string[] {
  const errors: string[] = [];
  if (!css.trim()) return errors;

  // Strip string literals and comments to avoid false positives
  const stripped = css
    .replace(/\/\*[\s\S]*?\*\//g, '')   // block comments
    .replace(/"[^"]*"/g, '""')          // double-quoted strings
    .replace(/'[^']*'/g, "''");         // single-quoted strings

  // Check brace balance
  let depth = 0;
  for (let i = 0; i < stripped.length; i++) {
    if (stripped[i] === '{') depth++;
    if (stripped[i] === '}') depth--;
    if (depth < 0) {
      errors.push('CSS syntax error: unexpected "}" — closing brace without matching opening brace');
      return errors;
    }
  }
  if (depth > 0) {
    errors.push(`CSS syntax error: ${depth} unclosed "{" — missing closing brace(s)`);
  }

  return errors;
}
