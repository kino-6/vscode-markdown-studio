import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { CustomCssResult } from '../types/models';

/** CSSファイルの最大サイズ（1MB） */
export const MAX_CSS_FILE_SIZE = 1 * 1024 * 1024;

/** Bundled theme names that can be used without a file path. */
export const BUNDLED_THEMES: ReadonlySet<string> = new Set([
  'modern',
  'markdown-pdf',
  'minimal',
]);

/**
 * CSSコンテンツから危険な記述を除去する。
 * - <script> タグを除去
 * - javascript: URLを除去
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
 * テーマ名からCSSファイルパスを解決する。
 * "default" または空文字列の場合はnullを返す。
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
 * テーマCSS + インラインカスタムCSSを結合して返す。
 * テーマファイル読み取り → サニタイズ → インラインCSS追記の順。
 */
export async function loadCustomCss(
  theme: string,
  customCss: string,
  extensionPath: string
): Promise<CustomCssResult> {
  const warnings: string[] = [];
  const parts: string[] = [];

  // 1. テーマファイル読み取り
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

  // 2. インラインカスタムCSS追記
  if (customCss.trim()) {
    const sanitized = sanitizeCss(customCss);
    if (sanitized !== customCss) {
      warnings.push('Potentially unsafe content was removed from custom CSS');
    }
    parts.push(sanitized);
  }

  return { css: parts.join('\n'), warnings };
}
