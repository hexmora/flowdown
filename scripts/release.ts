/* eslint-disable no-await-in-loop -- Packing and publishing must follow dependency order; registry retries are sequential. */
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

import type { PackageArtifact, WorkspacePackage } from './types.ts';

import { checkBrowserConsumer } from './check-browser.ts';
import { checkPackage, publicEntries, readManifest } from './check-package.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const registry = 'https://registry.npmjs.org/';

const dependencyFields = ['dependencies', 'optionalDependencies', 'peerDependencies'] as const;

function parseOptions() {
  const { values } = parseArgs({
    args: process.argv.slice(2).filter((argument) => argument !== '--'),
    options: {
      channel: { type: 'string', default: 'stable' },
      package: { type: 'string', default: 'all' },
      'dry-run': { type: 'boolean', default: false },
      publish: { type: 'boolean', default: false },
      'skip-build': { type: 'boolean', default: false },
    },
  });

  assert(
    values.channel === 'stable' || values.channel === 'beta',
    'Channel must be stable or beta',
  );

  assert(!(values.publish && values['dry-run']), 'Cannot combine --dry-run and --publish');

  assert(!values.publish || !values['skip-build'], '--skip-build is only allowed for dry runs');

  return {
    channel: values.channel,
    package: values.package,
    dryRun: !values.publish,
    skipBuild: values['skip-build'],
  };
}

function topologicalPackages(packages: WorkspacePackage[]): WorkspacePackage[] {
  const byName = new Map(packages.map((pkg) => [pkg.manifest.name, pkg]));

  const result: WorkspacePackage[] = [];

  const active = new Set<string>();

  const done = new Set<string>();

  function visit(pkg: WorkspacePackage): void {
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
  }: { cwd?: string; capture?: boolean; allowFailure?: boolean } = {},
) {
  console.log(`> ${command} ${args.join(' ')}`);

  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: capture ? 'pipe' : 'inherit',
    env: {
      ...process.env,
      npm_config_registry: registry,
    },
    timeout: 600_000,
    maxBuffer: 16 * 1024 * 1024,
  });

  if (!allowFailure && (result.error || result.status !== 0)) {
    throw new Error(
      `${command} failed (${result.status}): ${result.error?.message ?? ''}\n${result.stderr ?? ''}\n${result.stdout ?? ''}`,
    );
  }

  return result;
}

async function workspacePackages() {
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

    if (!manifest) continue;

    if (!manifest.private) packages.push({ directory, source, manifest });
  }

  return topologicalPackages(packages);
}

async function unpack(tarball: string, destination: string) {
  await mkdir(destination, { recursive: true });

  // Both inputs are pnpm/npm-produced archives; reject paths escaping the extraction directory.
  const entries = run('tar', ['-tzf', tarball], { capture: true }).stdout.trim().split('\n');

  assert(
    entries.every((entry) => entry.startsWith('package/') && !entry.split('/').includes('..')),
    `Unsafe archive: ${tarball}`,
  );

  run('tar', ['-xzf', tarball, '-C', destination]);

  return checkPackage(path.join(destination, 'package'));
}

async function registryVersion(specifier: string): Promise<boolean> {
  const result = run('npm', ['view', specifier, 'version', '--json', '--registry', registry], {
    capture: true,
    allowFailure: true,
  });

  if (result.status === 0) return Boolean(result.stdout.trim());

  if (/E404|404 Not Found/.test(`${result.stderr}\n${result.stdout}`)) return false;

  throw new Error(
    `Cannot verify npm registry state for ${specifier}: ${result.stderr || result.error?.message}`,
  );
}

async function validateDependencies(
  selected: PackageArtifact[],
  packages: WorkspacePackage[],
  dryRun: boolean,
) {
  const byName = new Map(selected.map((artifact) => [artifact.manifest.name, artifact]));

  const workspaceNames = new Set(packages.map((pkg) => pkg.manifest.name));

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
          const available = await registryVersion(`${name}@${range}`);

          assert(
            available,
            `${artifact.manifest.name} requires unpublished ${name}@${range}. Publish the dependency first, or select all packages.`,
          );
        }
      }
    }

    if (!dryRun) {
      const existing = await registryVersion(
        `${artifact.manifest.name}@${artifact.manifest.version}`,
      );

      assert(
        !existing,
        `${artifact.manifest.name}@${artifact.manifest.version} already exists; version packages before publishing`,
      );
    }
  }
}

