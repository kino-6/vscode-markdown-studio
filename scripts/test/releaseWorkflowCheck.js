// Checks .github/workflows/release.yml: the VSIX and the GitHub Release are
// produced only after the full checks pass, and only for version tags.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const file = path.resolve(__dirname, '../../.github/workflows/release.yml');
const workflow = yaml.load(fs.readFileSync(file, 'utf8'));
const on = workflow.on ?? workflow[true];
const job = workflow.jobs.release;
const steps = job.steps;

const indexOfRun = (needle) => steps.findIndex((s) => typeof s.run === 'string' && s.run.includes(needle));

try {
  assert.deepEqual(on.push?.tags, ['v*'], 'release must still trigger on v* tags');

  const required = ['npm run lint', 'npm run test:unit', 'npm run test:integration', 'npm run test:local-only'];
  const packageIndex = indexOfRun('npm run package');
  assert.ok(packageIndex >= 0, 'release must build the VSIX with `npm run package`');
  for (const command of required) {
    const i = indexOfRun(command);
    assert.ok(i >= 0, `release must run \`${command}\``);
    assert.ok(i < packageIndex, `\`${command}\` must run before \`npm run package\``);
  }

  const release = steps.find((s) => s.name === 'Create GitHub Release');
  assert.ok(release, 'release step "Create GitHub Release" is missing');
  assert.match(String(release.if ?? ''), /startsWith\(github\.ref, *'refs\/tags\/v'\)/, 'GitHub Release must be created only for v* tags');
  assert.ok(steps.indexOf(release) > packageIndex, 'GitHub Release must come after packaging');

  assert.equal(indexOfRun('npm install -g @vscode/vsce'), -1, 'do not install a global vsce; `npm run package` uses the pinned one');
} catch (error) {
  console.error(`RELEASE_WORKFLOW FAIL: ${error.message}`);
  process.exit(1);
}
console.log('RELEASE_WORKFLOW OK');
