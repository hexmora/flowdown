/* eslint-disable no-await-in-loop -- Release preparation and publication follow dependency order. */
/* eslint-disable no-console -- This command reports release progress and artifact locations. */
import { readChangesets } from '@changesets/read';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import semver from 'semver';

import type {
  ArtifactPackage,
  ReleaseArtifactManifest,
  ReleaseChannel,
  StableCandidate,
} from './release-artifact.ts';
import type { PackageArtifact, WorkspacePackage } from './types.ts';

import { checkBrowserConsumer } from './check-browser.ts';
import { checkPackage, publicEntries, readManifest } from './check-package.ts';
import {
  assertPublishEnvironment,
  assertSourceSha,
  assertTagDoesNotRegress,
  extractPackageTarball,
  parseRegistryResponse,
  PUBLIC_PACKAGES,
  publicationDisposition,
  readArtifactFile,
  RELEASE_REGISTRY,
  RELEASE_REPOSITORY,
  tarballDigests,
  validateReleaseManifest,
  validateStableCandidate,
} from './release-artifact.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const registry = RELEASE_REGISTRY;
const dependencyFields = ['dependencies', 'optionalDependencies', 'peerDependencies'] as const;

export function parseReleaseOptions(args = process.argv.slice(2)) {
  const { values } = parseArgs({
    args: args.filter((argument) => argument !== '--'),
    options: {
      channel: { type: 'string' },
      package: { type: 'string', default: 'all' },
      'dry-run': { type: 'boolean', default: false },
      publish: { type: 'boolean', default: false },
      prepare: { type: 'boolean', default: false },
      output: { type: 'string' },
      candidate: { type: 'string' },
      'from-artifact': { type: 'string' },
      'skip-build': { type: 'boolean', default: false },
    },
  });

  assert(
    values.channel === undefined || values.channel === 'stable' || values.channel === 'beta',
    'Channel must be stable or beta',
  );
  assert(!(values.publish && values['dry-run']), 'Cannot combine --dry-run and --publish');
  assert(
    !values.publish || values['from-artifact'],
    'Direct publication is disabled; use --from-artifact DIR --publish',
  );
  assert(!values['from-artifact'] || values.publish, '--from-artifact requires --publish');
  assert(!values.prepare || !values.publish, 'Preparation never publishes');
  assert(!values.prepare || !values['dry-run'], 'Use either --prepare or --dry-run');
  assert(
    !values['skip-build'] || (!values.prepare && !values.publish),
    '--skip-build is only allowed for local/CI dry runs',
  );
  assert(
    values.package === 'all',
    'Single-package release commands are disabled; the approved candidate controls stable publication',
  );
  assert(
    !values.publish || !(values.channel || values.output || values.candidate),
    'Artifact publication reads its channel and packages only from the manifest',
  );
  assert(
    !values.candidate || (values.prepare && (values.channel ?? 'stable') === 'stable'),
    '--candidate is only valid for stable preparation',
  );
  assert(
    !values.prepare ||
      (values.channel !== 'stable' && values.channel !== undefined) ||
      values.candidate,
    'Stable preparation requires --candidate FILE',
  );
  assert(!values.prepare || values.output, '--prepare requires --output DIR');

  return {
    channel: (values.channel ?? 'stable') as ReleaseChannel,
    prepare: values.prepare,
    publish: values.publish,
    dryRun: !values.prepare && !values.publish,
    skipBuild: values['skip-build'],
    output: values.output,
    candidate: values.candidate,
    artifact: values['from-artifact'],
  };
}

function topologicalPackages<
  T extends {
    manifest: {
      name: string;
      dependencies?: Record<string, string>;
      optionalDependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
    };
  },
