import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { PDFArray, PDFDict, PDFDocument, PDFName } from 'pdf-lib';
import {
  acceptNextQuickPick,
  cleanupGeneratedPdf,
  cleanupPortableWorkspaceState,
  CONFIG_SECTION,
  latestSettingsExport,
  openWorkspaceMarkdown,
  workspacePath,
  workspaceVscodeDir,
} from './helpers';

function pageNumberForDestination(pdf: PDFDocument, destination: unknown): number {
  if (!(destination instanceof PDFArray)) {
    return 0;
  }
  const targetRef = destination.get(0).toString();
  return pdf.getPages().findIndex(page => page.ref.toString() === targetRef) + 1;
}

function directDestinationForAnnotation(pdf: PDFDocument, pageIndex: number, annotationIndex: number): PDFArray {
  const annots = pdf.getPage(pageIndex).node.Annots();
  assert.ok(annots, `Expected page ${pageIndex + 1} to have annotations`);
  assert.ok(annots.size() > annotationIndex, `Expected annotation ${annotationIndex} on page ${pageIndex + 1}`);

  const annot = pdf.context.lookup(annots.get(annotationIndex));
  assert.ok(annot instanceof PDFDict, `Expected annotation ${annotationIndex} to be a PDF dictionary`);
  const destination = annot.get(PDFName.of('Dest'));
  assert.ok(destination instanceof PDFArray, `Expected annotation ${annotationIndex} to use a direct PDF destination`);
  return destination;
}

