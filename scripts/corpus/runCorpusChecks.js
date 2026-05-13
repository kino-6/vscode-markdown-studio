const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repoRoot = path.resolve(__dirname, '../..');
const corpusRoot = path.join(repoRoot, 'ignore', 'markdown-corpus');
const manifestPath = path.join(corpusRoot, 'manifest.json');

function printHelp() {
  console.log(`Usage: npm run corpus:check -- [options]

Options:
  --mode <preview|pdf|both>  Which checks to run. Default: both
  --case <id>               Run one manifest case by id
  --repeat <n>              Measured runs per benchmark. Default: 1
  --warmup <n>              Warmup runs per benchmark. Default: 0
  --screenshots             Save full-page Preview screenshots for visual QA
`);
}

function parseArgs(argv) {
  const options = {
    mode: 'both',
    caseId: undefined,
    repeat: 1,
    warmup: 0,
    screenshots: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--mode') {
      options.mode = argv[++i];
    } else if (arg === '--case') {
      options.caseId = argv[++i];
    } else if (arg === '--repeat') {
      options.repeat = Number(argv[++i]);
    } else if (arg === '--warmup') {
      options.warmup = Number(argv[++i]);
    } else if (arg === '--screenshots') {
      options.screenshots = true;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!['preview', 'pdf', 'both'].includes(options.mode)) {
    throw new Error('--mode must be preview, pdf, or both');
  }
  if (!Number.isInteger(options.repeat) || options.repeat < 1) {
    throw new Error('--repeat must be a positive integer');
  }
  if (!Number.isInteger(options.warmup) || options.warmup < 0) {
    throw new Error('--warmup must be a non-negative integer');
  }

  return options;
}

function readManifest() {
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Corpus manifest not found: ${path.relative(repoRoot, manifestPath)}`);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (!Array.isArray(manifest.cases)) {
    throw new Error('manifest.json must contain a cases array');
  }
  return manifest;
}

function selectCases(manifest, caseId) {
  const cases = caseId
    ? manifest.cases.filter((entry) => entry.id === caseId)
    : manifest.cases;

  if (caseId && cases.length === 0) {
    throw new Error(`Unknown case id: ${caseId}`);
  }

  return cases;
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function runCommand(args) {
  const startedAt = new Date().toISOString();
  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = spawnSync(npmCommand, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return {
    command: ['npm', ...args].join(' '),
    startedAt,
    finishedAt: new Date().toISOString(),
    exitCode: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

function parsePreview(stdout) {
  const match = stdout.match(/run \d+\/\d+: buildHtml=(\d+)ms renderBody=(\d+)ms browserInitial=(\d+)ms updateBody=(\d+)ms/);
  if (!match) return undefined;
  return {
    buildHtmlMs: Number(match[1]),
    renderBodyMs: Number(match[2]),
    browserInitialMs: Number(match[3]),
    updateBodyMs: Number(match[4]),
  };
}

function parsePdf(stdout) {
  const match = stdout.match(/run \d+\/\d+: (\d+)ms -> ([^\n]+)\n[\s\S]*?summary: avg=(\d+)ms min=(\d+)ms max=(\d+)ms size=([0-9.]+MB)/);
  if (!match) return undefined;
  return {
    elapsedMs: Number(match[1]),
    outputPath: match[2].trim(),
    avgMs: Number(match[3]),
    minMs: Number(match[4]),
    maxMs: Number(match[5]),
    size: match[6],
  };
}

function writeLog(reportDir, caseId, kind, commandResult) {
  const logPath = path.join(reportDir, `${caseId}-${kind}.log`);
  fs.writeFileSync(
    logPath,
    [
      `$ ${commandResult.command}`,
      '',
      commandResult.stdout,
      commandResult.stderr ? `\n[stderr]\n${commandResult.stderr}` : '',
    ].join('\n'),
    'utf8',
  );
  return path.relative(repoRoot, logPath);
}

function buildMarkdownPath(entry) {
  return path.join('ignore', 'markdown-corpus', entry.path);
}

function buildScreenshotPath(reportDir, entry, screenshots) {
  if (!screenshots) return undefined;
  return path.join('ignore', 'markdown-corpus', 'reports', path.basename(reportDir), 'screenshots', `${entry.id}.png`);
}

function runPreviewCheck(entry, markdownPath, reportDir, options) {
  console.log(`[preview] ${entry.id}`);
  const screenshotPath = buildScreenshotPath(reportDir, entry, options.screenshots);
  const args = [
    'run',
    'benchmark:preview',
    '--',
    '--file',
    markdownPath,
    '--repeat',
    String(options.repeat),
    '--warmup',
    String(options.warmup),
  ];
  if (screenshotPath) {
    args.push('--screenshot', screenshotPath);
  }

  const commandResult = runCommand(args);
  return {
    ok: commandResult.exitCode === 0,
    exitCode: commandResult.exitCode,
    metrics: parsePreview(commandResult.stdout),
    screenshotPath: screenshotPath && commandResult.exitCode === 0 ? screenshotPath : undefined,
    logPath: writeLog(reportDir, entry.id, 'preview', commandResult),
  };
}

function runPdfCheck(entry, markdownPath, reportDir, options) {
  console.log(`[pdf] ${entry.id}`);
  const commandResult = runCommand([
    'run',
    'benchmark:pdf',
    '--',
    '--only',
    markdownPath,
    '--repeat',
    String(options.repeat),
    '--warmup',
    String(options.warmup),
  ]);
  return {
    ok: commandResult.exitCode === 0,
    exitCode: commandResult.exitCode,
    metrics: parsePdf(commandResult.stdout),
    logPath: writeLog(reportDir, entry.id, 'pdf', commandResult),
  };
}

function createCaseResult(entry, reportDir, options) {
  const markdownPath = buildMarkdownPath(entry);
  const result = {
    id: entry.id,
    path: markdownPath,
    category: entry.category,
  };

  if (options.mode === 'preview' || options.mode === 'both') {
    result.preview = runPreviewCheck(entry, markdownPath, reportDir, options);
  }

  if (options.mode === 'pdf' || options.mode === 'both') {
    result.pdf = runPdfCheck(entry, markdownPath, reportDir, options);
  }

  return result;
}

function findFailedResults(results) {
  return results.filter((result) => {
    const previewFailed = result.preview && !result.preview.ok;
    const pdfFailed = result.pdf && !result.pdf.ok;
    return previewFailed || pdfFailed;
  });
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const manifest = readManifest();
  const cases = selectCases(manifest, options.caseId);

  const reportDir = path.join(corpusRoot, 'reports', timestamp());
  fs.mkdirSync(reportDir, { recursive: true });

  const report = {
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    options,
    results: cases.map((entry) => createCaseResult(entry, reportDir, options)),
  };

  const reportPath = path.join(reportDir, 'corpus-results.json');
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  const failed = findFailedResults(report.results);

  console.log(`Report: ${path.relative(repoRoot, reportPath)}`);
  if (failed.length > 0) {
    console.error(`Failed cases: ${failed.map((result) => result.id).join(', ')}`);
    process.exit(1);
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
