import fs from 'node:fs/promises';
import path from 'node:path';
import * as vscode from 'vscode';
import { getConfig } from '../infra/config';
import { buildHtml } from '../preview/buildHtml';

export async function exportToPdf(document: vscode.TextDocument, context: vscode.ExtensionContext): Promise<string> {
  const cfg = getConfig();
  const html = await buildHtml(document.getText(), context);

  // Playwright is external (not bundled) and shipped in the VSIX's node_modules.
  // Dynamic import keeps it out of the activation path.
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle' });

    const outputPath = path.join(path.dirname(document.uri.fsPath), `${path.basename(document.uri.fsPath, '.md')}.pdf`);
    await page.pdf({
      path: outputPath,
      format: cfg.pageFormat,
      printBackground: true,
      preferCSSPageSize: true
    });

    await fs.access(outputPath);
    return outputPath;
  } finally {
    await browser.close();
  }
}