>(packages: T[]): T[] {
  const byName = new Map(packages.map((pkg) => [pkg.manifest.name, pkg]));
  const result: T[] = [];
  const active = new Set<string>();
  const done = new Set<string>();

  function visit(pkg: T): void {
    const name = pkg.manifest.name;

    if (done.has(name)) return;
    assert(!active.has(name), `Internal dependency cycle: ${name}`);
    active.add(name);

    for (const field of dependencyFields) {
      for (const dependency of Object.keys(pkg.manifest[field] ?? {})) {
        const internal = byName.get(dependency);

        if (internal) visit(internal);
      }
    }

    active.delete(name);
    done.add(name);
    result.push(pkg);
  }

  packages.forEach(visit);

  return result;
}

function run(
  command: string,
  args: string[],
  {
    cwd = root,
    capture = false,
    allowFailure = false,
    timeout = 600_000,
  }: { cwd?: string; capture?: boolean; allowFailure?: boolean; timeout?: number } = {},
) {
  console.log(`> ${command} ${args.join(' ')}`);

  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: capture ? 'pipe' : 'inherit',
    env: {
      ...process.env,
      PATH: `${path.join(root, 'node_modules', '.bin')}${path.delimiter}${process.env.PATH ?? ''}`,
      npm_config_registry: registry,
    },
    timeout,
    maxBuffer: 16 * 1024 * 1024,
  });

  if (!allowFailure && (result.error || result.status !== 0)) {
    throw new Error(
      `${command} failed (${result.status}): ${result.error?.message ?? ''}\n${result.stderr ?? ''}\n${result.stdout ?? ''}`,
    );
  }

  return result;
}

async function workspacePackages(): Promise<WorkspacePackage[]> {
  const packages: WorkspacePackage[] = [];

  for (const directory of (await readdir(path.join(root, 'packages'))).toSorted()) {
    const source = path.join(root, 'packages', directory);
    const manifest = await readManifest(source).catch((error: unknown) => {
      if (
        error instanceof Error &&
        'code' in error &&
        (error.code === 'ENOENT' || error.code === 'ENOTDIR')
      )
        return null;
      throw error;
    });

    if (manifest) packages.push({ directory, source, manifest });
  }

  assert.deepEqual(
    packages
      .filter((pkg) => !pkg.manifest.private)
      .map((pkg) => pkg.manifest.name)
      .toSorted(),
    [...PUBLIC_PACKAGES].toSorted(),
    'Public workspace packages differ from the publication allowlist',
  );

  return packages;
}

async function unpack(tarball: string, destination: string) {
  await extractPackageTarball(await readFile(tarball), destination);

  return checkPackage(destination);
}

function registryValue(specifier: string, field: string): unknown | null {
  const result = run(
    'npm',
    ['view', specifier, field, '--json', '--prefer-online', '--registry', registry],
    { capture: true, allowFailure: true },
  );
  return parseRegistryResponse(result, specifier);
}

function publishedIntegrity(name: string, version: string): string | null {
  const value = registryValue(`${name}@${version}`, 'dist.integrity');

  assert(
    value === null || typeof value === 'string',
    `Invalid npm integrity for ${name}@${version}`,
  );

  return value;
}

function currentTag(name: string, tag: string): string | null {
  const value = registryValue(name, 'dist-tags');

  if (value === null) return null;
  assert(typeof value === 'object' && !Array.isArray(value), `Invalid npm tags for ${name}`);

  const version = (value as Record<string, unknown>)[tag];

  assert(version === undefined || typeof version === 'string', `Invalid ${tag} tag for ${name}`);

  return version ?? null;
}

async function validateDependencies(selected: PackageArtifact[]) {
  const byName = new Map(selected.map((artifact) => [artifact.manifest.name, artifact]));
  const workspaceNames = new Set<string>(PUBLIC_PACKAGES);

  for (const artifact of selected) {
    for (const field of dependencyFields) {
      for (const [name, range] of Object.entries(artifact.manifest[field] ?? {})) {
        if (!workspaceNames.has(name)) continue;

        const selectedDependency = byName.get(name);

        if (selectedDependency) {
          assert(
            semver.satisfies(selectedDependency.manifest.version, range),
            `${artifact.manifest.name}: selected ${name} version does not satisfy ${range}`,
          );
        } else {
          const available = registryValue(`${name}@${range}`, 'version');

          assert(
            typeof available === 'string' || (Array.isArray(available) && available.length > 0),
            `${artifact.manifest.name} requires unpublished ${name}@${range}; its dependency must be included in the approved candidate`,
          );
        }
      }
    }
  }
}

