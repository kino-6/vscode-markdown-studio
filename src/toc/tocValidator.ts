import * as vscode from 'vscode';
import type { AnchorMapping, TocDiagnostic } from '../types/models';

/**
 * Validate that each anchor link has a corresponding heading ID.
 * Returns diagnostics for anchors whose IDs are not found in headingIds.
 * Pure function — no VS Code API dependency.
 */
export function validateAnchors(
  anchors: AnchorMapping[],
  headingIds: Set<string>,
): TocDiagnostic[] {
  const diagnostics: TocDiagnostic[] = [];

  for (const anchor of anchors) {
    if (!headingIds.has(anchor.anchorId)) {
      diagnostics.push({
        line: anchor.heading.line,
        anchorId: anchor.anchorId,
        expectedHeading: anchor.heading.text,
        message: `Invalid anchor link "#${anchor.anchorId}" — no matching heading found for "${anchor.heading.text}"`,
      });
    }
  }

  return diagnostics;
}

/**
 * Publish TOC diagnostics to a VS Code DiagnosticCollection.
 * Clears existing diagnostics when the list is empty (all anchors valid).
 */
export function publishDiagnostics(
  diagnostics: TocDiagnostic[],
  documentUri: vscode.Uri,
  collection: vscode.DiagnosticCollection,
): void {
  if (diagnostics.length === 0) {
    collection.set(documentUri, []);
    return;
  }

  const vscodeDiagnostics = diagnostics.map((d) => {
    const range = new vscode.Range(d.line, 0, d.line, Number.MAX_SAFE_INTEGER);
    const diagnostic = new vscode.Diagnostic(
      range,
      d.message,
      vscode.DiagnosticSeverity.Warning,
    );
    diagnostic.source = 'Markdown Studio';
    return diagnostic;
  });

  collection.set(documentUri, vscodeDiagnostics);
}
