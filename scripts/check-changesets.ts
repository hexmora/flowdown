/* eslint-disable no-console -- The CI entry point reports actionable coverage failures. */
import { parseChangesetFile } from '@changesets/parse';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import semver from 'semver';
import { parse as parseYaml } from 'yaml';

export interface SnapshotFile {
  mode: string;
  objectId: string;
  contents?: string;
}

/** Paths and metadata come from a Git tree, never from the mutable checkout. */
export type CoverageSnapshot = ReadonlyMap<string, SnapshotFile>;

export interface FileChange {
  status: string;
  oldPath?: string;
  newPath?: string;
}

export interface CoverageIssue {
  code:
    | 'invalid-workspace'
    | 'invalid-package-migration'
    | 'package-retirement-required'
    | 'invalid-changeset'
    | 'missing-changeset';
  message: string;
  packageName?: string;
  paths: string[];
}

export interface CoverageResult {
  changedPackages: string[];
  coveredPackages: string[];
  changesetFiles: string[];
  issues: CoverageIssue[];
}

interface PackageRoot {
  name: string;
  root: string;
}

const regularFileModes = new Set(['100644', '100755']);
const bumpTypes = new Set(['patch', 'minor', 'major']);
const migrationsFile = '.changeset/package-migrations.json';

export function isChangesetPath(file: string): boolean {
  const match = /^\.changeset\/([^/]+\.md)$/.exec(file);

  if (!match) return false;

  const name = match[1];

  return (
    !name.startsWith('.') &&
    !/^README\.md$/i.test(name) &&
    !['AGENTS.md', 'CLAUDE.md', 'GEMINI.md'].includes(name)
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function readText(snapshot: CoverageSnapshot, file: string): string {
  const entry = snapshot.get(file);

  if (!entry || !regularFileModes.has(entry.mode) || entry.contents === undefined) {
    throw new Error(`${file} must be a regular, readable file`);
  }

  return entry.contents;
}

function discoverPackages(
  snapshot: CoverageSnapshot,
  label: string,
  issues: CoverageIssue[],
): PackageRoot[] {
  const configFile = 'pnpm-workspace.yaml';
  let patterns: string[];

  try {
    const config: unknown = parseYaml(readText(snapshot, configFile));

    if (!object(config)) throw new Error('pnpm-workspace.yaml must contain a mapping');

    const configuredPatterns = config.packages ?? ['**'];

    if (
      !Array.isArray(configuredPatterns) ||
      configuredPatterns.some((pattern) => typeof pattern !== 'string' || !pattern.trim())
    ) {
      throw new Error('pnpm-workspace.yaml packages must be an array of nonempty globs');
    }

    patterns = configuredPatterns.map((pattern: string) =>
      pattern.replace(/^\.\//, '').replace(/\/$/, ''),
    );
  } catch (error) {
    issues.push({
      code: 'invalid-workspace',
      paths: [configFile],
      message: `${label}: ${errorMessage(error)}`,
    });

    return [];
  }

  const included = patterns.filter((pattern) => !pattern.startsWith('!'));
  const excluded = patterns
    .filter((pattern) => pattern.startsWith('!'))
    .map((pattern) => pattern.slice(1));
  const packages: PackageRoot[] = [];
  const seenNames = new Set<string>();

  for (const file of [...snapshot.keys()].toSorted()) {
    if (
      !file.endsWith('/package.json') ||
      file.split('/').some((part) => ['node_modules', '.git', 'bower_components'].includes(part))
    )
      continue;

    const root = path.posix.dirname(file);

    if (
      !included.some((pattern) => path.posix.matchesGlob(root, pattern)) ||
      excluded.some((pattern) => path.posix.matchesGlob(root, pattern))
    )
      continue;

    try {
      const manifest: unknown = JSON.parse(readText(snapshot, file));

      if (
        !object(manifest) ||
        typeof manifest.name !== 'string' ||
        !manifest.name.trim() ||
        manifest.name !== manifest.name.trim() ||
        /\s/.test(manifest.name) ||
        typeof manifest.version !== 'string' ||
        !semver.valid(manifest.version)
      ) {
        throw new Error(
          `${file} must contain a package name and a valid version, including private packages`,
        );
      }

      if (seenNames.has(manifest.name))
        throw new Error(`Duplicate workspace package name: ${manifest.name}`);

      seenNames.add(manifest.name);
      packages.push({ name: manifest.name, root });
    } catch (error) {
      issues.push({
        code: 'invalid-workspace',
        paths: [file],
        message: `${label}: ${errorMessage(error)}`,
      });
    }
  }

  // Resolve ownership before checking src, so a nested package's README is not
  // mistaken for source belonging to an enclosing package.
  return packages.toSorted((left, right) => right.root.length - left.root.length);
}

function migrationEndpoint(value: unknown): value is { name: string; directory: string } {
  return (
    object(value) &&
    typeof value.name === 'string' &&
    value.name.trim() === value.name &&
    value.name.length > 0 &&
    typeof value.directory === 'string' &&
    value.directory.length > 0 &&
    value.directory !== '.' &&
    !value.directory.startsWith('/') &&
    !value.directory.includes('\\') &&
    !value.directory.split('/').some((part) => part === '..' || part === '.' || part === '')
  );
}

function readMigrations(
  head: CoverageSnapshot,
  basePackages: PackageRoot[],
  headPackages: PackageRoot[],
  issues: CoverageIssue[],
): Map<string, string> {
  const migrations = new Map<string, string>();

  if (!head.has(migrationsFile)) return migrations;

  try {
    const config: unknown = JSON.parse(readText(head, migrationsFile));

    if (!object(config) || config.version !== 1 || !Array.isArray(config.migrations)) {
      throw new Error(
        'Expected { "version": 1, "migrations": [{ "from": { "name", "directory" }, "to": { "name", "directory" } }] }',
      );
    }

    const fromNames = new Set<string>();
    const activeTargets = new Set<string>();

    for (const entry of config.migrations) {
      if (
        !object(entry) ||
        !migrationEndpoint(entry.from) ||
        !migrationEndpoint(entry.to) ||
        entry.from.name === entry.to.name
      ) {
        throw new Error(
          'Each migration must map distinct package names and exact relative package directories',
        );
      }

      if (fromNames.has(entry.from.name))
        throw new Error(`Duplicate migration for ${entry.from.name}`);

      fromNames.add(entry.from.name);

      const from = entry.from;
      const to = entry.to;
      const previous = basePackages.find((pkg) => pkg.name === from.name);

      // Keep historical migration records without affecting later PRs, whose
      // merge-base already contains the destination identity.
      if (!previous) continue;

      if (previous.root !== from.directory)
        throw new Error(`Migration source does not match base: ${from.name} at ${from.directory}`);

      if (headPackages.some((pkg) => pkg.name === from.name)) continue;

      if (
        basePackages.some((pkg) => pkg.name === to.name) ||
        !headPackages.some((pkg) => pkg.name === to.name && pkg.root === to.directory)
      ) {
        throw new Error(
          `Migration destination must be a new head package: ${to.name} at ${to.directory}`,
        );
      }

      if (activeTargets.has(to.name)) throw new Error(`Multiple migrations target ${to.name}`);

      activeTargets.add(to.name);
      migrations.set(from.name, to.name);
    }
  } catch (error) {
    issues.push({
      code: 'invalid-package-migration',
      paths: [migrationsFile],
      message: `${migrationsFile}: ${errorMessage(error)}`,
    });
    migrations.clear();
  }

  return migrations;
}

/** Pure coverage policy; callers can supply synthetic snapshots and file changes. */
export function evaluateCoverage(input: {
  base: CoverageSnapshot;
  head: CoverageSnapshot;
  changes: readonly FileChange[];
}): CoverageResult {
  const issues: CoverageIssue[] = [];
  const basePackages = discoverPackages(input.base, 'merge-base', issues);
  const headPackages = discoverPackages(input.head, 'head', issues);
  const headNames = new Set(headPackages.map((pkg) => pkg.name));
  const migrations = readMigrations(input.head, basePackages, headPackages, issues);

  for (const pkg of basePackages) {
    if (!headNames.has(pkg.name) && !migrations.has(pkg.name)) {
      issues.push({
        code: 'package-retirement-required',
        packageName: pkg.name,
        paths: [`${pkg.root}/package.json`],
        message: `${pkg.name} was removed, renamed, or moved out of the workspace; define and review its retirement separately`,
      });
    }
  }

  const sourceChanges = new Map<string, Set<string>>();
  const recordSource = (file: string | undefined, packages: PackageRoot[], previous = false) => {
    if (!file) return;

    const owner = packages.find((pkg) => file.startsWith(`${pkg.root}/`));

    if (!owner || !file.startsWith(`${owner.root}/src/`)) return;

    const name = previous ? (migrations.get(owner.name) ?? owner.name) : owner.name;
    const paths = sourceChanges.get(name) ?? new Set<string>();

    paths.add(file);
    sourceChanges.set(name, paths);
  };

  for (const change of input.changes) {
    recordSource(change.oldPath, basePackages, true);
    recordSource(change.newPath, headPackages);
  }

  const oldChangesetObjects = new Set(
    [...input.base].filter(([file]) => isChangesetPath(file)).map(([, entry]) => entry.objectId),
  );
  const covered = new Set<string>();
  const changesetFiles: string[] = [];

  for (const change of input.changes) {
    const file = change.newPath;

    if (change.status !== 'A' || !file || !isChangesetPath(file) || input.base.has(file)) continue;

    const entry = input.head.get(file);

    // An unchanged old changeset copied or moved to a new path is not a new
    // release note, even if Git's rename detection classified it as an add.
    if (entry && oldChangesetObjects.has(entry.objectId)) continue;

    try {
      const parsed = parseChangesetFile(readText(input.head, file));

      if (!parsed.summary.trim() || parsed.releases.length === 0) {
        throw new Error(
          'A new changeset must have a nonempty summary and at least one package bump',
        );
      }

      for (const release of parsed.releases) {
        if (!headNames.has(release.name) || !bumpTypes.has(release.type)) {
          throw new Error(
            `Invalid release ${release.name}: ${release.type}; use an existing workspace package with patch, minor, or major`,
          );
        }
      }

      changesetFiles.push(file);
      parsed.releases.forEach((release) => covered.add(release.name));
    } catch (error) {
      issues.push({
        code: 'invalid-changeset',
        paths: [file],
        message: `${file}: ${errorMessage(error)}`,
      });
    }
  }

  for (const [name, paths] of sourceChanges) {
    if (!covered.has(name)) {
      issues.push({
        code: 'missing-changeset',
        packageName: name,
        paths: [...paths].toSorted(),
        message: `${name} has src changes without a new changeset declaring patch, minor, or major; run pnpm changeset and select ${name}`,
      });
    }
  }

  return {
    changedPackages: [...sourceChanges.keys()].toSorted(),
    coveredPackages: [...covered].toSorted(),
    changesetFiles: changesetFiles.toSorted(),
    issues,
  };
}

function git(cwd: string, args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

function resolveCommit(cwd: string, sha: string): string {
  if (!/^[a-f\d]{7,64}$/i.test(sha))
    throw new Error('Pass a pinned commit SHA for --base and --head, not a branch name');

  return git(cwd, ['rev-parse', '--verify', `${sha}^{commit}`]).trim();
}

function readSnapshot(cwd: string, sha: string): CoverageSnapshot {
  const snapshot = new Map<string, SnapshotFile>();

  for (const record of git(cwd, ['ls-tree', '-r', '-z', '--full-tree', sha])
    .split('\0')
    .filter(Boolean)) {
    const separator = record.indexOf('\t');
    const [mode, , objectId] = record.slice(0, separator).split(' ');
    const file = record.slice(separator + 1);
    const needsContents =
      file === 'pnpm-workspace.yaml' ||
      file === migrationsFile ||
      file.endsWith('/package.json') ||
      isChangesetPath(file);

    snapshot.set(file, {
      mode,
      objectId,
      ...(needsContents && regularFileModes.has(mode)
        ? { contents: git(cwd, ['cat-file', 'blob', objectId]) }
        : {}),
    });
  }

  return snapshot;
}

export function parseGitChanges(output: string): FileChange[] {
  const fields = output.split('\0');
  const changes: FileChange[] = [];

  if (fields.at(-1) === '') fields.pop();

  for (let index = 0; index < fields.length; ) {
    const status = fields[index++];
    const first = fields[index++];

    if (!first || !/^[ACDMRTUXB]\d*$/.test(status))
      throw new Error('Invalid Git name-status output');

    if (status.startsWith('R') || status.startsWith('C')) {
      const second = fields[index++];

      if (!second) throw new Error('Missing destination in Git rename/copy output');

      changes.push({ status, oldPath: first, newPath: second });
    } else {
      changes.push({
        status,
        ...(status !== 'A' ? { oldPath: first } : {}),
        ...(status !== 'D' ? { newPath: first } : {}),
      });
    }
  }

  return changes;
}

export function checkGitCoverage(options: {
  cwd: string;
  base: string;
  head: string;
}): CoverageResult & { mergeBase: string; head: string } {
  const base = resolveCommit(options.cwd, options.base);
  const head = resolveCommit(options.cwd, options.head);
  const mergeBases = git(options.cwd, ['merge-base', '--all', base, head]).trim().split('\n');

  if (mergeBases.length !== 1 || !mergeBases[0])
    throw new Error(
      'Expected one merge-base; fetch complete history and resolve ambiguous ancestry',
    );

  const mergeBase = mergeBases[0];
  const changes = parseGitChanges(
    git(options.cwd, [
      'diff',
      '--no-ext-diff',
      '--no-textconv',
      '--name-status',
      '-z',
      '--find-renames',
      mergeBase,
      head,
      '--',
    ]),
  );

  return {
    ...evaluateCoverage({
      base: readSnapshot(options.cwd, mergeBase),
      head: readSnapshot(options.cwd, head),
      changes,
    }),
    mergeBase,
    head,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { values } = parseArgs({
      options: { base: { type: 'string' }, head: { type: 'string' } },
    });

    if (!values.base || !values.head)
      throw new Error('Usage: tsx scripts/check-changesets.ts --base <SHA> --head <SHA>');

    const result = checkGitCoverage({ cwd: process.cwd(), base: values.base, head: values.head });

    for (const issue of result.issues) {
      console.error(`[${issue.code}] ${issue.message}\n  ${issue.paths.join('\n  ')}`);
    }

    if (result.issues.length) process.exitCode = 1;
    else
      console.log(
        `Changeset coverage OK: ${result.changedPackages.length} source package(s), ${result.changesetFiles.length} new changeset(s)`,
      );
  } catch (error) {
    console.error(errorMessage(error));
    process.exitCode = 1;
  }
}