async function verifyConsumer(artifacts: PackageArtifact[]) {
  const consumer = await mkdtemp(path.join(tmpdir(), 'fluxdown-consumer-'));

  try {
    await writeFile(
      path.join(consumer, 'package.json'),
      JSON.stringify({
        name: 'fluxdown-consumer-check',
        private: true,
        type: 'module',
        dependencies: Object.fromEntries(
          artifacts.map((artifact) => [artifact.manifest.name, `file:${artifact.tarball}`]),
        ),
        overrides: Object.fromEntries(
          artifacts.map((artifact) => [artifact.manifest.name, `$${artifact.manifest.name}`]),
        ),
      }),
    );

    run(
      'npm',
      [
        'install',
        '--ignore-scripts',
        '--no-audit',
        '--no-fund',
        '--no-package-lock',
        'react@18.3.1',
        'react-dom@18.3.1',
        '@types/react@18',
        '@types/react-dom@18',
      ],
      { cwd: consumer },
    );

    // Overrides force every occurrence of a package in this release group to
    // come from its inspected tarball, even when npm already hosts the version.
    const installed = JSON.parse(
      run('npm', ['ls', '--all', '--json'], { cwd: consumer, capture: true }).stdout,
    ) as { dependencies?: Record<string, unknown> };
    const expectedVersions = new Map(
      artifacts.map((artifact) => [artifact.manifest.name, artifact.manifest.version]),
    );

    function checkInstalled(dependencies: Record<string, unknown> | undefined): void {
      for (const [name, value] of Object.entries(dependencies ?? {})) {
        assert(value && typeof value === 'object', `Invalid installed dependency: ${name}`);

        const entry = value as { version?: string; dependencies?: Record<string, unknown> };
        const expected = expectedVersions.get(name);

        if (expected)
          assert.equal(entry.version, expected, `Consumer resolved a different ${name} version`);
        checkInstalled(entry.dependencies);
      }
    }

    checkInstalled(installed.dependencies);

    const specifiers = artifacts.flatMap(({ manifest }) =>
      publicEntries(manifest).map(
        ([entry]) => manifest.name + (entry === '.' ? '' : entry.slice(1)),
      ),
    );

    let esmSmoke = specifiers
      .map((specifier) => `await import(${JSON.stringify(specifier)});`)
      .join('\n');

    let cjsSmoke = specifiers
      .map((specifier) => `require(${JSON.stringify(specifier)});`)
      .join('\n');

    let typeSmoke = '';

    if (specifiers.includes('functive')) {
      const behavior = `
assert.equal(functive.jsx, jsxRuntime.jsx);
assert.equal(functive.createElement, jsxRuntime.createElement);
const state = functive.render(jsxRuntime.jsx(() => 42, {}));
assert.equal(state.value.value, 42);
state.destroy();
`;

      esmSmoke += `\nimport assert from 'node:assert/strict';\nimport * as functive from 'functive';\nimport * as jsxRuntime from 'functive/jsx-runtime';\n${behavior}`;

      cjsSmoke += `\nconst assert = require('node:assert/strict');\nconst functive = require('functive');\nconst jsxRuntime = require('functive/jsx-runtime');\n${behavior}`;

      typeSmoke = `
import { D, render, type JSXDescriptor } from 'functive';
import { jsx } from 'functive/jsx-runtime';
const descriptor: JSXDescriptor<number> = jsx(() => 42, {});
render(descriptor);
jsx(({ x }: { x: number }) => x, { x: D(42) });
`;
    }

    if (specifiers.includes('@fluxdown/react-presets/base')) {
      const behavior = `
const plugin = new presetRender.ParagraphRenderPlugin();
contextAssert.ok(plugin instanceof presetBase.BaseReactRenderPlugin);
const element = plugin.render({
  node: { type: 'element', tagName: 'p', properties: {}, children: [{ type: 'text', value: 'shared-context' }] },
  parents: [], getProps: () => ({}), render: () => null, renderChildren: () => 'shared-context',
});
const html = renderToStaticMarkup(React.createElement(presetBase.SlotsContext.Provider, {
  value: { Paragraph: [{ Component: ({ children }) => React.createElement('p', null, children) }] },
}, element));
contextAssert.equal(html, '<p>shared-context</p>');
`;

      esmSmoke += `\nimport contextAssert from 'node:assert/strict';\nimport * as React from 'react';\nimport { renderToStaticMarkup } from 'react-dom/server';\nimport * as presetBase from '@fluxdown/react-presets/base';\nimport * as presetRender from '@fluxdown/react-presets/render';\n${behavior}`;

      cjsSmoke += `\nconst contextAssert = require('node:assert/strict');\nconst React = require('react');\nconst { renderToStaticMarkup } = require('react-dom/server');\nconst presetBase = require('@fluxdown/react-presets/base');\nconst presetRender = require('@fluxdown/react-presets/render');\n${behavior}`;
    }

    await writeFile(path.join(consumer, 'smoke.mjs'), esmSmoke);

    await writeFile(path.join(consumer, 'smoke.cjs'), cjsSmoke);

    run('node', ['smoke.mjs'], { cwd: consumer });

    run('node', ['smoke.cjs'], { cwd: consumer });

    const imports = specifiers
      .map(
        (specifier, i) =>
          `import * as Entry${i} from ${JSON.stringify(specifier)};\nvoid Entry${i};`,
      )
      .join('\n');

    await writeFile(path.join(consumer, 'smoke.mts'), imports + typeSmoke);

    await writeFile(path.join(consumer, 'smoke.cts'), imports + typeSmoke);

    await writeFile(
      path.join(consumer, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
          target: 'ES2022',
          strict: true,
          noEmit: true,
          skipLibCheck: false,
          jsx: 'react-jsx',
        },
        files: ['smoke.mts', 'smoke.cts'],
      }),
    );

    run('pnpm', ['exec', 'tsc', '-p', path.join(consumer, 'tsconfig.json')]);

    console.log(
      `Isolated npm consumer OK: ${specifiers.length} ESM/CJS entry points and NodeNext declarations`,
    );

    const browser = await checkBrowserConsumer(consumer, artifacts);

    return { nodeEntries: specifiers.length, browser };
  } finally {
    if (process.env.FLUXDOWN_KEEP_CONSUMER === '1') {
      console.log(`Preserved isolated consumer for inspection: ${consumer}`);
    } else {
      await rm(consumer, { recursive: true, force: true });
    }
  }
}

