import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

/* ── Requirement 10: Example CSS stays in sync with theme CSS ── */

const themeCssPath = path.resolve(__dirname, '../../media/themes/markdown-pdf.css');
const exampleCssPath = path.resolve(__dirname, '../../examples/custom-styles/markdown-pdf.css');

const themeCss = fs.readFileSync(themeCssPath, 'utf-8');
const exampleCss = fs.readFileSync(exampleCssPath, 'utf-8');

describe('Requirement 10: Example CSS file is in sync with theme CSS', () => {
  it('examples/custom-styles/markdown-pdf.css has identical content to media/themes/markdown-pdf.css', () => {
    expect(exampleCss).toBe(themeCss);
  });
});
