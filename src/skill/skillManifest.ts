import * as path from 'node:path';
import yaml from 'js-yaml';
import type MarkdownIt from 'markdown-it';
import { locateFrontMatter } from '../parser/frontMatter';

/**
 * Agent Skills (SKILL.md) support, following https://agentskills.io/specification.
 */

export type SkillIssueSeverity = 'error' | 'warning' | 'info';

export interface SkillIssue {
  severity: SkillIssueSeverity;
  message: string;
  /** 0-based line the issue points at. */
  line: number;
}

export interface ParsedFrontMatter {
  data?: Record<string, unknown>;
  yamlError?: { message: string; line: number };
  contentStartLine: number;
  closeLine: number;
}

const NAME_MAX = 64;
const DESCRIPTION_MAX = 1024;
const COMPATIBILITY_MAX = 500;
const RECOMMENDED_MAX_LINES = 500;
const NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isSkillFile(filePath: string): boolean {
  return path.basename(filePath).toLowerCase() === 'skill.md';
}

export function parseFrontMatter(markdown: string): ParsedFrontMatter | undefined {
  const location = locateFrontMatter(markdown);
  if (!location) return undefined;
  const base = { contentStartLine: location.contentStartLine, closeLine: location.closeLine };
  try {
    const data = yaml.load(location.content, { schema: yaml.JSON_SCHEMA });
    if (data === null || data === undefined) return { ...base, data: {} };
    if (typeof data !== 'object' || Array.isArray(data)) {
      return { ...base, yamlError: { message: 'Front matter must be a YAML mapping (key: value).', line: location.contentStartLine } };
    }
    return { ...base, data: data as Record<string, unknown> };
  } catch (err) {
    const mark = (err as { mark?: { line?: number } }).mark;
    const reason = (err as { reason?: string }).reason ?? (err instanceof Error ? err.message : String(err));
    return { ...base, yamlError: { message: `Invalid YAML: ${reason}`, line: location.contentStartLine + (mark?.line ?? 0) } };
  }
}

/** True when the front matter looks like a skill / agent definition. */
export function isSkillLikeFrontMatter(data: Record<string, unknown> | undefined): boolean {
  return !!data && typeof data.name === 'string' && typeof data.description === 'string';
}

function fieldLine(markdown: string, parsed: ParsedFrontMatter, field: string): number {
  const lines = markdown.split(/\r?\n/);
  const re = new RegExp(`^${field.replace(/[-]/g, '\\-')}\\s*:`);
  for (let i = parsed.contentStartLine; i < parsed.closeLine; i++) {
    if (re.test(lines[i])) return i;
  }
  return 0;
}

export interface ValidateSkillOptions {
  /** Absolute path of the SKILL.md file. */
  filePath: string;
  /** Returns true when the path exists. */
  fileExists: (absolutePath: string) => boolean;
  /** Parser used to find relative links. */
  parser: MarkdownIt;
}

