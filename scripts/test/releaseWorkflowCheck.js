// Checks .github/workflows/release.yml: the VSIX and the GitHub Release are
// produced only after the full checks pass, and the release only for v* tags.
//
// GitHub Actions skips later steps when a step fails, unless a step opts out
// with `continue-on-error`, an `if:` condition, or a command that swallows the
// failure (`|| true`, `; …`). So every step up to and including packaging must
// be a plain, exact command with no such escape.
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const REQUIRED_CHECKS = ['npm run lint', 'npm run test:unit', 'npm run test:integration', 'npm run test:local-only'];
const PACKAGE = 'npm run package';
const RELEASE_STEP = 'Create GitHub Release';
const RELEASE_IF = "startsWith(github.ref, 'refs/tags/v')";

/** Returns a list of problems; empty means the workflow is safe. */
function checkReleaseWorkflow(workflow) {
  const problems = [];
  const on = workflow?.on ?? workflow?.[true];
  const steps = workflow?.jobs?.release?.steps;
  if (!Array.isArray(steps)) return ['jobs.release.steps is missing'];

  const tags = on?.push?.tags;
  if (!(Array.isArray(tags) && tags.length === 1 && tags[0] === 'v*')) problems.push('release must trigger on push of v* tags');

  const runOf = (step) => (typeof step.run === 'string' ? step.run.trim() : undefined);
  const packageIndex = steps.findIndex((step) => runOf(step) === PACKAGE);
  if (packageIndex < 0) return [...problems, `release must build the VSIX with exactly \`${PACKAGE}\``];

  for (const command of REQUIRED_CHECKS) {
    const i = steps.findIndex((step) => runOf(step) === command);
    if (i < 0) problems.push(`release must run exactly \`${command}\``);
    else if (i > packageIndex) problems.push(`\`${command}\` must run before \`${PACKAGE}\``);
  }

  steps.slice(0, packageIndex + 1).forEach((step, i) => {
    const label = step.name ?? runOf(step) ?? step.uses ?? `step ${i}`;
    if (step['continue-on-error'] !== undefined) problems.push(`\`${label}\` must not use continue-on-error`);
    if (step.if !== undefined) problems.push(`\`${label}\` must not have an if: condition`);
    const run = runOf(step);
    if (run !== undefined && /\|\||;|&|\n/.test(run)) problems.push(`\`${label}\` must be a single command (no ||, ;, &, or multiple lines)`);
  });

  const releaseIndex = steps.findIndex((step) => step.name === RELEASE_STEP);
  if (releaseIndex < 0) {
    problems.push(`step "${RELEASE_STEP}" is missing`);
  } else {
    const release = steps[releaseIndex];
    if (String(release.if ?? '').trim() !== RELEASE_IF) problems.push(`"${RELEASE_STEP}" must have exactly if: ${RELEASE_IF}`);
    if (release['continue-on-error'] !== undefined) problems.push(`"${RELEASE_STEP}" must not use continue-on-error`);
    if (releaseIndex < packageIndex) problems.push(`"${RELEASE_STEP}" must come after packaging`);
  }

  if (steps.some((step) => /npm (install|i) -g @vscode\/vsce/.test(runOf(step) ?? ''))) {
    problems.push('do not install a global vsce; `npm run package` uses the pinned one');
  }
  return problems;
}

module.exports = { checkReleaseWorkflow };

if (require.main === module) {
  const file = process.argv[2] ?? path.resolve(__dirname, '../../.github/workflows/release.yml');
  const problems = checkReleaseWorkflow(yaml.load(fs.readFileSync(file, 'utf8')));
  if (problems.length > 0) {
    for (const problem of problems) console.error(`RELEASE_WORKFLOW FAIL: ${problem}`);
    process.exit(1);
  }
  console.log('RELEASE_WORKFLOW OK');
}
