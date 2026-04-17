#!/usr/bin/env node

import fs from 'node:fs';

const packageJsonPath = new URL('../package.json', import.meta.url);
const packageLockPath = new URL('../package-lock.json', import.meta.url);
const buildGradlePath = new URL('../android/app/build.gradle', import.meta.url);

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const filteredArgs = args.filter((arg) => arg !== '--dry-run');
const versionSpec = filteredArgs[0];

if (!versionSpec) {
  console.error('Usage: node scripts/bump-version.mjs <patch|minor|major|x.y.z> [--dry-run]');
  process.exit(1);
}

const packageJson = readJson(packageJsonPath);
const packageLock = readJson(packageLockPath);
const currentVersion = normalizeVersion(packageJson.version);
const nextVersion = resolveNextVersion(currentVersion, versionSpec);

const buildGradle = fs.readFileSync(buildGradlePath, 'utf8');
const currentVersionCode = extractVersionCode(buildGradle);
const nextVersionCode = currentVersionCode + 1;
const nextBuildGradle = buildGradle
  .replace(/^(\s*versionCode\s+)\d+(\s*)$/m, `$1${nextVersionCode}$2`)
  .replace(/^(\s*versionName\s+")([^"]+)("\s*)$/m, `$1${nextVersion}$3`);

if (nextBuildGradle === buildGradle) {
  throw new Error('Failed to update android/app/build.gradle');
}

packageJson.version = nextVersion;
packageLock.version = nextVersion;

if (packageLock.packages?.['']) {
  packageLock.packages[''].version = nextVersion;
}

if (dryRun) {
  console.log(`package.json: ${currentVersion} -> ${nextVersion}`);
  console.log(`android/app/build.gradle versionCode: ${currentVersionCode} -> ${nextVersionCode}`);
  console.log(`android/app/build.gradle versionName: ${extractVersionName(buildGradle)} -> ${nextVersion}`);
  process.exit(0);
}

writeJson(packageJsonPath, packageJson);
writeJson(packageLockPath, packageLock);
fs.writeFileSync(buildGradlePath, nextBuildGradle);

console.log(`Updated app version ${currentVersion} -> ${nextVersion}`);
console.log(`Updated Android versionCode ${currentVersionCode} -> ${nextVersionCode}`);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function normalizeVersion(version) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(version);

  if (!match) {
    throw new Error(`Unsupported version format: ${version}`);
  }

  return `${match[1]}.${match[2]}.${match[3]}`;
}

function resolveNextVersion(currentVersion, spec) {
  if (/^v?\d+\.\d+\.\d+$/.test(spec)) {
    return normalizeVersion(spec);
  }

  const [major, minor, patch] = currentVersion.split('.').map(Number);

  switch (spec) {
    case 'patch':
      return `${major}.${minor}.${patch + 1}`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'major':
      return `${major + 1}.0.0`;
    default:
      throw new Error(`Unsupported version spec: ${spec}`);
  }
}

function extractVersionCode(buildGradle) {
  const match = buildGradle.match(/^[\t ]*versionCode\s+(\d+)\s*$/m);

  if (!match) {
    throw new Error('Could not find versionCode in android/app/build.gradle');
  }

  return Number(match[1]);
}

function extractVersionName(buildGradle) {
  const match = buildGradle.match(/^[\t ]*versionName\s+"([^"]+)"\s*$/m);

  if (!match) {
    throw new Error('Could not find versionName in android/app/build.gradle');
  }

  return match[1];
}