async function verifyConsumer(artifacts: PackageArtifact[]) {
  const consumer = await mkdtemp(path.join(tmpdir(), 'fluxdown-consumer-'));

  try {
    await writeFile(
      path.join(consumer, 'package.json'),
      JSON.stringify({ name: 'fluxdown-consumer-check', private: true, type: 'module' }),
    );

    run(
      'npm',
      [
        'install',
        '--ignore-scripts',
        '--no-audit',
        '--no-fund',
        '--no-package-lock',
        ...artifacts.map((artifact) => artifact.tarball),
        'react@18.3.1',
        'react-dom@18.3.1',
        '@types/react@18',
        '@types/react-dom@18',
      ],
      { cwd: consumer },
    );

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

async function verifyPublished(artifact: PackageArtifact, destination: string) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const specifier = `${artifact.manifest.name}@${artifact.manifest.version}`;

    const result = run(
      'npm',
      [
        'pack',
        specifier,
        '--ignore-scripts',
        '--pack-destination',
        destination,
        '--json',
        '--registry',
        registry,
      ],
      { capture: true, allowFailure: true },
    );

    if (result.status === 0) {
      const [{ filename }] = JSON.parse(result.stdout) as { filename: string }[];

      const remote = await unpack(
        path.join(destination, filename),
        path.join(destination, `unpacked-${artifact.directory}`),
      );

      assert.equal(
        remote.contentHash,
        artifact.contentHash,
        `${specifier}: published contents differ from the verified archive`,
      );

      console.log(`Published package verified: ${specifier}`);

      return;
    }

    if (attempt === 4)
      throw new Error(`Published package could not be downloaded: ${specifier}\n${result.stderr}`);

    await new Promise((resolve) => setTimeout(resolve, (attempt + 1) * 3000));
  }
}

