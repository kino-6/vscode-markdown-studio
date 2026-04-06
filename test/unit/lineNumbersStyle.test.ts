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
  // buildStyleBlock @media print uses .ms-line-numbers pre
  it('buildStyleBlock includes @media print styles for .ms-line-numbers pre', () => {
    const output = buildStyleBlock(makeStyleConfig());

    expect(output).toContain('@media print');
    expect(output).toContain('.ms-line-numbers pre');
    expect(output).toContain('border-right');
  });

  // preview.css contains user-select: none for .ms-line-numbers
  it('preview.css contains user-select: none on .ms-line-numbers', () => {
    const cssPath = path.resolve(__dirname, '../../media/preview.css');
    const css = fs.readFileSync(cssPath, 'utf-8');

    expect(css).toContain('.ms-line-numbers');
    expect(css).toContain('user-select: none');
  });

  // dark theme CSS classes exist for .ms-line-numbers
  it('preview.css contains dark theme styles for .ms-line-numbers', () => {
    const cssPath = path.resolve(__dirname, '../../media/preview.css');
    const css = fs.readFileSync(cssPath, 'utf-8');

    expect(css).toContain('body.vscode-dark .ms-line-numbers');
    expect(css).toContain('body.vscode-high-contrast .ms-line-numbers');
  });

  // package.json defines markdownStudio.codeBlock.lineNumbers setting
  it('package.json defines markdownStudio.codeBlock.lineNumbers configuration', () => {
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
