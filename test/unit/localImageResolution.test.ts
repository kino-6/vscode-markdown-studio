/**
 * Bug condition exploration test for local image resolution.
 *
 * Verifies that buildHtml output contains unconverted relative img src paths.
 * On unfixed code, this test is EXPECTED TO FAIL — confirming the bug exists.
 *
 * **Validates: Requirements 1.1, 2.1, 2.3, 2.4**
 */
import { describe, it, expect, vi } from 'vitest';
import fc from 'fast-check';

// Mock vscode with Uri.joinPath and webview support
vi.mock('vscode', () => {
  const Uri = {
    joinPath: (...args: any[]) => {
      const base = typeof args[0] === 'string' ? args[0] : (args[0]?.fsPath ?? args[0]?.toString?.() ?? '');
      const segments = args.slice(1);
      const joined = [base, ...segments].join('/').replace(/\/+/g, '/');
      return {
        fsPath: joined,
        toString: () => `file://${joined}`,
        scheme: 'file',
      };
    },
    file: (path: string) => ({
      fsPath: path,
      toString: () => `file://${path}`,
      scheme: 'file',
    }),
  };

  return {
    workspace: {
      getConfiguration: vi.fn(() => ({
        get: (_key: string, fallback: unknown) => fallback,
        inspect: (_key: string) => undefined,
      })),
    },
    Uri,
  };
});

// Mock config
vi.mock('../../src/infra/config', () => ({
  getConfig: () => ({
    plantUmlMode: 'bundled-jar',
    javaPath: 'java',
    pageFormat: 'A4',
    externalResources: { mode: 'allow-all', allowedDomains: [] },
    pdfHeaderFooter: {
      headerEnabled: false,
      headerTemplate: null,
      footerEnabled: false,
      footerTemplate: null,
      pageBreakEnabled: false,
    },
    sourceJumpEnabled: false,
    style: {
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
      fontSize: 14,
      lineHeight: 1.6,
      margin: '20mm',
      codeFontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
      headingStyle: { h1FontWeight: 600, h1MarginTop: '24px', h1MarginBottom: '16px', h2MarginTop: '24px', h2MarginBottom: '16px' },
      codeBlockStyle: { background: '#f6f8fa', border: '1px solid #d0d7de', borderRadius: '6px', padding: '1em' },
      presetName: 'markdown-pdf',
    },
    toc: { minLevel: 1, maxLevel: 3, orderedList: false, pageBreak: true },
    codeBlock: { lineNumbers: false },
  }),
}));

// Mock PlantUML
vi.mock('../../src/renderers/renderPlantUml', () => ({
  renderPlantUml: vi.fn().mockResolvedValue({ ok: true, svg: '<svg><text>Mock</text></svg>' }),
}));

import { buildHtml } from '../../src/preview/buildHtml';
import * as vscode from 'vscode';

describe('Property 1: Bug Condition — relative image paths remain unconverted', () => {
  const fakeContext = { extensionPath: '/tmp/ext', extensionUri: {} } as any;
  const fakeWebview = {
    cspSource: 'https://test.vscode-resource.vscode-cdn.net',
    asWebviewUri: (uri: any) => ({
      toString: () => `vscode-resource://${uri.fsPath ?? uri.toString()}`,
    }),
  } as any;
  const fakeAssets = {
    styleUri: { toString: () => 'style.css' },
    scriptUri: { toString: () => 'script.js' },
    hljsStyleUri: { toString: () => 'hljs.css' },
  } as any;
  const fakeDocumentUri = vscode.Uri.file('/workspace/project/doc.md');

  /**
   * Property-based test: for any relative image path, buildHtml should convert
   * it to a vscode-resource:// or file:// URI. On unfixed code, the relative
   * path will remain as-is, causing this test to FAIL.
   */
  it('all relative <img src> paths should be converted to absolute URIs', () => {
    // Generator for relative image paths
    const relativePathArb = fc.oneof(
      fc.constant('images/logo.svg'),
      fc.constant('../assets/photo.png'),
      fc.constant('./diagrams/arch.png'),
      fc.constant('sub/dir/deep/image.jpg'),
      fc.tuple(
        fc.constantFrom('a', 'b', 'c', 'img', 'assets'),
        fc.constantFrom('.png', '.jpg', '.svg', '.gif'),
      ).map(([name, ext]) => `${name}/${name}${ext}`),
    );

    return fc.assert(
      fc.asyncProperty(relativePathArb, async (relativePath) => {
        const markdown = `![alt text](${relativePath})`;
        const html = await buildHtml(markdown, fakeContext, fakeWebview, fakeAssets, fakeDocumentUri);

        // Extract all img src values
        const srcMatches = [...html.matchAll(/<img[^>]*\bsrc="([^"]+)"/g)];
        for (const match of srcMatches) {
          const src = match[1];
          // After fix, relative paths should be converted to vscode-resource:// or file://
          // On unfixed code, src will still be the relative path — this assertion will FAIL
          const isAbsoluteOrConverted =
            src.startsWith('vscode-resource://') ||
            src.startsWith('file://') ||
            src.startsWith('https://') ||
            src.startsWith('http://') ||
            src.startsWith('data:');
          expect(isAbsoluteOrConverted).toBe(true);
        }
      }),
      { numRuns: 20 },
    );
  });
});
