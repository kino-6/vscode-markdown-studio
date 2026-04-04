import { describe, expect, it } from 'vitest';
import sanitizeHtml from 'sanitize-html';

// Simulate the PlantUML SVG that Java generates
const PLANTUML_SVG = `<svg xmlns="http://www.w3.org/2000/svg" contentStyleType="text/css" height="150px" preserveAspectRatio="none" style="width:110px;height:150px;background:#FFFFFF;" version="1.1" viewBox="0 0 110 150" width="110px"><defs/><g><line style="stroke:#181818;stroke-width:0.5;stroke-dasharray:5.0,5.0;" x1="28" x2="28" y1="36.4883" y2="115.1094"/><rect fill="#E2E2F0" height="30.4883" rx="2.5" ry="2.5" style="stroke:#181818;stroke-width:0.5;" width="46.7236" x="5" y="5"/><text fill="#000000" font-family="sans-serif" font-size="14" lengthAdjust="spacing" textLength="32.7236" x="12" y="25.5352">Alice</text><polygon fill="#181818" points="72.6587,63.7988,82.6587,67.7988,72.6587,71.7988,76.6587,67.7988" style="stroke:#181818;stroke-width:1;"/><line style="stroke:#181818;stroke-width:1;" x1="28.3618" x2="78.6587" y1="67.7988" y2="67.7988"/><text fill="#000000" font-family="sans-serif" font-size="13" lengthAdjust="spacing" textLength="32.2969" x="35.3618" y="63.0566">Hello</text></g></svg>`;

// Replicate the sanitizeHtmlOutput config from renderMarkdown.ts
function sanitizeHtmlOutput(html: string): string {
  return sanitizeHtml(html, {
    allowVulnerableTags: true,
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
      'img', 'svg', 'g', 'path', 'circle', 'ellipse', 'rect', 'line',
      'polyline', 'polygon', 'text', 'tspan', 'defs', 'marker', 'style',
      'symbol', 'use', 'image', 'title', 'desc', 'span', 'div'
    ]),
    allowedAttributes: {
      '*': ['class', 'id', 'style', 'title',
        'fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-linecap', 'stroke-linejoin',
        'fill-opacity', 'stroke-opacity', 'opacity',
        'font-family', 'font-size', 'font-weight', 'font-style',
        'text-anchor', 'dominant-baseline', 'alignment-baseline',
        'lengthAdjust', 'textLength',
        'transform', 'clip-path', 'clip-rule', 'fill-rule',
        'display', 'visibility', 'overflow',
        'x', 'y', 'x1', 'x2', 'y1', 'y2', 'dx', 'dy',
        'cx', 'cy', 'r', 'rx', 'ry',
        'width', 'height', 'd', 'points',
        'viewBox', 'xmlns', 'xmlns:xlink', 'xlink:href', 'href',
        'preserveAspectRatio', 'version', 'contentStyleType',
        'marker-end', 'marker-start', 'marker-mid',
        'color', 'letter-spacing', 'word-spacing'],
      a: ['href', 'name', 'target', 'rel'],
      img: ['src', 'alt', 'title'],
      div: ['data-mermaid-src', 'class']
    },
    allowedStyles: {
      '*': {
        'stroke': [/.*/],
        'stroke-width': [/.*/],
        'stroke-dasharray': [/.*/],
        'fill': [/.*/],
        'font-family': [/.*/],
        'font-size': [/.*/],
        'font-weight': [/.*/],
        'font-style': [/.*/],
        'text-anchor': [/.*/],
        'width': [/.*/],
        'height': [/.*/],
        'background': [/.*/],
        'color': [/.*/],
        'opacity': [/.*/],
        'display': [/.*/],
        'visibility': [/.*/],
      }
    },
    allowedSchemes: ['data', 'file', 'vscode-resource', 'http', 'https'],
    parser: { lowerCaseAttributeNames: false },
    transformTags: {
      script: () => ({ tagName: 'noscript', attribs: {}, text: '' }),
      iframe: () => ({ tagName: 'div', attribs: {}, text: '' }),
      object: () => ({ tagName: 'div', attribs: {}, text: '' }),
      embed: () => ({ tagName: 'div', attribs: {}, text: '' })
    }
  });
}

describe('PlantUML SVG survives sanitizeHtmlOutput', () => {
  it('preserves fill attributes on rect and polygon', () => {
    const result = sanitizeHtmlOutput(PLANTUML_SVG);
    expect(result).toContain('fill="#E2E2F0"');
    expect(result).toContain('fill="#181818"');
  });

  it('preserves style attributes with stroke info', () => {
    const result = sanitizeHtmlOutput(PLANTUML_SVG);
    expect(result).toContain('stroke:#181818');
    expect(result).toContain('stroke-width:');
  });

  it('preserves font attributes on text elements', () => {
    const result = sanitizeHtmlOutput(PLANTUML_SVG);
    expect(result).toContain('font-family="sans-serif"');
    expect(result).toContain('font-size="14"');
  });

  it('preserves text content', () => {
    const result = sanitizeHtmlOutput(PLANTUML_SVG);
    expect(result).toContain('>Alice</text>');
    expect(result).toContain('>Hello</text>');
  });

  it('preserves rx/ry on rect', () => {
    const result = sanitizeHtmlOutput(PLANTUML_SVG);
    expect(result).toContain('rx="2.5"');
    expect(result).toContain('ry="2.5"');
  });

  it('preserves points on polygon', () => {
    const result = sanitizeHtmlOutput(PLANTUML_SVG);
    expect(result).toContain('points="72.6587');
  });

  it('preserves coordinate attributes on line', () => {
    const result = sanitizeHtmlOutput(PLANTUML_SVG);
    expect(result).toContain('x1="28"');
    expect(result).toContain('y1="36.4883"');
  });

  it('preserves viewBox on svg', () => {
    const result = sanitizeHtmlOutput(PLANTUML_SVG);
    expect(result).toContain('viewBox="0 0 110 150"');
  });

  it('preserves background style on svg', () => {
    const result = sanitizeHtmlOutput(PLANTUML_SVG);
    expect(result).toContain('background:#FFFFFF');
  });
});
