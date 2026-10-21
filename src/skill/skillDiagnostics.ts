import * as fs from 'node:fs';
import * as vscode from 'vscode';
import { createMarkdownParser } from '../parser/parseMarkdown';
import { isSkillFile, validateSkill, type SkillIssueSeverity } from './skillManifest';

function toSeverity(severity: SkillIssueSeverity): vscode.DiagnosticSeverity {
  if (severity === 'error') return vscode.DiagnosticSeverity.Error;
  if (severity === 'warning') return vscode.DiagnosticSeverity.Warning;
  return vscode.DiagnosticSeverity.Information;
}

/**
 * Publishes Agent Skills spec diagnostics for SKILL.md files while they are
 * open, and clears them when they close.
 */
export function registerSkillDiagnostics(context: vscode.ExtensionContext): void {
  const collection = vscode.languages.createDiagnosticCollection('markdownStudio.skill');
  const parser = createMarkdownParser();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  const update = (document: vscode.TextDocument) => {
    if (document.uri.scheme !== 'file' || !isSkillFile(document.uri.fsPath)) return;
    const issues = validateSkill(document.getText(), {
      filePath: document.uri.fsPath,
      fileExists: (p) => fs.existsSync(p),
      parser,
    });
    collection.set(document.uri, issues.map((issue) => {
      const line = Math.min(Math.max(issue.line, 0), Math.max(document.lineCount - 1, 0));
      const diagnostic = new vscode.Diagnostic(document.lineAt(line).range, issue.message, toSeverity(issue.severity));
      diagnostic.source = 'Agent Skills';
      return diagnostic;
    }));
  };

  const schedule = (document: vscode.TextDocument) => {
    const key = document.uri.toString();
    clearTimeout(timers.get(key));
    timers.set(key, setTimeout(() => {
      timers.delete(key);
      update(document);
    }, 300));
  };

  context.subscriptions.push(
    collection,
    vscode.workspace.onDidOpenTextDocument(update),
    vscode.workspace.onDidChangeTextDocument((event) => schedule(event.document)),
    vscode.workspace.onDidSaveTextDocument(update),
    vscode.workspace.onDidCloseTextDocument((document) => {
      clearTimeout(timers.get(document.uri.toString()));
      collection.delete(document.uri);
    }),
    { dispose: () => timers.forEach((timer) => clearTimeout(timer)) },
  );

  vscode.workspace.textDocuments.forEach(update);
}
