/** テンプレート変数解決に必要なコンテキスト */
export interface FilenameContext {
  /** ソースファイル名（拡張子なし） */
  filename: string;
  /** ソースファイルの拡張子（ドットなし） */
  ext: string;
  /** ドキュメント内の最初のH1見出しテキスト（存在しない場合はundefined） */
  title?: string;
  /** エクスポート実行時刻（テスト時に注入可能） */
  now?: Date;
}

/**
 * Markdownテキストから最初のH1見出しのプレーンテキストを抽出する。
 * H1が存在しない場合は undefined を返す。
 */
export function extractH1Title(markdown: string): string | undefined {
  const match = /^#\s+(.+)$/m.exec(markdown);
  return match ? match[1].trim() : undefined;
}

/**
 * Date を YYYY-MM-DD 形式のローカル日付文字列に変換する。
 */
function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Date を YYYY-MM-DD_HHmmss 形式のローカル日時文字列に変換する。
 */
function formatDatetime(d: Date): string {
  const date = formatDate(d);
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  return `${date}_${h}${min}${s}`;
}

/**
 * テンプレート内の `${variableName}` パターンを検出し、
 * 定義済み変数は値に置換、未定義変数はそのまま残す。
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
 * ファイルシステムで禁止されている文字の除去、
 * 先頭/末尾の空白・ドットの除去を行う。
 */
export function sanitizeFilename(name: string): string {
  // Remove forbidden characters: / \ : * ? " < > |
  let sanitized = name.replace(/[/\\:*?"<>|]/g, '');
  // Trim leading/trailing whitespace and dots
  sanitized = sanitized.replace(/^[\s.]+|[\s.]+$/g, '');
  return sanitized;
}

/**
 * `.pdf` 拡張子を付与する。既に `.pdf` で終わる場合は付与しない。
 */
export function ensurePdfExtension(name: string): string {
  if (name.toLowerCase().endsWith('.pdf')) {
    return name;
  }
  return `${name}.pdf`;
}

/**
 * テンプレート文字列を解決し、サニタイズ済みのファイル名（.pdf付き）を返す。
 * 空テンプレートの場合は `${filename}` にフォールバックする。
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
