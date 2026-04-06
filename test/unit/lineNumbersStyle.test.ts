import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { buildStyleBlock } from '../../src/preview/buildHtml';
import { ResolvedStyleConfig } from '../../src/types/models';

/** Minimal ResolvedStyleConfig fixture for buildStyleBlock */
function makeStyleConfig(): ResolvedStyleConfig {
  return {
    fontFamily: 'sans-serif',
    fontSize: 14,
    lineHeight: 1.6,
    margin: '20mm',
    codeFontFamily: 'monospace',
    presetName: 'markdown-pdf',
    headingStyle: {
      h1FontWeight: 700,
      h1MarginTop: '24px',
      h1MarginBottom: '16px',
      h2MarginTop: '24px',
      h2MarginBottom: '16px',
    },
    codeBlockStyle: {
      background: '#f6f8fa',
      border: '1px solid #d0d7de',
      borderRadius: '6px',
      padding: '1em',
    },
  };
}

describe('lineNumbersStyle', () => {
  // Requirement 4.4: buildStyleBlock output includes @media print line number styles
  it('buildStyleBlock includes @media print styles for .ms-line-number (Req 4.4)', () => {
    const output = buildStyleBlock(makeStyleConfig());

    expect(output).toContain('@media print');
    expect(output).toContain('.ms-line-number');
    // Verify print-specific line number properties
    expect(output).toContain('user-select: none');
    expect(output).toContain('border-right');
  });

  // Requirement 3.2: preview.css contains user-select: none for line numbers
  it('preview.css contains user-select: none on .ms-line-number (Req 3.2)', () => {
    const cssPath = path.resolve(__dirname, '../../media/preview.css');
    const css = fs.readFileSync(cssPath, 'utf-8');

    // Verify .ms-line-number rule includes user-select: none
    expect(css).toContain('.ms-line-number');
    expect(css).toContain('user-select: none');
  });

  // Requirement 5.3: dark theme CSS classes exist for line numbers
  it('preview.css contains dark theme styles for .ms-line-number (Req 5.3)', () => {
    const cssPath = path.resolve(__dirname, '../../media/preview.css');
    const css = fs.readFileSync(cssPath, 'utf-8');

    expect(css).toContain('body.vscode-dark .ms-line-number');
    expect(css).toContain('body.vscode-high-contrast .ms-line-number');
  });

  // Requirement 7.1: package.json defines markdownStudio.codeBlock.lineNumbers setting
  it('package.json defines markdownStudio.codeBlock.lineNumbers configuration (Req 7.1)', () => {
    const pkgPath = path.resolve(__dirname, '../../package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));

    const props = pkg.contributes?.configuration?.properties;
    expect(props).toBeDefined();

    const lineNumbersSetting = props['markdownStudio.codeBlock.lineNumbers'];
    expect(lineNumbersSetting).toBeDefined();
    expect(lineNumbersSetting.type).toBe('boolean');
    expect(lineNumbersSetting.default).toBe(true);
  });
});
