import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createRequire } from 'node:module';
import yaml from 'js-yaml';

const require = createRequire(__filename);
const { checkReleaseWorkflow } = require('../../scripts/test/releaseWorkflowCheck.js') as {
  checkReleaseWorkflow: (workflow: unknown) => string[];
};

const source = fs.readFileSync(path.resolve(__dirname, '../../.github/workflows/release.yml'), 'utf8');

function mutate(edit: (text: string) => string): string[] {
  const changed = edit(source);
  expect(changed, 'mutation must change the workflow').not.toBe(source);
  return checkReleaseWorkflow(yaml.load(changed));
}

describe('release workflow check', () => {
  it('accepts the current release workflow', () => {
    expect(checkReleaseWorkflow(yaml.load(source))).toEqual([]);
  });

  it.each([
    ['drops a check', (t: string) => t.replace('      - run: npm run test:integration\n', '')],
    ['changes the tag trigger', (t: string) => t.replace("- 'v*'", "- 'x*'")],
    ['removes the tag condition on the release', (t: string) => t.replace("        if: startsWith(github.ref, 'refs/tags/v')\n", '')],
    ['weakens the tag condition', (t: string) => t.replace("if: startsWith(github.ref, 'refs/tags/v')", "if: startsWith(github.ref, 'refs/tags/v') && false")],
    ['packages before the checks', (t: string) => t.replace('      - run: npm run lint\n', '      - run: npm run package\n\n      - run: npm run lint\n')],
    ['re-adds the global vsce install', (t: string) => t.replace('      - run: npm ci\n', '      - run: npm ci\n\n      - run: npm install -g @vscode/vsce\n')],
    ['lets a failing test continue', (t: string) => t.replace('      - run: npm run test:unit\n', '      - run: npm run test:unit\n        continue-on-error: true\n')],
    ['packages even after a failure', (t: string) => t.replace('      - run: npm run package\n', '      - run: npm run package\n        if: always()\n')],
    ['swallows a failure with || true', (t: string) => t.replace('npm run test:local-only', 'npm run test:local-only || true')],
    ['adds a second release step with if: always()', (t: string) => t.trimEnd() + "\n\n      - name: Publish anyway\n        if: always()\n        uses: softprops/action-gh-release@v2\n        with:\n          files: dist/*.vsix\n"],
    ['replaces a check with a no-op that mentions it', (t: string) => t.replace('      - run: npm run lint\n', '      - run: echo skip npm run lint\n')],
  ])('fails when the workflow %s', (_label, edit) => {
    expect(mutate(edit).length).toBeGreaterThan(0);
  });
});
