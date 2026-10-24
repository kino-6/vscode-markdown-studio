import { describe, expect, it } from 'vitest';
import { createMarkdownParser } from '../../src/parser/parseMarkdown';
import { isSkillFile, validateSkill, type SkillIssue } from '../../src/skill/skillManifest';

const parser = createMarkdownParser();

function check(markdown: string, filePath = '/skills/pdf-tools/SKILL.md', existing: string[] = []): SkillIssue[] {
  return validateSkill(markdown, { filePath, parser, fileExists: (p) => existing.includes(p) });
}

const ok = (fields = '') => `---\nname: pdf-tools\ndescription: Extract text from PDFs. Use when handling PDF files.\n${fields}---\n\n# PDF tools\n`;

describe('isSkillFile', () => {
  it('matches SKILL.md case-insensitively', () => {
    expect(isSkillFile('/a/b/SKILL.md')).toBe(true);
    expect(isSkillFile('/a/b/skill.md')).toBe(true);
    expect(isSkillFile('/a/b/README.md')).toBe(false);
    expect(isSkillFile('/a/b/my-skill.md')).toBe(false);
  });
});

describe('validateSkill (agentskills.io specification)', () => {
  it('accepts a valid skill', () => {
    expect(check(ok('license: MIT\ncompatibility: Requires git\nmetadata:\n  author: me\n  version: "1.0"\nallowed-tools: Bash(git:*) Read\n'))).toEqual([]);
  });

  it('requires front matter', () => {
    expect(check('# No front matter\n')[0]).toMatchObject({ severity: 'error', line: 0 });
  });

  it('reports invalid YAML with its line', () => {
    const issues = check('---\nname: pdf-tools\ndescription: [unclosed\n---\n');
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ severity: 'error' });
    expect(issues[0].message).toMatch(/Invalid YAML/);
  });

  it('requires name and description', () => {
    const messages = check('---\nlicense: MIT\n---\n').map((i) => i.message);
    expect(messages).toContain('Missing required field "name".');
    expect(messages).toContain('Missing required field "description".');
  });

  it.each([
    ['PDF-Tools', /lowercase/],
    ['-pdf', /hyphen/],
    ['pdf-', /hyphen/],
    ['pdf--tools', /hyphen/],
    ['pdf_tools', /lowercase/],
    ['a'.repeat(65), /at most 64/],
  ])('rejects name %j', (name, pattern) => {
    const issues = check(`---\nname: ${name}\ndescription: Something useful.\n---\n`, `/skills/${name}/SKILL.md`);
    expect(issues.some((i) => i.severity === 'error' && pattern.test(i.message))).toBe(true);
    expect(issues.find((i) => pattern.test(i.message))?.line).toBe(1);
  });

  it('warns when name does not match the folder', () => {
    const issues = check(ok(), '/skills/other-folder/SKILL.md');
    expect(issues).toEqual([expect.objectContaining({ severity: 'warning', line: 1, message: expect.stringContaining('other-folder') })]);
  });

  it('limits description and compatibility length', () => {
    const long = check(`---\nname: pdf-tools\ndescription: ${'x'.repeat(1025)}\ncompatibility: ${'y'.repeat(501)}\n---\n`);
    expect(long.map((i) => i.message)).toEqual([
      expect.stringContaining('"description" must be at most 1024'),
      expect.stringContaining('"compatibility" must be at most 500'),
    ]);
  });

  it('reads folded multi-line descriptions', () => {
    expect(check('---\nname: pdf-tools\ndescription: >\n  Extract text.\n  Use for PDFs.\n---\n')).toEqual([]);
  });

  it('warns about non-string metadata values and list-style allowed-tools', () => {
    const issues = check(ok('metadata:\n  version: 1.0\nallowed-tools:\n  - Read\n'));
    expect(issues.map((i) => [i.severity, i.line])).toEqual([['warning', 3], ['warning', 5]]);
  });

  it('notes bodies over the recommended 500 lines', () => {
    const issues = check(ok() + 'line\n'.repeat(520));
    expect(issues).toEqual([expect.objectContaining({ severity: 'info', message: expect.stringContaining('under 500') })]);
  });

  it('warns about relative references to missing files only', () => {
    const md = ok() + '\nSee [ref](references/REFERENCE.md), [gone](references/missing.md#x), [web](https://example.com) and [top](#pdf-tools).\n\n![diagram](assets/flow.png)\n';
    const issues = check(md, '/skills/pdf-tools/SKILL.md', ['/skills/pdf-tools/references/REFERENCE.md']);
    expect(issues.map((i) => i.message)).toEqual([
      'Referenced file not found: references/missing.md',
      'Referenced file not found: assets/flow.png',
    ]);
    expect(issues[0].line).toBe(7);
  });
});

describe('skill card rendering', () => {
  it('renders name, description and other fields as a card', () => {
    const html = parser.render('---\nname: pdf-tools\ndescription: Extract <text> from PDFs.\nallowed-tools: Bash(git:*) Read\nmetadata:\n  author: me\n---\n\n# Body\n');
    expect(html).toContain('<div class="ms-frontmatter ms-skill-card" data-source-line="0">');
    expect(html).toContain('<div class="ms-skill-name">pdf-tools</div>');
    expect(html).toContain('<p class="ms-skill-description">Extract &lt;text&gt; from PDFs.</p>');
    expect(html).toContain('<code class="ms-skill-tool">Bash(git:*)</code> <code class="ms-skill-tool">Read</code>');
    expect(html).toContain('<dt>metadata</dt><dd>author: me</dd>');
    expect(html).toContain('<details class="ms-frontmatter-raw">');
  });

  it('keeps the plain YAML box for other front matter', () => {
    const html = parser.render('---\ntitle: Notes\n---\n\ntext\n');
    expect(html).toContain('<div class="ms-frontmatter" data-source-line="0"><pre>');
    expect(html).not.toContain('ms-skill-card');
  });

  it('falls back to the YAML box when the YAML is invalid', () => {
    const html = parser.render('---\nname: x\ndescription: [oops\n---\n');
    expect(html).not.toContain('ms-skill-card');
    expect(html).toContain('ms-frontmatter');
  });
});
