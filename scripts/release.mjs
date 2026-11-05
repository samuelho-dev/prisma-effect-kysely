import { execFileSync } from 'node:child_process';
import console from 'node:console';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';

const args = process.argv.slice(2);
if (args.length > 1 || (args.length === 1 && args[0] !== '--dry-run')) {
  throw new Error('Usage: node scripts/release.mjs [--dry-run]');
}
const dryRun = args.length === 1;
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const registry = 'https://registry.npmjs.org';
const versionUrl = `${registry}/${encodeURIComponent(pkg.name)}/${encodeURIComponent(pkg.version)}`;
for (const [key, value] of Object.entries(process.env)) {
  if (
    value &&
    (/^(NPM_TOKEN|NODE_AUTH_TOKEN)$/i.test(key) ||
      (/^npm_config_/i.test(key) && /auth|token|password|username/i.test(key)))
  ) {
    throw new Error('npm credential environment variables are not allowed');
  }
}
const env = { ...process.env };
for (const key of Object.keys(env)) {
  if (/^npm_config_(userconfig|globalconfig)$/i.test(key)) delete env[key];
}

function checkSource() {
  if (dryRun) return;
  if (
    process.env.GITHUB_ACTIONS !== 'true' ||
    !process.env.GITHUB_SHA ||
    !process.env.ACTIONS_ID_TOKEN_REQUEST_URL ||
    !process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN
  ) {
    throw new Error('Publishing requires GitHub Actions OIDC');
  }
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (head !== process.env.GITHUB_SHA) throw new Error('HEAD does not match GITHUB_SHA');
  execFileSync('git', ['diff', '--quiet', 'HEAD', '--'], { stdio: 'inherit' });
  execFileSync('git', ['diff', '--cached', '--quiet', '--'], { stdio: 'inherit' });
}

async function metadata() {
  const response = await globalThis.fetch(versionUrl, {
    headers: { 'cache-control': 'no-cache' },
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Registry request failed: ${response.status}`);
  return response.json();
}

checkSource();

if (!dryRun && (await metadata())) {
  console.log(`${pkg.name}@${pkg.version} is already published; nothing to do.`);
  if (process.env.CHANGESETS_OUTPUT) writeFileSync(process.env.CHANGESETS_OUTPUT, '');
} else {
  const dir = mkdtempSync(join(tmpdir(), 'npm-release-'));
  try {
    env.NPM_CONFIG_USERCONFIG = join(dir, 'user.npmrc');
    env.NPM_CONFIG_GLOBALCONFIG = join(dir, 'global.npmrc');
    writeFileSync(env.NPM_CONFIG_USERCONFIG, '');
    writeFileSync(env.NPM_CONFIG_GLOBALCONFIG, '');
    execFileSync('bun', ['run', 'prepublishOnly'], { stdio: 'inherit', env });
    const packed = JSON.parse(
      execFileSync('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', dir], {
        encoding: 'utf8',
        env,
      })
    );
    if (packed.length !== 1 || packed[0].name !== pkg.name || packed[0].version !== pkg.version) {
      throw new Error('Packed package identity does not match package.json');
    }
    if (!packed[0].files.some((file) => file.path === 'dist/cli.js')) {
      throw new Error('Packed package is missing its executable');
    }
    const tarball = join(dir, packed[0].filename);
    const integrity = `sha512-${createHash('sha512').update(readFileSync(tarball)).digest('base64')}`;
    if (packed[0].integrity !== integrity) throw new Error('Packed tarball integrity mismatch');
    let tag = 'latest';
    try {
      const pre = JSON.parse(readFileSync('.changeset/pre.json', 'utf8'));
      if (pre.mode === 'pre') tag = pre.tag;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    checkSource();
    execFileSync(
      'npm',
      [
        'publish',
        tarball,
        '--ignore-scripts',
        '--access',
        'public',
        '--provenance',
        '--tag',
        tag,
        '--registry',
        registry,
        ...(dryRun ? ['--dry-run'] : []),
      ],
      { stdio: 'inherit', env, cwd: dir }
    );
    if (dryRun) {
      console.log(`Checked ${pkg.name}@${pkg.version}: ${integrity}`);
    } else {
      let published = await metadata();
      for (let attempt = 0; !published && attempt < 5; attempt++) {
        await delay(2000);
        published = await metadata();
      }
      if (
        !published ||
        published.name !== pkg.name ||
        published.version !== pkg.version ||
        published.dist?.integrity !== integrity
      ) {
        throw new Error(`Registry identity or integrity mismatch for ${pkg.name}@${pkg.version}`);
      }
      const gitTag = `v${pkg.version}`;
      execFileSync('git', ['tag', '-a', gitTag, '-m', `${pkg.name}@${pkg.version}`], {
        stdio: 'inherit',
      });
      if (process.env.CHANGESETS_OUTPUT) {
        writeFileSync(
          process.env.CHANGESETS_OUTPUT,
          `${JSON.stringify({ type: 'git-tag', tag: gitTag, packageName: pkg.name })}\n`
        );
      }
      console.log(`Verified ${pkg.name}@${pkg.version}: ${integrity}`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
