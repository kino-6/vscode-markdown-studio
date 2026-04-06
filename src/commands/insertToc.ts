import * as vscode from 'vscode';
import { extractHeadings } from '../toc/extractHeadings';
import { resolveAnchors } from '../toc/anchorResolver';
import { buildTocMarkdown } from '../toc/buildTocMarkdown';
import { findTocCommentMarkers, replaceTocContent, wrapWithMarkers } from '../toc/tocCommentMarker';
import { scanFencedBlocks } from '../parser/scanFencedBlocks';
import { createMarkdownParser } from '../parser/parseMarkdown';
import { getConfig } from '../infra/config';

/**
 * Insert TOC command handler.
 *
 * 1. If active editor is not a Markdown file, return silently
 * 2. Extract headings from the document
 * 3. Build TOC Markdown text
 * 4. If existing TOC markers found, replace content between markers
 * 5. If no markers, insert wrapped TOC at cursor position
 * 6. If no headings, insert empty TOC section (markers only)
 */
export async function insertTocCommand(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== 'markdown') {
    return;
  }

  const document = editor.document;
  const markdown = document.getText();
  const tocConfig = getConfig().toc;

  const md = createMarkdownParser();
  const headings = extractHeadings(markdown, md);
  const anchors = resolveAnchors(headings);
  const tocText = buildTocMarkdown(anchors, tocConfig);

  const fencedBlocks = scanFencedBlocks(markdown);
  const fencedRanges = fencedBlocks.map((b) => ({
    startLine: b.startLine,
    endLine: b.endLine,
  }));
  const existingMarkers = findTocCommentMarkers(markdown, fencedRanges);

  if (existingMarkers) {
    // Replace existing TOC content between markers
    const newDoc = replaceTocContent(markdown, existingMarkers, tocText);
    const fullRange = new vscode.Range(
      document.positionAt(0),
      document.positionAt(markdown.length),
    );
    await editor.edit((editBuilder) => {
      editBuilder.replace(fullRange, newDoc);
    });
  } else {
    // Insert new TOC at cursor position
    const wrapped = wrapWithMarkers(tocText);
    const position = editor.selection.active;
    await editor.edit((editBuilder) => {
      editBuilder.insert(position, wrapped + '\n');
    });
  }
}
