import { PDFDocument, PDFDict, PDFName, PDFString, PDFNumber, type PDFRef, type PDFPage } from 'pdf-lib';
import fs from 'node:fs/promises';
import type { BookmarkEntry } from '../types/models';

/** ブックマークツリーのノード */
export interface BookmarkNode {
  title: string;
  pageIndex: number;   // 0-based ページインデックス
  level: number;       // 見出しレベル (1-6)
  children: BookmarkNode[];
}

/**
 * フラットな見出しエントリ配列からブックマークツリーを構築する。
 * 見出しレベルの階層関係に基づき、親子関係を決定する。
 */
export function buildBookmarkTree(
  entries: BookmarkEntry[],
  minLevel: number,
  maxLevel: number,
): BookmarkNode[] {
  const filtered = entries.filter(e => e.level >= minLevel && e.level <= maxLevel);
  if (filtered.length === 0) return [];

  const roots: BookmarkNode[] = [];
  const stack: BookmarkNode[] = [];

  for (const entry of filtered) {
    const node: BookmarkNode = {
      title: entry.text,
      pageIndex: entry.pageNumber - 1,
      level: entry.level,
      children: [],
    };

    // Pop nodes from stack that are at the same or deeper level
    while (stack.length > 0 && stack[stack.length - 1].level >= entry.level) {
      stack.pop();
    }

    if (stack.length === 0) {
      roots.push(node);
    } else {
      stack[stack.length - 1].children.push(node);
    }

    stack.push(node);
  }

  return roots;
}

/** 再帰的にノード数をカウントする */
function countNodes(nodes: BookmarkNode[]): number {
  let count = 0;
  for (const n of nodes) {
    count += 1 + countNodes(n.children);
  }
  return count;
}

/**
 * ブックマークノード配列からPDFアウトラインアイテムを再帰的に作成し、
 * 兄弟間の /Next, /Prev リンクを設定する。
 * 返り値は [firstRef, lastRef] のタプル。
 */
function createOutlineItems(
  pdfDoc: PDFDocument,
  nodes: BookmarkNode[],
  parentRef: PDFRef,
  pages: PDFPage[],
): [PDFRef, PDFRef] {
  const refs: PDFRef[] = [];
  const dicts: PDFDict[] = [];

  for (const node of nodes) {
    const dict = pdfDoc.context.obj({});
    const ref = pdfDoc.context.register(dict);
    refs.push(ref);
    dicts.push(dict);

    // Clamp pageIndex to valid range
    const clampedIndex = Math.max(0, Math.min(node.pageIndex, pages.length - 1));
    const pageRef = pages[clampedIndex].ref;

    dict.set(PDFName.of('Title'), PDFString.of(node.title));
    dict.set(PDFName.of('Parent'), parentRef);
    dict.set(PDFName.of('Dest'), pdfDoc.context.obj([pageRef, PDFName.of('Fit')]));

    // Recursively create children
    if (node.children.length > 0) {
      const [firstChild, lastChild] = createOutlineItems(pdfDoc, node.children, ref, pages);
      dict.set(PDFName.of('First'), firstChild);
      dict.set(PDFName.of('Last'), lastChild);
      dict.set(PDFName.of('Count'), PDFNumber.of(countNodes(node.children)));
    }
  }

  // Set /Next and /Prev sibling links
  for (let i = 0; i < refs.length; i++) {
    if (i > 0) {
      dicts[i].set(PDFName.of('Prev'), refs[i - 1]);
    }
    if (i < refs.length - 1) {
      dicts[i].set(PDFName.of('Next'), refs[i + 1]);
    }
  }

  return [refs[0], refs[refs.length - 1]];
}

/**
 * 生成済みPDFファイルにブックマークアウトラインを埋め込む。
 * pdf-lib を使用してPDFのOutlineディクショナリを構築し、ファイルを上書き保存する。
 */
export async function addBookmarks(
  pdfPath: string,
  entries: BookmarkEntry[],
  minLevel: number,
  maxLevel: number,
): Promise<void> {
  if (entries.length === 0) {
    console.log('[Markdown Studio] addBookmarks: no entries, skipping');
    return;
  }

  const tree = buildBookmarkTree(entries, minLevel, maxLevel);
  if (tree.length === 0) {
    console.log('[Markdown Studio] addBookmarks: tree is empty after filtering (minLevel=%d, maxLevel=%d, entries=%d)', minLevel, maxLevel, entries.length);
    return;
  }

  console.log('[Markdown Studio] addBookmarks: adding %d bookmark nodes to %s', countNodes(tree), pdfPath);

  const pdfBytes = await fs.readFile(pdfPath);
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const pages = pdfDoc.getPages();

  if (pages.length === 0) {
    console.warn('[Markdown Studio] addBookmarks: PDF has no pages, skipping');
    return;
  }

  // Create /Outlines root dictionary
  const outlinesDict = pdfDoc.context.obj({});
  const outlinesRef = pdfDoc.context.register(outlinesDict);

  outlinesDict.set(PDFName.of('Type'), PDFName.of('Outlines'));

  const [firstRef, lastRef] = createOutlineItems(pdfDoc, tree, outlinesRef, pages);
  outlinesDict.set(PDFName.of('First'), firstRef);
  outlinesDict.set(PDFName.of('Last'), lastRef);
  outlinesDict.set(PDFName.of('Count'), PDFNumber.of(countNodes(tree)));

  // Set catalog /Outlines and /PageMode
  const catalog = pdfDoc.catalog;
  catalog.set(PDFName.of('Outlines'), outlinesRef);
  catalog.set(PDFName.of('PageMode'), PDFName.of('UseOutlines'));

  const modifiedBytes = await pdfDoc.save();
  await fs.writeFile(pdfPath, modifiedBytes);
  console.log('[Markdown Studio] addBookmarks: successfully wrote bookmarks to %s', pdfPath);
}
