import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const cssPath = path.resolve(__dirname, '../../media/preview.css');
const css = fs.readFileSync(cssPath, 'utf-8');

function extractDiagramPrintSection(cssText: string): string {
  const start = cssText.indexOf('/* ── Diagram print rules');
  return start >= 0 ? cssText.slice(start) : '';
}

function extractRuleBody(cssText: string, selector: string): string | null {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`).exec(cssText);
  return match?.[1] ?? null;
}

describe('diagram print CSS', () => {
  it('overrides inline SVG heights so wide diagrams keep their aspect ratio in PDF output', () => {
    const printSection = extractDiagramPrintSection(css);
    const body = extractRuleBody(printSection, '.diagram-container svg');

    expect(printSection).toContain('@media print');
    expect(body).not.toBeNull();
    expect(body).toMatch(/max-width:\s*100%\s*!important/);
    expect(body).toMatch(/height:\s*auto\s*!important/);
  });
});
