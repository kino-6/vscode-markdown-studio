import MarkdownIt from 'markdown-it';
import * as vscode from 'vscode';
import { getConfig } from '../infra/config';
import { createMarkdownParser } from '../parser/parseMarkdown';
import { scanFencedBlocks } from '../parser/scanFencedBlocks';
import { extractHeadings } from '../toc/extractHeadings';
import { resolveAnchors } from '../toc/anchorResolver';
import { buildTocHtml } from '../toc/buildToc';
import { findTocCommentMarkers } from '../toc/tocCommentMarker';
import { replaceTocMarker } from '../toc/tocMarker';
import { AnchorMapping, RenderedMarkdown } from '../types/models';
import { renderMermaidBlock } from './renderMermaid';
import { renderPlantUml } from './renderPlantUml';
import { filterExternalResources } from './resourceFilter';

/**
 * Install a markdown-it renderer rule that adds `id` attributes to heading tags
 * based on the resolved anchor mappings. Returns a cleanup function to restore
 * the original rule.
 */
function installHeadingIdRule(parser: MarkdownIt, anchors: AnchorMapping[]): () => void {
  const original = parser.renderer.rules['heading_open'];
  let headingIndex = 0;

  // Build a map from heading line number to anchor ID for reliable matching
  const lineToAnchorId = new Map<number, string>();
  for (const { heading, anchorId } of anchors) {
    lineToAnchorId.set(heading.line, anchorId);
  }

  parser.renderer.rules['heading_open'] = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    const line = token.map ? token.map[0] : -1;

    // Try to match by source line first, fall back to sequential index
    const anchorId = lineToAnchorId.get(line) ?? anchors[headingIndex]?.anchorId;
    if (anchorId !== undefined) {
      token.attrSet('id', anchorId);
      headingIndex++;
    }

    if (original) {
      return original(tokens, idx, options, env, self);
    }
    return self.renderToken(tokens, idx, options);
  };

  return () => {
    if (original) {
      parser.renderer.rules['heading_open'] = original;
    } else {
      delete parser.renderer.rules['heading_open'];
    }
  };
}

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
  const config = getConfig();
  const parser = createMarkdownParser({ lineNumbers: config.codeBlock.lineNumbers });

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

  // --- TOC generation pipeline ---
  // 1. Extract headings from the original markdown (before diagram transforms)
  const headings = extractHeadings(markdown, parser);
  // 2. Resolve unique anchor IDs
  const anchors = resolveAnchors(headings);
  // 3. Install heading ID renderer rule so rendered headings get id attributes
  const removeHeadingIdRule = installHeadingIdRule(parser, anchors);

  // No HTML sanitization — all content is local/user-authored.
  // CSP + webview sandbox provide the security boundary.
  let htmlBody: string;
  try {
    htmlBody = parser.render(transformed);
  } finally {
    removeHeadingIdRule();
  }

  // 4. Build TOC HTML and replace markers
  const tocHtml = buildTocHtml(anchors, config.toc);
  htmlBody = replaceTocMarker(htmlBody, tocHtml);

  htmlBody = filterExternalResources(htmlBody, config.externalResources);

  // --- Wrap comment marker ToC in rendered HTML ---
  // `<!-- TOC -->` / `<!-- /TOC -->` markers are preserved as HTML comments by markdown-it.
  // We wrap the content between them in a `<div class="ms-toc-comment">` so PDF export
  // can hide it via CSS when pdfToc.hidden is true.
  const fencedRanges = fencedBlocks.map((b) => ({ startLine: b.startLine, endLine: b.endLine }));
  const commentMarkers = findTocCommentMarkers(markdown, fencedRanges);
  if (commentMarkers) {
    htmlBody = htmlBody
      .replace(/<!--\s*TOC\s*-->/, '<div class="ms-toc-comment">')
      .replace(/<!--\s*\/TOC\s*-->/, '</div>');
  }

  return { htmlBody, errors };
}