function retryableDownloadError(result: ReturnType<typeof run>): string | null {
  if (result.error) {
    return 'code' in result.error && result.error.code === 'ETIMEDOUT' ? 'ETIMEDOUT' : null;
  }

  let response: unknown;

  try {
    response = JSON.parse(result.stdout);
  } catch {
    return null;
  }

  if (!response || typeof response !== 'object' || !('error' in response)) return null;

  const error = response.error;

  if (!error || typeof error !== 'object' || !('code' in error)) return null;

  const code = error.code;

  return typeof code === 'string' &&
    /^(?:E404|ETARGET|E408|E429|E5\d{2}|ECONNRESET|ECONNREFUSED|ETIMEDOUT|ESOCKETTIMEDOUT|EAI_AGAIN|ENOTFOUND|ENETUNREACH|EHOSTUNREACH)$/.test(
      code,
    )
    ? code
    : null;
}

async function verifyPublished(
  artifacts: PackageArtifact[],
  metadata: Map<string, ArtifactPackage>,
  destination: string,
) {
  const pending = new Map(artifacts.map((artifact) => [artifact.manifest.name, artifact]));
  const deadline = Date.now() + 20 * 60_000;

  while (pending.size > 0) {
    for (const [name, artifact] of pending) {
      const remaining = deadline - Date.now();

      if (remaining <= 0) break;

      const expected = metadata.get(name)!;
      const specifier = `${name}@${artifact.manifest.version}`;
      const downloadDirectory = path.join(destination, artifact.directory);
      const timeout = Math.min(60_000, remaining);

      await mkdir(downloadDirectory, { recursive: true });

      const result = run(
        'npm',
        [
          'pack',
          specifier,
          '--ignore-scripts',
          '--prefer-online',
          '--fetch-retries=0',
          `--fetch-timeout=${timeout}`,
          '--pack-destination',
          downloadDirectory,
          '--json',
          '--registry',
          registry,
        ],
        { capture: true, allowFailure: true, timeout },
      );

      if (result.status === 0 && !result.error) {
        const [{ filename }] = JSON.parse(result.stdout) as { filename: string }[];

        assert(
          filename && path.basename(filename) === filename,
          'Invalid registry tarball filename',
        );

        const downloaded = await readFile(path.join(downloadDirectory, filename));

        assert.deepEqual(
          tarballDigests(downloaded),
          { sha256: expected.sha256, integrity: expected.integrity },
          `${specifier}: published tarball differs from the approved archive`,
        );
        console.log(`Published tarball verified: ${specifier}`);
        pending.delete(name);
        continue;
      }

      const retryCode = retryableDownloadError(result);

      if (!retryCode) {
        throw new Error(
          `Published package could not be downloaded: ${specifier}\n${result.error?.message ?? ''}\n${result.stderr}\n${result.stdout}`,
        );
      }

      console.log(`Waiting for npm availability: ${specifier} (${retryCode})`);
    }

    if (pending.size === 0) return;

    const remaining = deadline - Date.now();

    if (remaining <= 0) {
      throw new Error(
        `npm availability verification exceeded the shared 20-minute deadline: ${[...pending.values()].map((artifact) => `${artifact.manifest.name}@${artifact.manifest.version}`).join(', ')}`,
      );
    }

    const delay = Math.min(30_000, remaining);

    console.log(
      `Waiting ${Math.ceil(delay / 1000)}s before checking ${pending.size} package(s) again; ${Math.ceil(remaining / 1000)}s remain`,
    );
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}

export async function stageWorkspaceManifests(
  packages: WorkspacePackage[],
  stage: string,
): Promise<void> {
  // Changesets must see private packages too: their entries may share a changeset
  // with public packages. Private packages are never part of the tarball list.
  for (const pkg of packages) {
    const destination = path.join(stage, 'packages', pkg.directory);

    await mkdir(destination, { recursive: true });
    await writeFile(
      path.join(destination, 'package.json'),
      JSON.stringify(pkg.manifest, null, 2) + '\n',
    );
  }
}

export async function stageBetaSnapshot(
  stage: string,
  sourceRoot: string,
  runId: string,
): Promise<void> {
  await cp(path.join(sourceRoot, '.changeset'), path.join(stage, '.changeset'), {
    recursive: true,
  });

  const configFile = path.join(stage, '.changeset', 'config.json');
  const config = JSON.parse(await readFile(configFile, 'utf8')) as Record<string, unknown>;

  await writeFile(
    configFile,
    JSON.stringify(
      {
        ...config,
        commit: false,
        changelog: false,
        format: false,
        privatePackages: { version: true, tag: false },
        snapshot: { useCalculatedVersion: true },
      },
      null,
      2,
    ) + '\n',
  );

  const cli = path.join(root, 'node_modules', '@changesets', 'cli', 'bin.js');

  // Every public package participates, even immediately after a stable release
  // has consumed all changesets. The real pending bumps still take precedence.
  run(
    process.execPath,
    [
      cli,
      'add',
      '--patch',
      PUBLIC_PACKAGES.join(','),
      '--message',
      'Temporary beta snapshot; this changeset is never committed.',
    ],
    { cwd: stage },
  );
  run(
    process.execPath,
    [
      cli,
      'version',
      '--snapshot',
      'beta',
      '--snapshot-prerelease-template',
      `{tag}.{datetime}.g{commit}.r${runId}.a1`,
    ],
    { cwd: stage },
  );
}

async function prepareRelease(options: ReturnType<typeof parseReleaseOptions>) {
  const allPackages = await workspacePackages();
  const packages = topologicalPackages(allPackages.filter((pkg) => !pkg.manifest.private));
  const sourceSha = run('git', ['rev-parse', 'HEAD'], { capture: true }).stdout.trim();

  assertSourceSha(sourceSha);

  if (options.prepare) {
    assert(
      !run('git', ['status', '--porcelain'], { capture: true }).stdout.trim(),
      'Preparation requires a clean checkout so the source SHA identifies the built code',
    );
  }

  if (options.prepare && process.env.GITHUB_ACTIONS === 'true') {
    assert.equal(
      process.env.GITHUB_REF,
      'refs/heads/main',
      'Release preparation must run from main',
    );
    assert.equal(process.env.GITHUB_REPOSITORY, RELEASE_REPOSITORY, 'Unexpected repository');
    assert.equal(
      process.env.GITHUB_RUN_ATTEMPT,
      '1',
      'Use a new dispatch instead of rerunning preparation',
    );
    assert.equal(
      process.env.GITHUB_SHA,
      sourceSha,
      'Preparation checkout differs from the workflow source SHA',
    );
  }

  let candidate: StableCandidate | undefined;

  if (options.candidate) {
    candidate = validateStableCandidate(
      JSON.parse(await readFile(path.resolve(root, options.candidate), 'utf8')),
    );
  }

  const selectedNames = new Set(
    candidate ? candidate.packages.map((pkg) => pkg.name) : PUBLIC_PACKAGES,
  );

  if (candidate) {
    for (const expected of candidate.packages) {
      const pkg = packages.find((entry) => entry.manifest.name === expected.name);

      assert.equal(
        pkg?.manifest.version,
        expected.version,
        `Candidate version differs from checkout: ${expected.name}`,
      );

      const changelog = await readFile(path.join(pkg!.source, 'CHANGELOG.md'), 'utf8');

      assert(
        changelog.split('\n').includes(`## ${expected.version}`),
        `Missing reviewed changelog entry: ${expected.name}@${expected.version}`,
      );
      assert.equal(
        publishedIntegrity(expected.name, expected.version),
        null,
        `Candidate version already exists: ${expected.name}@${expected.version}; recover the original artifact instead`,
      );
    }

    const changesets = await readChangesets(root);

    assert(
      !changesets.some((changeset) =>
        changeset.releases.some((release) => selectedNames.has(release.name)),
      ),
      'Stable candidate still has pending changesets for selected packages',
    );
  }

  if (!options.skipBuild) run('pnpm', ['build']);

  const stamp = new Date().toISOString().replace(/\D/g, '');
  const runId =
    process.env.GITHUB_ACTIONS === 'true' ? process.env.GITHUB_RUN_ID : String(Date.now());

  assert(runId && /^[1-9]\d*$/.test(runId), 'Preparation requires a valid run ID');

  const output = path.resolve(
    root,
    options.output ??
      path.join('.release', `${options.channel}-${stamp}-${randomBytes(3).toString('hex')}`),
  );
  const releaseRoot = path.join(root, '.release');

  assert(output.startsWith(`${releaseRoot}${path.sep}`), 'Release output must be inside .release/');
  await mkdir(output, { recursive: true });
  assert.equal(
    (await readdir(output)).length,
    0,
    'Refusing to overwrite an existing release artifact',
  );

  const stage = path.join(output, 'workspace');
  const tarballs = path.join(output, 'tarballs');
  const unpacked = path.join(output, 'unpacked');

  await mkdir(tarballs);
  await mkdir(stage);

  try {
    for (const filename of ['package.json', 'pnpm-workspace.yaml', 'LICENSE']) {
      await cp(path.join(root, filename), path.join(stage, filename));
    }

    await mkdir(path.join(stage, 'scripts'));

    for (const filename of ['check-package.ts', 'types.ts']) {
      await cp(path.join(root, 'scripts', filename), path.join(stage, 'scripts', filename));
    }

    await stageWorkspaceManifests(allPackages, stage);

    for (const pkg of packages) {
      const destination = path.join(stage, 'packages', pkg.directory);

      for (const filename of await readdir(pkg.source)) {
        if (filename === 'dist' || /^(readme|license|changelog)(\..*)?$/i.test(filename)) {
          await cp(path.join(pkg.source, filename), path.join(destination, filename), {
            recursive: true,
          });
        }
      }

      await cp(path.join(root, 'LICENSE'), path.join(destination, 'LICENSE'));
    }

    if (options.channel === 'beta') await stageBetaSnapshot(stage, root, runId);

    const stagedVersions = new Map<string, string>();

    for (const pkg of packages) {
      const manifest = await readManifest(path.join(stage, 'packages', pkg.directory));

      stagedVersions.set(manifest.name, manifest.version);
    }

    for (const pkg of packages) {
      const destination = path.join(stage, 'packages', pkg.directory);
      const manifest = await readManifest(destination);

      for (const field of dependencyFields) {
        for (const [name, range] of Object.entries(manifest[field] ?? {})) {
          const version = stagedVersions.get(name);

          if (!version) continue;
          assert(
            range.startsWith('workspace:'),
            `${manifest.name}: internal ${name} must use workspace protocol`,
          );

          const prefix =
            options.channel === 'beta'
              ? ''
              : (range.slice('workspace:'.length).match(/^[~^]/)?.[0] ?? '');

          manifest[field]![name] = `workspace:${prefix}${version}`;
        }
      }

      await writeFile(
        path.join(destination, 'package.json'),
        JSON.stringify(manifest, null, 2) + '\n',
      );
    }

    const artifacts: PackageArtifact[] = [];

    for (const pkg of packages) {
      if (!selectedNames.has(pkg.manifest.name)) continue;

      const tarball = path.join(tarballs, `${pkg.directory}.tgz`);

      run('pnpm', ['pack', '--out', tarball, '--json'], {
        cwd: path.join(stage, 'packages', pkg.directory),
        capture: true,
      });
      artifacts.push({
        ...(await unpack(tarball, path.join(unpacked, pkg.directory))),
        directory: pkg.directory,
        tarball,
      });
    }

    await validateDependencies(artifacts);

    const verification = await verifyConsumer(artifacts);
    const manifest: ReleaseArtifactManifest = {
      schemaVersion: 1,
      repository: RELEASE_REPOSITORY,
      sourceSha,
      channel: options.channel,
      tag: options.channel === 'stable' ? 'latest' : 'beta',
      registry,
      runId,
      runAttempt: 1,
      publishable: options.prepare,
      tools: {
        node: process.version,
        npm: run('npm', ['--version'], { capture: true }).stdout.trim(),
        pnpm: run('pnpm', ['--version'], { capture: true }).stdout.trim(),
        changesets: JSON.parse(
          await readFile(
            path.join(root, 'node_modules', '@changesets', 'cli', 'package.json'),
            'utf8',
          ),
        ).version as string,
      },
      ...(candidate ? { candidate } : {}),
      verification,
      packages: await Promise.all(
        artifacts.map(async ({ manifest: pkg, files, contentHash, tarball }) => ({
          name: pkg.name,
          version: pkg.version,
          tarball: path.relative(output, tarball).split(path.sep).join('/'),
          ...tarballDigests(await readFile(tarball)),
          files,
          contentHash,
        })),
      ),
    };

    validateReleaseManifest(manifest);
    await writeFile(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
    console.log(
      `${options.prepare ? 'Preparation' : 'Package validation dry run'} complete; nothing was uploaded. Review ${path.relative(root, output)}/manifest.json`,
    );
  } finally {
    await rm(stage, { recursive: true, force: true });
    await rm(unpacked, { recursive: true, force: true });
  }
}

async function publishArtifact(directory: string) {
  const artifactRoot = path.resolve(root, directory);
  const manifest = validateReleaseManifest(
    JSON.parse((await readArtifactFile(artifactRoot, 'manifest.json')).toString('utf8')),
  );

  assertPublishEnvironment(manifest, process.env);
  assert.equal(
    process.version,
    manifest.tools.node,
    'Publishing Node.js version differs from preparation',
  );
  assert.equal(
    run('npm', ['--version'], { capture: true }).stdout.trim(),
    manifest.tools.npm,
    'Publishing npm version differs from preparation',
  );

  const temporary = await mkdtemp(path.join(tmpdir(), 'flowdown-approved-release-'));

  try {
    const artifacts: PackageArtifact[] = [];
    const metadata = new Map(manifest.packages.map((pkg) => [pkg.name, pkg]));

    // Validate and copy every archive to a private directory before making any
    // registry mutation. Publication reads these exact validated bytes only.
    for (const [index, expected] of manifest.packages.entries()) {
      const data = await readArtifactFile(artifactRoot, expected.tarball);

      assert.deepEqual(
        tarballDigests(data),
        { sha256: expected.sha256, integrity: expected.integrity },
        `Artifact digest mismatch: ${expected.name}`,
      );

      const tarball = path.join(temporary, `package-${index}.tgz`);

      await writeFile(tarball, data, { flag: 'wx' });

      const checked = await unpack(tarball, path.join(temporary, `unpacked-${index}`));

      assert.equal(checked.manifest.name, expected.name, 'Tarball package name mismatch');
      assert.equal(checked.manifest.version, expected.version, 'Tarball package version mismatch');
      assert.equal(checked.contentHash, expected.contentHash, 'Tarball content hash mismatch');
      assert.deepEqual(checked.files, expected.files, 'Tarball file list mismatch');
      artifacts.push({ ...checked, directory: `package-${index}`, tarball });
    }

    const ordered = topologicalPackages(artifacts);

    await validateDependencies(ordered);

    const dispositions = new Map<string, 'publish' | 'skip'>();

    for (const artifact of ordered) {
      const expected = metadata.get(artifact.manifest.name)!;
      const disposition = publicationDisposition(
        expected,
        publishedIntegrity(expected.name, expected.version),
      );
      const taggedVersion = currentTag(expected.name, manifest.tag);

      if (disposition === 'publish') {
        assertTagDoesNotRegress(manifest.channel, expected.version, taggedVersion, manifest.runId);
      }

      dispositions.set(expected.name, disposition);
    }

    // No build, Changesets operation, checkout, or moving-main lookup belongs
    // below this point. The workflow has already obtained owner approval.
    for (const artifact of ordered) {
      const expected = metadata.get(artifact.manifest.name)!;

      if (dispositions.get(expected.name) === 'skip') {
        console.log(
          `Already published with identical integrity: ${expected.name}@${expected.version}; leaving dist-tags unchanged`,
        );
        continue;
      }

      run('npm', [
        'publish',
        artifact.tarball,
        '--access',
        'public',
        '--tag',
        manifest.tag,
        '--ignore-scripts',
        '--registry',
        registry,
        '--provenance',
      ]);
    }

    // npm may hold accepted uploads for scanning. Upload the complete release
    // before waiting, and verify skipped existing versions against the same bytes.
    await verifyPublished(ordered, metadata, path.join(temporary, 'registry'));

    console.log(
      `Artifact publication complete: ${manifest.packages.length} package(s), ${manifest.sourceSha}`,
    );
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

async function main() {
  const options = parseReleaseOptions();

  if (options.publish) await publishArtifact(options.artifact!);
  else await prepareRelease(options);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.stack : error);
    process.exitCode = 1;
  });
}
