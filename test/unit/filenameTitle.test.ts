import { describe, expect, it } from 'vitest';
import { extractH1Title } from '../../src/export/filenameResolver';

describe('extractH1Title', () => {
  it('ignores # lines inside fenced code blocks', () => {
    expect(extractH1Title('```bash\n# install deps\nnpm i\n```\n\n# Real Title\n')).toBe('Real Title');
  });

  it('finds setext H1 headings', () => {
    expect(extractH1Title('Real Title\n==========\n')).toBe('Real Title');
  });

  it('ignores front matter and strips inline formatting', () => {
    expect(extractH1Title('---\nname: x\n---\n\n# The **Bold** `Title`\n')).toBe('The Bold Title');
  });

  it('returns undefined without an H1', () => {
    expect(extractH1Title('## Only H2\n\ntext\n')).toBeUndefined();
  });
});
