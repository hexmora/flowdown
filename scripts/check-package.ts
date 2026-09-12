/* eslint-disable no-await-in-loop -- Validate and hash files in deterministic order without retaining every file in memory. */
/* eslint-disable no-console -- This prepack command reports successful package validation. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstat, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { CheckedPackage, ExportTarget, PackageManifest } from './types.ts';

export async function filesUnder(directory: string, prefix = ''): Promise<string[]> {
  const result: string[] = [];

  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const name = path.posix.join(prefix, entry.name);

    assert(!entry.isSymbolicLink(), `Package cannot contain a symlink: ${name}`);

    if (entry.isDirectory())
      result.push(...(await filesUnder(path.join(directory, entry.name), name)));
    else result.push(name);
  }

  return result.toSorted();
}

export function exportTargets(value: ExportTarget | undefined): string[] {
  if (typeof value === 'string') return [value];

  if (!value) return [];

  return Object.values(value).flatMap(exportTargets);
}

export function publicEntries(manifest: PackageManifest): [string, ExportTarget][] {
  return Object.entries(manifest.exports ?? {}).filter(
    ([key, value]) =>
      key.startsWith('.') &&
      exportTargets(value).some((target) => /\.(?:mjs|cjs|js)$/.test(target)),
  );
}

// Conditional exports are ordered: the first matching branch determines resolution.
export function resolveExport(
  value: ExportTarget | undefined,
  conditions: readonly string[],
): string | null | undefined {
  if (typeof value === 'string') return value;

  if (value === null) return null;

  if (!value) return undefined;

  for (const [condition, target] of Object.entries(value)) {
    if (condition === 'default' || conditions.includes(condition)) {
      const resolved = resolveExport(target, conditions);

      if (resolved !== undefined) return resolved;
    }
  }

  return undefined;
}

export async function readManifest(directory: string): Promise<PackageManifest> {
  return JSON.parse(
    await readFile(path.join(directory, 'package.json'), 'utf8'),
  ) as PackageManifest;
}

async function checkExports(directory: string, source = false): Promise<PackageManifest> {
  const original = await readManifest(directory);

  const manifest = source ? { ...original, ...original.publishConfig } : original;

  const label = `${manifest.name}@${manifest.version}`;

  assert(
    manifest.name && manifest.version && !manifest.private,
    `Invalid public manifest: ${label}`,
  );

  assert(
    manifest.exports && publicEntries(manifest).length,
    `${label}: missing dual-format exports`,
  );

  const targets = new Set([
    ...exportTargets(manifest.exports),
    ...[manifest.main, manifest.module, manifest.types].filter((target): target is string =>
      Boolean(target),
    ),
  ]);

  for (const target of targets) {
    assert(
      target.startsWith('./') && !target.includes('*') && !target.split('/').includes('..'),
      `${label}: unsupported export ${target}`,
    );

    const file = path.join(directory, target);

    const info = await lstat(file).catch(() => null);

    assert(
      info?.isFile() && info.size > 0,
      `${label}: missing or empty export ${target}; run pnpm build`,
    );

    assert(
      target === './package.json' || target.startsWith('./dist/'),
      `${label}: export points outside dist: ${target}`,
    );
  }

  for (const [entry, value] of publicEntries(manifest)) {
    for (const environment of ['node', 'browser']) {
      for (const [format, extension, declaration] of [
        ['import', '.js', '.d.ts'],
        ['require', '.cjs', '.d.cts'],
      ]) {
        const mode = format === 'import' ? 'ESM' : 'CJS';

        assert(
          resolveExport(value, [environment, format])?.endsWith(extension),
          `${label}${entry}: missing ${environment} ${mode} runtime`,
        );

        assert(
          resolveExport(value, ['types', environment, format])?.endsWith(declaration),
          `${label}${entry}: missing ${environment} ${mode} declarations`,
        );
      }
    }
  }

  return manifest;
}

export async function checkPackage(directory: string): Promise<CheckedPackage> {
  const manifest = await checkExports(directory);

  const label = `${manifest.name}@${manifest.version}`;

  const files = await filesUnder(directory);

  for (const file of files) {
    assert(
      file.startsWith('dist/') ||
        /^(package\.json|readme(?:\..+)?|license(?:\..+)?|changelog(?:\..+)?)$/i.test(file),
      `${label}: unexpected packaged file ${file}`,
    );

    assert(
      !/(^|\/)(__tests__|__snapshots__|src)(\/|$)|\.(test|spec)\./.test(file),
      `${label}: development source leaked: ${file}`,
    );

    if (file.endsWith('.css')) {
      const css = await readFile(path.join(directory, file), 'utf8');

      assert(css.trim().length, `${label}: empty stylesheet ${file}`);

      for (const match of css.matchAll(/url\(\s*['"]?([^\s'"()]+)['"]?\s*\)/g)) {
        if (/^(data:|https?:|\/|#)/.test(match[1])) continue;

        const asset = path.posix.normalize(
          path.posix.join(path.posix.dirname(file), match[1].split(/[?#]/)[0]),
        );

        assert(files.includes(asset), `${label}: CSS asset missing: ${asset}`);
      }
    }
  }

  for (const field of [
    'dependencies',
    'optionalDependencies',
    'peerDependencies',
    'devDependencies',
  ] as const) {
    for (const [name, version] of Object.entries(manifest[field] ?? {})) {
      assert(
        !/^(workspace:|catalog:|file:|link:)/.test(version),
        `${label}: unresolved ${field} ${name}: ${version}`,
      );
    }
  }

  const digest = createHash('sha256');

  for (const file of files) {
    digest
      .update(file)
      .update('\0')
      .update(await readFile(path.join(directory, file)))
      .update('\0');
  }

  return { manifest, files, contentHash: digest.digest('hex') };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const source = process.argv.includes('--source');

    assert(
      !source || !process.env.npm_config_user_agent?.startsWith('npm/'),
      'Use pnpm pack or pnpm release so publishConfig and workspace/catalog protocols are normalized',
    );

    const directory = process.argv.slice(2).find((arg) => !arg.startsWith('--')) ?? process.cwd();

    const manifest = source
      ? await checkExports(path.resolve(directory), true)
      : (await checkPackage(path.resolve(directory))).manifest;

    console.log(`Package content OK: ${manifest.name}@${manifest.version}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);

    process.exitCode = 1;
  }
}
