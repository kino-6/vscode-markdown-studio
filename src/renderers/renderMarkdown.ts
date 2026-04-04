import sanitizeHtml from 'sanitize-html';
import * as vscode from 'vscode';
import { getConfig } from '../infra/config';
import { createMarkdownParser } from '../parser/parseMarkdown';
import { sanitizeSvg } from '../parser/sanitizeSvg';
import { scanFencedBlocks } from '../parser/scanFencedBlocks';
import { RenderedMarkdown } from '../types/models';
import { renderMermaidBlock } from './renderMermaid';
import { renderPlantUml } from './renderPlantUml';

const parser = createMarkdownParser();

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeHtmlOutput(html: string): string {
  return sanitizeHtml(html, {
    allowVulnerableTags: true,
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
      'img',
      'svg',
      'g',
      'path',
      'circle',
      'ellipse',
      'rect',
      'line',
      'polyline',
      'polygon',
      'text',
      'tspan',
      'defs',
      'marker',
      'style',
      'symbol',
      'use',
      'image',
      'title',
      'desc',
      'span',
      'div'
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

export async function renderMarkdownDocument(
  markdown: string,
  context: vscode.ExtensionContext
): Promise<RenderedMarkdown> {
  const errors: RenderedMarkdown['errors'] = [];
  const fencedBlocks = scanFencedBlocks(markdown);

  let transformed = markdown;
  for (const block of fencedBlocks) {
    const sourceFence = `\`\`\`${block.kind}\n${block.content}\n\`\`\``;
    let replacement = sourceFence;

    if (block.kind === 'mermaid') {
      const result = await renderMermaidBlock(block.content);
      if (result.ok && result.placeholder) {
        replacement = result.placeholder;
      } else {
        errors.push({
          title: 'Mermaid render error',
          detail: result.error ?? 'Unknown Mermaid rendering issue.'
        });
        replacement = `<div class="ms-error"><div class="ms-error-title">Mermaid render error</div><pre>${escapeHtml(result.error ?? 'Unknown error')}</pre></div>`;
      }
    }

    if (block.kind === 'svg') {
      replacement = sanitizeSvg(block.content);
    }

    if (block.kind === 'plantuml' || block.kind === 'puml') {
      const result = await renderPlantUml(block.content, context);
      if (result.ok && result.svg) {
        replacement = result.svg;
      } else {
        errors.push({
          title: 'PlantUML render error',
          detail: result.error ?? 'Unknown PlantUML rendering issue.'
        });
        replacement = `<div class="ms-error"><div class="ms-error-title">PlantUML render error</div><pre>${escapeHtml(result.error ?? 'Unknown error')}</pre></div>`;
      }
    }

    transformed = transformed.replace(sourceFence, replacement);
  }

  let htmlBody = sanitizeHtmlOutput(parser.render(transformed));
  if (getConfig().blockExternalLinks) {
    htmlBody = htmlBody.replace(/<a\s+([^>]*href=\"https?:\/\/[^\"]+\"[^>]*)>/g, '<span class="ms-link-blocked" title="External link blocked">');
    htmlBody = htmlBody.replace(/<\/a>/g, '</span>');
    htmlBody = htmlBody.replace(/<img\s+([^>]*src=\"https?:\/\/[^\"]+\"[^>]*)>/g, '<div class="ms-error">External image blocked by policy.</div>');
  }

  return { htmlBody, errors };
}
