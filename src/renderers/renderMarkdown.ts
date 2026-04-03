import sanitizeHtml from 'sanitize-html';
import * as vscode from 'vscode';
import { getConfig } from '../infra/config';
import { createMarkdownParser } from '../parser/parseMarkdown';
import { sanitizeSvg } from '../parser/sanitizeSvg';
import { scanFencedBlocks } from '../parser/scanFencedBlocks';
import { RenderedMarkdown } from '../types/models';
import { renderMermaidPlaceholder } from './renderMermaid';
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
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
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
      'title',
      'desc',
      'span',
      'div'
    ]),
    allowedAttributes: {
      '*': ['class', 'id', 'style', 'title'],
      a: ['href', 'name', 'target', 'rel'],
      img: ['src', 'alt', 'title'],
      svg: ['viewBox', 'xmlns', 'width', 'height'],
      path: ['d', 'fill', 'stroke', 'stroke-width'],
      div: ['data-mermaid-src', 'class'],
      span: ['class', 'title']
    },
    allowedSchemes: ['data', 'file', 'vscode-resource'],
    transformTags: {
      script: () => ({ tagName: 'noscript', text: '' }),
      iframe: () => ({ tagName: 'div', text: '' }),
      object: () => ({ tagName: 'div', text: '' }),
      embed: () => ({ tagName: 'div', text: '' })
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
      replacement = renderMermaidPlaceholder(block.content);
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