suite('Markdown Studio Portable Settings E2E', () => {
  setup(async () => {
    await cleanupPortableWorkspaceState();
  });

  teardown(async () => {
    await cleanupPortableWorkspaceState();
  });

  test('exports PDF settings with page format and custom CSS snapshots', async function () {
    this.timeout(60000);

    const testFile = await openWorkspaceMarkdown();
    const cfg = vscode.workspace.getConfiguration(CONFIG_SECTION);
    await cfg.update('export.pageFormat', 'A3', vscode.ConfigurationTarget.Workspace);
    await cfg.update('style.customCss', 'h1 { color: navy; }', vscode.ConfigurationTarget.Workspace);
    await cfg.update('style.fontSize', 16, vscode.ConfigurationTarget.Workspace);

    await vscode.commands.executeCommand('markdownStudio.exportPdf');
    const a3Profile = latestSettingsExport('markdown-studio-pdf-settings-');
    assert.strictEqual(a3Profile.source, 'pdf-export');
    assert.strictEqual(a3Profile.pageFormat, 'A3');
    assert.strictEqual(a3Profile.customCss, 'h1 { color: navy; }');
    assert.strictEqual(a3Profile.fontSize, 16);

    await cfg.update('export.pageFormat', 'A4', vscode.ConfigurationTarget.Workspace);
    await vscode.commands.executeCommand('markdownStudio.exportPdf');
    const a4Profile = latestSettingsExport('markdown-studio-pdf-settings-');
    assert.strictEqual(a4Profile.pageFormat, 'A4');

    const pdfHistory = fs.readdirSync(workspaceVscodeDir())
      .filter(file => file.startsWith('markdown-studio-pdf-settings-'));
    assert.ok(pdfHistory.length <= 3, 'PDF settings history should keep at most three files');

    cleanupGeneratedPdf(testFile);
  });

  test('manually exports and imports portable settings JSON with custom CSS', async function () {
    this.timeout(30000);

    const cfg = vscode.workspace.getConfiguration(CONFIG_SECTION);
    await cfg.update('export.pageFormat', 'A4', vscode.ConfigurationTarget.Workspace);
    await cfg.update('style.customCss', 'h2 { color: teal; }', vscode.ConfigurationTarget.Workspace);
    const exportPromise = vscode.commands.executeCommand('markdownStudio.exportProfileToJson');
    await acceptNextQuickPick();
    await exportPromise;

    const manualProfile = latestSettingsExport('markdown-studio-settings-');
    assert.strictEqual(manualProfile.source, 'manual-export');
    assert.strictEqual(manualProfile.pageFormat, 'A4');
    assert.strictEqual(manualProfile.customCss, 'h2 { color: teal; }');

    const importFile = path.join(workspaceVscodeDir(), 'markdown-studio-settings-20990101-000000.json');
    fs.mkdirSync(workspaceVscodeDir(), { recursive: true });
    fs.writeFileSync(importFile, JSON.stringify({
      schemaVersion: 1,
      name: 'E2E Imported Settings',
      pageFormat: 'A3',
      customCss: 'body { color: rgb(1, 2, 3); }',
      fontSize: 18,
      includePdfIndex: false,
    }, null, 2));

    await cfg.update('export.pageFormat', 'A4', vscode.ConfigurationTarget.Workspace);
    await cfg.update('style.customCss', '', vscode.ConfigurationTarget.Workspace);
    await cfg.update('style.fontSize', 14, vscode.ConfigurationTarget.Workspace);
    await cfg.update('export.pdfIndex.enabled', true, vscode.ConfigurationTarget.Workspace);

    const importPromise = vscode.commands.executeCommand('markdownStudio.importExportProfile');
    await acceptNextQuickPick();
    await acceptNextQuickPick();
    await importPromise;

    const updated = vscode.workspace.getConfiguration(CONFIG_SECTION);
    assert.strictEqual(updated.get('export.pageFormat'), 'A3');
    assert.strictEqual(updated.get('style.customCss'), 'body { color: rgb(1, 2, 3); }');
    assert.strictEqual(updated.get('style.fontSize'), 18);
    assert.strictEqual(updated.get('export.pdfIndex.enabled'), false);
  });

  test('exports an adjacent Markdown cover page before the body PDF by default', async function () {
    this.timeout(60000);

    const testFile = await openWorkspaceMarkdown();
    const coverFile = path.join(path.dirname(testFile), 'cover.md');
    fs.writeFileSync(coverFile, [
      '# E2E Cover',
      '',
      'Prepared for Markdown Studio cover export.',
      '',
    ].join('\n'));

    const cfg = vscode.workspace.getConfiguration(CONFIG_SECTION);
    await cfg.update('export.pdfIndex.enabled', false, vscode.ConfigurationTarget.Workspace);
    await cfg.update('export.pdfBookmarks.enabled', false, vscode.ConfigurationTarget.Workspace);

    try {
      await vscode.commands.executeCommand('markdownStudio.exportPdf');

      const expectedPdf = testFile.replace(/\.md$/, '.pdf');
      assert.ok(fs.existsSync(expectedPdf), 'Expected cover-enabled PDF export to create a PDF');

      const pdf = await PDFDocument.load(fs.readFileSync(expectedPdf));
      assert.ok(pdf.getPageCount() >= 2, 'Expected PDF to include at least cover and body pages');

      const profile = latestSettingsExport('markdown-studio-pdf-settings-');
      assert.strictEqual(profile.coverEnabled, true);
      assert.strictEqual(profile.coverPath, 'cover.md');
    } finally {
      cleanupGeneratedPdf(testFile);
      if (fs.existsSync(coverFile)) {
        fs.unlinkSync(coverFile);
      }
    }
  });

  test('exports an embedded Markdown cover block before the body PDF', async function () {
    this.timeout(60000);

    const testFile = path.join(workspacePath(), 'embedded-cover.md');
    fs.writeFileSync(testFile, [
      '<!-- markdown-studio:cover -->',
      '# Embedded Cover',
      '',
      '<svg viewBox="0 0 120 32" xmlns="http://www.w3.org/2000/svg">',
      '  <rect width="120" height="32" fill="#123b6d" />',
      '  <text x="10" y="22" fill="white">Enterprise PDF</text>',
      '</svg>',
      '<!-- /markdown-studio:cover -->',
      '',
      '# Body',
      '',
      'The exported body should start after the cover block.',
    ].join('\n'));

    await openWorkspaceMarkdown('embedded-cover.md');

    const cfg = vscode.workspace.getConfiguration(CONFIG_SECTION);
    await cfg.update('export.pdfIndex.enabled', false, vscode.ConfigurationTarget.Workspace);
    await cfg.update('export.pdfBookmarks.enabled', false, vscode.ConfigurationTarget.Workspace);

    try {
      await vscode.commands.executeCommand('markdownStudio.exportPdf');

      const expectedPdf = testFile.replace(/\.md$/, '.pdf');
      assert.ok(fs.existsSync(expectedPdf), 'Expected embedded-cover PDF export to create a PDF');

      const pdf = await PDFDocument.load(fs.readFileSync(expectedPdf));
      assert.ok(pdf.getPageCount() >= 2, 'Expected PDF to include at least embedded cover and body pages');
    } finally {
      cleanupGeneratedPdf(testFile);
      if (fs.existsSync(testFile)) {
        fs.unlinkSync(testFile);
      }
    }
  });

  test('exports generated PDF index links as direct page destinations after an embedded cover', async function () {
    this.timeout(60000);

    const testFile = path.join(workspacePath(), 'pdf-index-links.md');
    fs.writeFileSync(testFile, [
      '<!-- markdown-studio:cover -->',
      '# Link Cover',
      '',
      'Cover page for PDF index link validation.',
      '<!-- /markdown-studio:cover -->',
      '',
      '# Body',
      '',
      'The body starts after the generated PDF index.',
      '',
      '## Alpha',
      '',
      'A short section before the forced print page break.',
      '',
      '<div style="page-break-before: always;"></div>',
      '',
      '## Math (KaTeX)',
      '',
      'Inline math: $E = mc^2$',
    ].join('\n'));

    await openWorkspaceMarkdown('pdf-index-links.md');

    const cfg = vscode.workspace.getConfiguration(CONFIG_SECTION);
    await cfg.update('export.pdfIndex.enabled', true, vscode.ConfigurationTarget.Workspace);
    await cfg.update('export.pdfBookmarks.enabled', false, vscode.ConfigurationTarget.Workspace);
    await cfg.update('export.cover.enabled', true, vscode.ConfigurationTarget.Workspace);

    try {
      await vscode.commands.executeCommand('markdownStudio.exportPdf');

      const expectedPdf = testFile.replace(/\.md$/, '.pdf');
      assert.ok(fs.existsSync(expectedPdf), 'Expected PDF index link export to create a PDF');

      const pdf = await PDFDocument.load(fs.readFileSync(expectedPdf));
      assert.ok(pdf.getPageCount() >= 4, 'Expected cover, generated PDF index, body, and forced Math page');

      const bodyDestination = directDestinationForAnnotation(pdf, 1, 0);
      const mathDestination = directDestinationForAnnotation(pdf, 1, 2);
      assert.strictEqual(pageNumberForDestination(pdf, bodyDestination), 3);
      assert.strictEqual(pageNumberForDestination(pdf, mathDestination), 4);
      assert.strictEqual(mathDestination.get(1).toString(), '/XYZ');
    } finally {
      cleanupGeneratedPdf(testFile);
      if (fs.existsSync(testFile)) {
        fs.unlinkSync(testFile);
      }
    }
  });
});