export function validateSkill(markdown: string, options: ValidateSkillOptions): SkillIssue[] {
  const issues: SkillIssue[] = [];
  const parsed = parseFrontMatter(markdown);

  if (!parsed) {
    issues.push({ severity: 'error', line: 0, message: 'SKILL.md must start with YAML front matter (---) containing name and description.' });
    return issues;
  }
  if (parsed.yamlError) {
    issues.push({ severity: 'error', line: parsed.yamlError.line, message: parsed.yamlError.message });
    return issues;
  }

  const data = parsed.data ?? {};
  const at = (field: string) => fieldLine(markdown, parsed, field);

  // name
  if (data.name === undefined) {
    issues.push({ severity: 'error', line: 0, message: 'Missing required field "name".' });
  } else if (typeof data.name !== 'string' || data.name.length === 0) {
    issues.push({ severity: 'error', line: at('name'), message: '"name" must be a non-empty string.' });
  } else {
    const name = data.name;
    if (name.length > NAME_MAX) {
      issues.push({ severity: 'error', line: at('name'), message: `"name" must be at most ${NAME_MAX} characters (currently ${name.length}).` });
    }
    if (!NAME_RE.test(name)) {
      issues.push({
        severity: 'error',
        line: at('name'),
        message: '"name" may only contain lowercase letters, numbers and single hyphens, and must not start or end with a hyphen.',
      });
    }
    const dirName = path.basename(path.dirname(options.filePath));
    if (dirName !== name) {
      issues.push({ severity: 'warning', line: at('name'), message: `"name" should match the skill folder name "${dirName}".` });
    }
  }

  // description
  if (data.description === undefined) {
    issues.push({ severity: 'error', line: 0, message: 'Missing required field "description".' });
  } else if (typeof data.description !== 'string' || data.description.trim().length === 0) {
    issues.push({ severity: 'error', line: at('description'), message: '"description" must be a non-empty string.' });
  } else if (data.description.length > DESCRIPTION_MAX) {
    issues.push({
      severity: 'error',
      line: at('description'),
      message: `"description" must be at most ${DESCRIPTION_MAX} characters (currently ${data.description.length}).`,
    });
  }

  // optional fields
  if (data.compatibility !== undefined) {
    if (typeof data.compatibility !== 'string' || data.compatibility.length === 0) {
      issues.push({ severity: 'error', line: at('compatibility'), message: '"compatibility" must be a non-empty string.' });
    } else if (data.compatibility.length > COMPATIBILITY_MAX) {
      issues.push({
        severity: 'error',
        line: at('compatibility'),
        message: `"compatibility" must be at most ${COMPATIBILITY_MAX} characters (currently ${data.compatibility.length}).`,
      });
    }
  }
  if (data.license !== undefined && typeof data.license !== 'string') {
    issues.push({ severity: 'warning', line: at('license'), message: '"license" should be a string.' });
  }
  if (data.metadata !== undefined) {
    const metadata = data.metadata;
    const isStringMap = typeof metadata === 'object' && metadata !== null && !Array.isArray(metadata)
      && Object.values(metadata).every((value) => typeof value === 'string');
    if (!isStringMap) {
      issues.push({ severity: 'warning', line: at('metadata'), message: '"metadata" should map string keys to string values (quote numbers such as "1.0").' });
    }
  }
  if (data['allowed-tools'] !== undefined && typeof data['allowed-tools'] !== 'string') {
    issues.push({ severity: 'warning', line: at('allowed-tools'), message: '"allowed-tools" should be a space-separated string.' });
  }

  // body length (recommendation)
  const lines = markdown.split(/\r?\n/);
  while (lines.length > 0 && lines[lines.length - 1].trim() === '') lines.pop();
  if (lines.length > RECOMMENDED_MAX_LINES) {
    issues.push({
      severity: 'info',
      line: RECOMMENDED_MAX_LINES,
      message: `SKILL.md has ${lines.length} lines; the spec recommends under ${RECOMMENDED_MAX_LINES}. Consider moving details into referenced files.`,
    });
  }

  // relative file references
  issues.push(...findMissingReferences(markdown, options));
  return issues;
}

function findMissingReferences(markdown: string, options: ValidateSkillOptions): SkillIssue[] {
  const issues: SkillIssue[] = [];
  const baseDir = path.dirname(options.filePath);
  const tokens = options.parser.parse(markdown, {});
  for (const token of tokens) {
    if (token.type !== 'inline' || !token.children) continue;
    const line = token.map?.[0] ?? 0;
    for (const child of token.children) {
      const target = child.type === 'link_open' ? child.attrGet('href')
        : child.type === 'image' ? child.attrGet('src')
          : null;
      if (!target || target.startsWith('#') || /^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith('//')) continue;
      const filePart = safeDecode(target.split('#')[0].split('?')[0]);
      if (!filePart) continue;
      const resolved = path.resolve(baseDir, filePart.startsWith('/') ? `.${filePart}` : filePart);
      if (!options.fileExists(resolved)) {
        issues.push({ severity: 'warning', line, message: `Referenced file not found: ${filePart}` });
      }
    }
  }
  return issues;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
