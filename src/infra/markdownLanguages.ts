/**
 * Language IDs whose files are Markdown. Recent VS Code builds open agent
 * customization files with their own language instead of `markdown`:
 * `SKILL.md` → skill, `*.prompt.md` → prompt, `*.instructions.md` →
 * instructions, `*.agent.md` → chatagent. They are still Markdown, so
 * Markdown Studio treats them the same.
 */
export const MARKDOWN_LANGUAGE_IDS: readonly string[] = ['markdown', 'skill', 'prompt', 'instructions', 'chatagent'];

export function isMarkdownLanguage(languageId: string): boolean {
  return MARKDOWN_LANGUAGE_IDS.includes(languageId);
}
