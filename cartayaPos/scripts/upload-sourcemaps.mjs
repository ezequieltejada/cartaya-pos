import { existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const sentryOrg = process.env.SENTRY_ORG ?? 'estudio-pws';
const sentryProject = process.env.SENTRY_PROJECT ?? 'cartaya-pos';
const buildDirArg = process.argv[2] ?? 'www';
const buildDir = resolve(process.cwd(), buildDirArg);
const sentryCliExecutable = process.platform === 'win32'
  ? resolve(process.cwd(), 'node_modules', '.bin', 'sentry-cli.cmd')
  : resolve(process.cwd(), 'node_modules', '.bin', 'sentry-cli');

function collectSourceMaps(directory) {
  const entries = readdirSync(directory, { withFileTypes: true });
  const sourceMaps = [];

  for (const entry of entries) {
    const entryPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      sourceMaps.push(...collectSourceMaps(entryPath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.map')) {
      sourceMaps.push(entryPath);
    }
  }

  return sourceMaps;
}

function runSentryCli(args) {
  const result = spawnSync(sentryCliExecutable, args, {
    stdio: 'inherit',
    env: process.env,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (!existsSync(buildDir) || !statSync(buildDir).isDirectory()) {
  console.error(`Build directory not found: ${buildDir}`);
  process.exit(1);
}

if (!existsSync(sentryCliExecutable)) {
  console.error(`sentry-cli executable not found: ${sentryCliExecutable}`);
  process.exit(1);
}

if (!process.env.SENTRY_AUTH_TOKEN) {
  console.error('SENTRY_AUTH_TOKEN is required to upload source maps.');
  process.exit(1);
}

const sourceMaps = collectSourceMaps(buildDir);

if (sourceMaps.length === 0) {
  console.error(`No source maps found in ${buildDir}. Build the production app with source maps enabled first.`);
  process.exit(1);
}

console.log(`Injecting debug IDs into ${buildDir}`);
runSentryCli(['sourcemaps', 'inject', buildDir]);

console.log(`Uploading source maps from ${buildDir} to ${sentryOrg}/${sentryProject}`);
runSentryCli(['--org', sentryOrg, '--project', sentryProject, 'sourcemaps', 'upload', buildDir]);

for (const sourceMapPath of sourceMaps) {
  rmSync(sourceMapPath, { force: true });
}

console.log(`Uploaded ${sourceMaps.length} source maps and removed them from ${buildDir}`);
