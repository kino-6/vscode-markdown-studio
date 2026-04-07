import { describe, it, expect } from 'vitest';
import { createMarkdownParser } from '../../src/parser/parseMarkdown';

describe('Task lists (checkboxes)', () => {
  const md = createMarkdownParser();

  it('renders unchecked task list item', () => {
    const html = md.render('- [ ] unchecked item');
    expect(html).toContain('type="checkbox"');
    expect(html).not.toMatch(/checked=""/);
    expect(html).toContain('unchecked item');
  });

  it('renders checked task list item', () => {
    const html = md.render('- [x] checked item');
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('checked');
    expect(html).toContain('checked item');
  });

  it('renders mixed task list', () => {
    const html = md.render('- [x] done\n- [ ] todo\n- [x] also done');
    const checkboxes = html.match(/type="checkbox"/g);
    expect(checkboxes).toHaveLength(3);
    const checked = html.match(/checked/g);
    expect(checked!.length).toBeGreaterThanOrEqual(2);
  });

  it('renders regular list items without checkboxes', () => {
    const html = md.render('- regular item\n- another item');
    expect(html).not.toContain('type="checkbox"');
  });

  it('checkboxes are disabled (not interactive)', () => {
    const html = md.render('- [ ] item');
    expect(html).toContain('disabled');
  });
});