async function main() {
  const options = parseOptions();

  const packages = await workspacePackages();

  const selectedNames = new Set(
    packages
      .filter((pkg) => options.package === 'all' || pkg.manifest.name === options.package)
      .map((pkg) => pkg.manifest.name),
  );

  assert(selectedNames.size, `Unknown package: ${options.package}`);

  if (!options.dryRun) {
    assert(
      !run('git', ['status', '--porcelain'], { capture: true }).stdout.trim(),
      'Publishing requires a clean checkout of reviewed code',
    );

    if (options.channel === 'stable') {
      const branch =
        process.env.GITHUB_ACTIONS === 'true'
          ? process.env.GITHUB_REF
          : run('git', ['branch', '--show-current'], { capture: true }).stdout.trim();

      assert(
        branch === 'main' || branch === 'refs/heads/main',
        'Stable publication must run from main',
      );

      for (const pkg of packages.filter((candidate) =>
        selectedNames.has(candidate.manifest.name),
      )) {
        assert(
          !semver.prerelease(pkg.manifest.version),
          `Stable version cannot be a prerelease: ${pkg.manifest.name}`,
        );

        const changelog = await readFile(path.join(pkg.source, 'CHANGELOG.md'), 'utf8').catch(
          () => '',
        );

        assert(
          changelog.includes(`## ${pkg.manifest.version}\n`),
          `${pkg.manifest.name}: run pnpm release:version and review the version/changelog changes first`,
        );
      }
    }
  }

  if (!options.skipBuild) run('pnpm', ['build']);

  const stamp = new Date().toISOString().replace(/\D/g, '');

  const sha = run('git', ['rev-parse', '--short=8', 'HEAD'], { capture: true }).stdout.trim();

  const suffix = `${stamp}.s${sha}.r${randomBytes(3).toString('hex')}`;

  const output = path.join(root, '.release', `${options.channel}-${suffix}`);

  const stage = path.join(output, 'workspace');

  const tarballs = path.join(output, 'tarballs');

  await mkdir(tarballs, { recursive: true });

  await mkdir(stage, { recursive: true });

  for (const filename of ['package.json', 'pnpm-workspace.yaml', 'LICENSE'])
    await cp(path.join(root, filename), path.join(stage, filename));

  await mkdir(path.join(stage, 'scripts'));

  await cp(
    path.join(root, 'scripts/check-package.ts'),
    path.join(stage, 'scripts/check-package.ts'),
  );

  await cp(path.join(root, 'scripts/types.ts'), path.join(stage, 'scripts/types.ts'));

  const releasePlan = path.join(output, 'changesets.json');

  // A versioned checkout legitimately has no pending changesets. The status CLI
  // additionally checks Git changes and rejects that state before writing a plan.
  let plan: { releases: { name: string; newVersion: string }[] } = { releases: [] };

  if ((await readChangesets(root)).length > 0) {
    run('pnpm', ['exec', 'changeset', 'status', '--output', releasePlan]);

    plan = JSON.parse(await readFile(releasePlan, 'utf8')) as typeof plan;
  } else {
    await writeFile(releasePlan, JSON.stringify(plan, null, 2) + '\n');
  }

  if (!options.dryRun && options.channel === 'stable') {
    assert(
      !plan.releases.some((release) => selectedNames.has(release.name)),
      'Selected packages still have pending changesets; version and review them first',
    );
  }

  const stagedVersions = new Map(
    packages.map(({ manifest }) => {
      if (options.channel !== 'beta' || !selectedNames.has(manifest.name))
        return [manifest.name, manifest.version];

      const calculated =
        plan.releases.find((release) => release.name === manifest.name)?.newVersion ??
        manifest.version;

      return [
        manifest.name,
        `${semver.major(calculated)}.${semver.minor(calculated)}.${semver.patch(calculated)}-beta.${suffix}`,
      ];
    }),
  );

  for (const pkg of packages) {
    const destination = path.join(stage, 'packages', pkg.directory);

    await mkdir(destination, { recursive: true });

    for (const filename of await readdir(pkg.source)) {
      if (filename === 'dist' || /^(readme|license|changelog)(\..*)?$/i.test(filename))
        await cp(path.join(pkg.source, filename), path.join(destination, filename), {
          recursive: true,
        });
    }

    await cp(path.join(root, 'LICENSE'), path.join(destination, 'LICENSE'));

    const manifest = structuredClone(pkg.manifest);

    manifest.version = stagedVersions.get(manifest.name) ?? manifest.version;

    for (const field of dependencyFields) {
      const dependencies = manifest[field] ?? {};

      for (const [name, range] of Object.entries(dependencies)) {
        const version = stagedVersions.get(name);

        if (!version) continue;

        assert(
          range.startsWith('workspace:'),
          `${manifest.name}: internal ${name} must use workspace protocol`,
        );

        const prefix = semver.prerelease(version)
          ? ''
          : (range.slice('workspace:'.length).match(/^[~^]/)?.[0] ?? '');

        // Explicit workspace versions let pnpm pack normalize the protocol without a staging install.
        dependencies[name] = `workspace:${prefix}${version}`;
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

    run('pnpm', ['pack', '--out', tarball], { cwd: path.join(stage, 'packages', pkg.directory) });

    artifacts.push({
      ...(await unpack(tarball, path.join(output, 'unpacked', pkg.directory))),
      directory: pkg.directory,
      tarball,
    });
  }

  await validateDependencies(artifacts, packages, options.dryRun);

  const verification = await verifyConsumer(artifacts);

  const tag = options.channel === 'beta' ? 'beta' : 'latest';

  const report = {
    channel: options.channel,
    dryRun: options.dryRun,
    tag,
    commit: sha,
    verification,
    packages: artifacts.map(({ manifest, files, contentHash, tarball }) => ({
      name: manifest.name,
      version: manifest.version,
      tarball: path.relative(root, tarball),
      files,
      contentHash,
    })),
  };

  await writeFile(path.join(output, 'manifest.json'), JSON.stringify(report, null, 2) + '\n');

  await mkdir(path.join(output, 'registry'), { recursive: true });

  for (const artifact of artifacts) {
    const args = [
      'publish',
      artifact.tarball,
      '--access',
      'public',
      '--tag',
      tag,
      '--ignore-scripts',
      '--registry',
      registry,
    ];

    if (options.dryRun) args.push('--dry-run');
    else if (process.env.GITHUB_ACTIONS === 'true') args.push('--provenance');

    run('npm', args);

    if (!options.dryRun) await verifyPublished(artifact, path.join(output, 'registry'));
  }

  console.log(
    `${options.dryRun ? 'Publish dry run' : 'Publication'} complete: ${artifacts.length} package(s). Review ${path.relative(root, output)}/manifest.json`,
  );

  await rm(stage, { recursive: true, force: true });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.stack : error);

    process.exitCode = 1;
  });
}
