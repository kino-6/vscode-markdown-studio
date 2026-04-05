import * as vscode from 'vscode';
import { getConfig } from '../infra/config';
import { createMarkdownParser } from '../parser/parseMarkdown';
import { scanFencedBlocks } from '../parser/scanFencedBlocks';
import { RenderedMarkdown } from '../types/models';
import { renderMermaidBlock } from './renderMermaid';
import { renderPlantUml } from './renderPlantUml';

const parser = createMarkdownParser();

function padToLineCount(replacement: string, sourceFence: string): string {
  const sourceNewlines = (sourceFence.match(/\n/g) || []).length;
  const replacementNewlines = (replacement.match(/\n/g) || []).length;
  const diff = sourceNewlines - replacementNewlines;
  if (diff > 0) {
    return replacement + '\n'.repeat(diff);
  }
  return replacement;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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
      // SVG is user-authored local content — pass through directly
      replacement = block.content;
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

    replacement = padToLineCount(replacement, sourceFence);
    transformed = transformed.replace(sourceFence, replacement);
  }

  // No HTML sanitization — all content is local/user-authored.
  // CSP + webview sandbox provide the security boundary.
  let htmlBody = parser.render(transformed);

  if (getConfig().blockExternalLinks) {
    htmlBody = htmlBody.replace(/<a\s+([^>]*href="https?:\/\/[^"]+?"[^>]*)>/g, '<span class="ms-link-blocked" title="External link blocked">');
    htmlBody = htmlBody.replace(/<\/a>/g, '</span>');
    htmlBody = htmlBody.replace(/<img\s+([^>]*src="https?:\/\/[^"]+?"[^>]*)>/g, '<div class="ms-error">External image blocked by policy.</div>');
  }

  return { htmlBody, errors };
}
