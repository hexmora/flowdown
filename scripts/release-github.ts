// Registry and GitHub mutations run in order; polling also deliberately awaits each request.
/* eslint-disable no-await-in-loop */
import read from '@changesets/read';
import { spawnSync } from 'node:child_process';
import {
  appendFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import semver from 'semver';

export const repository = 'hexmora/flowdown';
const releaseBranch = 'changeset-release/main';
const preparePath = '.github/workflows/prepare-release.yml';
const releasePath = '.github/workflows/release.yml';
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));

export interface Candidate {
  schemaVersion: 1;
  repository: string;
  baseSha: string;
  headSha: string;
  prepareRunId: string;
  prNumber: number;
  packages: { name: string; previousVersion: string; version: string }[];
}
interface PullRequest {
  number: number;
  body: string | null;
  merged_at: string | null;
  merge_commit_sha: string | null;
  base: { ref: string; sha: string; repo: { full_name: string } };
  head: { ref: string; sha: string; repo: { full_name: string } | null };
}
interface Run {
  id: number;
  path: string;
  event: string;
  head_branch: string;
  head_sha: string;
  conclusion: string | null;
  status: string;
  run_attempt: number;
  repository: { full_name: string };
}
interface Artifact {
  id: number;
  name: string;
  expired: boolean;
  size_in_bytes: number;
  workflow_run: { id: number; head_sha: string; head_branch: string };
}
interface ReleaseManifest {
  schemaVersion: number;
  repository: string;
  channel: 'stable' | 'beta';
  sourceSha: string;
  runId: string;
  runAttempt: string | number;
  publishable: boolean;
  packages: { name: string; version: string }[];
}
interface Event {
  before?: string;
  after?: string;
  inputs?: Record<string, string>;
}
interface Environment {
  id: number;
  name: string;
  protection_rules: {
    type: string;
    prevent_self_review?: boolean;
    reviewers?: { type: string; reviewer: { login?: string } }[];
  }[];
  deployment_branch_policy: { protected_branches: boolean; custom_branch_policies: boolean } | null;
}
interface Approval {
  state: string;
  user: { login: string; type: string };
  environments: { id: number; name: string }[];
}

export function validateEnvironment(
  environment: Environment,
  name: string,
  branches: { name: string; type: string }[],
) {
  assert(environment.name === name, 'Unexpected npm environment');
  const review = environment.protection_rules.find((rule) => rule.type === 'required_reviewers');
  assert(
    review?.prevent_self_review === false &&
      review.reviewers?.length === 1 &&
      review.reviewers[0]?.type === 'User' &&
      review.reviewers[0].reviewer.login === 'hexmora',
    `${name} must require hexmora's approval and allow manual self-review. Configure Settings → Environments.`,
  );
  assert(
    environment.deployment_branch_policy?.custom_branch_policies === true &&
      environment.deployment_branch_policy.protected_branches === false &&
      branches.length === 1 &&
      branches[0]?.name === 'main' &&
      branches[0].type === 'branch',
    `${name} must allow only the selected branch main, with no tag rules`,
  );
}
export function validateApproval(approvals: Approval[], environment: { name: string; id: number }) {
  assert(
    approvals.some(
      (review) =>
        review.state === 'approved' &&
        review.user.login === 'hexmora' &&
        review.user.type === 'User' &&
        review.environments.some(
          (item) => item.id === environment.id && item.name === environment.name,
        ),
    ),
    `This run has no explicit owner approval for ${environment.name}`,
  );
}
async function checkEnvironment(channel: 'stable' | 'beta') {
  const name = channel === 'stable' ? 'npm-production' : 'npm-beta';
  const environment = await api<Environment>(`/environments/${name}`);
  const policies = await api<{ branch_policies: { name: string; type: string }[] }>(
    `/environments/${name}/deployment-branch-policies?per_page=100`,
  );
  validateEnvironment(environment, name, policies.branch_policies);
  return environment;
}
async function verifyApproval() {
  requireMain();
  assert(process.env.GITHUB_RUN_ATTEMPT === '1', 'Start a new dispatch to obtain fresh approval');
  const channel = process.env.EXPECTED_RELEASE_CHANNEL;
  assert(channel === 'stable' || channel === 'beta', 'Invalid release channel');
  const environment = await checkEnvironment(channel);
  const reviews = await api<Approval[]>(`/actions/runs/${process.env.GITHUB_RUN_ID}/approvals`);
  validateApproval(reviews, environment);
  process.stdout.write(`Verified hexmora's approval for ${environment.name} in this run.\n`);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
function sha(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
}
function numeric(value: unknown): value is string {
  return typeof value === 'string' && /^[1-9]\d*$/.test(value);
}
function output(name: string, value: string) {
  assert(!/[\r\n]/.test(value), 'Invalid workflow output');
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
  process.stdout.write(`${name}=${value}\n`);
}
function git(...args: string[]) {
  const result = spawnSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  assert(result.status === 0, `git ${args[0]} failed: ${result.stderr}`);
  return result.stdout.trim();
}
function fetchCommit(commit: string) {
  assert(sha(commit), 'Expected a full commit SHA');
  git('fetch', '--no-tags', 'origin', commit);
}
function requireMain() {
  assert(process.env.GITHUB_ACTIONS === 'true', 'This command must run in GitHub Actions');
  assert(process.env.GITHUB_REPOSITORY === repository, 'Unexpected repository');
  assert(process.env.GITHUB_REF === 'refs/heads/main', 'Dispatch this workflow from main');
  assert(sha(process.env.GITHUB_SHA), 'Missing source SHA');
}
class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
async function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  assert(path.startsWith('/'), 'GitHub API path must be relative');
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  assert(token, 'GITHUB_TOKEN is required');
  const options: RequestInit = {
    method,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(30_000),
  };
  if (body !== undefined) {
    assert(method !== 'GET', 'GET requests cannot contain a body');
    options.body = JSON.stringify(body);
  }
  const response = await fetch(`https://api.github.com/repos/${repository}${path}`, options);
  if (!response.ok)
    throw new ApiError(response.status, `GitHub ${method} ${path}: ${response.status}`);
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}
async function artifactJSON<T>(artifact: Artifact, filename: string): Promise<T> {
  assert(!artifact.expired, 'Artifact expired; prepare a new release');
  assert(artifact.size_in_bytes <= 512 * 1024 * 1024, 'Artifact is too large');
  const response = await fetch(
    `https://api.github.com/repos/${repository}/actions/artifacts/${artifact.id}/zip`,
    {
      headers: { Authorization: `Bearer ${process.env.GH_TOKEN || process.env.GITHUB_TOKEN}` },
      signal: AbortSignal.timeout(120_000),
    },
  );
  assert(response.ok, `Artifact download failed: ${response.status}`);
  const directory = mkdtempSync(join(tmpdir(), 'flowdown-candidate-'));
  try {
    const zip = join(directory, 'artifact.zip');
    writeFileSync(zip, Buffer.from(await response.arrayBuffer()));
    const listing = spawnSync('unzip', ['-Z1', zip], { encoding: 'utf8' });
    assert(
      listing.status === 0 &&
        listing.stdout.split('\n').filter((item) => item === filename).length === 1,
      `Expected exactly one ${filename} in artifact`,
    );
    const extracted = spawnSync('unzip', ['-p', zip, filename], {
      encoding: 'utf8',
      maxBuffer: 8 * 1024 * 1024,
    });
    assert(extracted.status === 0, 'Cannot read artifact metadata');
    return JSON.parse(extracted.stdout) as T;
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

export function validateCandidate(
  value: Candidate,
  expected: {
    headSha: string;
    baseSha?: string;
    prNumber: number;
    prepareRunId?: string;
  },
) {
  assert(
    value.schemaVersion === 1 && value.repository === repository,
    'Invalid candidate schema/repository',
  );
  assert(sha(value.headSha) && sha(value.baseSha), 'Invalid candidate SHA');
  assert(
    value.headSha === expected.headSha && value.prNumber === expected.prNumber,
    'Candidate does not match PR',
  );
  if (expected.baseSha)
    assert(
      value.baseSha === expected.baseSha,
      'Release candidate is stale: run Prepare Release again',
    );
  assert(numeric(value.prepareRunId), 'Invalid prepare run');
  if (expected.prepareRunId)
    assert(value.prepareRunId === expected.prepareRunId, 'Candidate came from a different run');
  // Private-only version PRs have an empty public package list and never publish to npm.
  assert(Array.isArray(value.packages), 'Invalid release candidate package list');
  const names = new Set<string>();
  for (const pkg of value.packages) {
    assert(
      typeof pkg.name === 'string' && !names.has(pkg.name),
      'Duplicate/invalid candidate package',
    );
    names.add(pkg.name);
    assert(
      semver.valid(pkg.previousVersion) &&
        semver.valid(pkg.version) &&
        !semver.prerelease(pkg.version) &&
        semver.gt(pkg.version, pkg.previousVersion),
      `Invalid version bump: ${pkg.name}`,
    );
  }
}
export function isReleasePR(pr: PullRequest) {
  return (
    pr.base.ref === 'main' &&
    pr.base.repo.full_name === repository &&
    pr.head.ref === releaseBranch &&
    pr.head.repo?.full_name === repository
  );
}
export function validateRun(run: Run, path: string) {
  assert(
    run.repository.full_name === repository && run.path === path && run.head_branch === 'main',
    'Artifact was not generated by the trusted main workflow',
  );
  assert(sha(run.head_sha), 'Invalid workflow source');
}
export function validateResume(
  manifest: ReleaseManifest,
  artifact: Artifact,
  run: Run,
  channel: 'stable' | 'beta',
) {
  validateRun(run, releasePath);
  assert(
    artifact.workflow_run.id === run.id &&
      artifact.name === `release-${channel}-${run.id}` &&
      !artifact.expired,
    'Artifact does not belong to the selected release run/channel',
  );
  assert(
    manifest.schemaVersion === 1 &&
      manifest.repository === repository &&
      manifest.publishable === true,
    'Artifact is not a publishable release',
  );
  assert(
    manifest.channel === channel && sha(manifest.sourceSha) && manifest.sourceSha === run.head_sha,
    'Artifact source/channel mismatch',
  );
  assert(
    String(manifest.runId) === String(run.id) &&
      numeric(String(manifest.runAttempt)) &&
      Number(manifest.runAttempt) <= run.run_attempt,
    'Artifact run identity mismatch',
  );
  assert(
    run.event === (channel === 'stable' ? 'push' : 'workflow_dispatch'),
    'Unexpected original release event',
  );
}
function packagesAt(commit: string) {
  assert(sha(commit), 'Invalid manifest commit');
  const entries = git('ls-tree', '-r', '--name-only', commit, '--', 'packages')
    .split('\n')
    .filter((path) => /^packages\/[^/]+\/package\.json$/.test(path));
  return new Map(
    entries.map((path) => {
      const manifest = JSON.parse(git('show', `${commit}:${path}`)) as {
        name: string;
        version: string;
        private?: boolean;
      };
      return [manifest.name, { ...manifest, path }] as const;
    }),
  );
}
function verifyVersionDiff(candidate: Candidate, target: string) {
  const before = packagesAt(candidate.baseSha);
  const after = packagesAt(target);
  const allChanges = [...after.values()].filter(
    (pkg) => pkg.version !== before.get(pkg.name)?.version,
  );
  assert(
    allChanges.length > 0 &&
      allChanges.every(
        (pkg) =>
          semver.valid(pkg.version) &&
          semver.valid(before.get(pkg.name)?.version) &&
          !semver.prerelease(pkg.version) &&
          semver.gt(pkg.version, before.get(pkg.name)!.version),
      ),
    'Candidate must contain valid package version bumps',
  );
  const changed = [...after.values()]
    .filter((pkg) => !pkg.private && pkg.version !== before.get(pkg.name)?.version)
    .map((pkg) => ({
      name: pkg.name,
      previousVersion: before.get(pkg.name)?.version,
      version: pkg.version,
    }))
    .toSorted((a, b) => a.name.localeCompare(b.name));
  assert(
    JSON.stringify(changed) ===
      JSON.stringify([...candidate.packages].toSorted((a, b) => a.name.localeCompare(b.name))),
    'Versioned packages differ from the prepared candidate',
  );
  const paths = git('diff', '--name-only', candidate.baseSha, target).split('\n').filter(Boolean);
  assert(
    paths.every(
      (path) =>
        /^packages\/[^/]+\/(package\.json|CHANGELOG\.md)$/.test(path) ||
        path === 'pnpm-lock.yaml' ||
        /^\.changeset\/[^/]+\.md$/.test(path),
    ),
    'A version PR may only change package manifests, changelogs, lockfile and consumed changesets',
  );
  // Content identity survives merge/squash/rebase; unrelated source edits cannot enter the candidate.
  if (target !== candidate.headSha) {
    assert(
      git('rev-parse', `${target}^{tree}`) === git('rev-parse', `${candidate.headSha}^{tree}`),
      'Merged release tree differs from the reviewed candidate; prepare again',
    );
  }
}
async function candidateFor(pr: PullRequest, wait = false) {
  // PR CI can start before the preparation job finishes uploading its record.
  for (let attempt = 0; attempt < (wait ? 24 : 1); attempt++) {
    const result = await api<{ artifacts: Artifact[] }>(
      `/actions/artifacts?name=release-candidate-${pr.head.sha}&per_page=100`,
    );
    for (const artifact of result.artifacts.filter((item) => !item.expired)) {
      const run = await api<Run>(`/actions/runs/${artifact.workflow_run.id}`);
      validateRun(run, preparePath);
      assert(run.event === 'workflow_dispatch', 'Candidate must come from manual Prepare Release');
      if (run.conclusion !== 'success') continue;
      const candidate = await artifactJSON<Candidate>(artifact, 'candidate.json');
      validateCandidate(candidate, {
        headSha: pr.head.sha,
        prNumber: pr.number,
        prepareRunId: String(run.id),
      });
      assert(candidate.baseSha === run.head_sha, 'Candidate base does not match preparation run');
      return candidate;
    }
    if (wait && attempt < 23) await new Promise((resolveWait) => setTimeout(resolveWait, 5_000));
  }
  throw new Error(
    'Missing successful Prepare Release record for this PR head. Run Prepare Release again.',
  );
}
function saveCandidate(candidate: Candidate) {
  mkdirSync(join(root, '.release'), { recursive: true });
  writeFileSync(join(root, '.release/candidate.json'), `${JSON.stringify(candidate, null, 2)}\n`);
}
function argument(name: string) {
  const index = process.argv.indexOf(`--${name}`);
  assert(index !== -1 && process.argv[index + 1], `Missing --${name}`);
  return process.argv[index + 1]!;
}
async function prepareCheck() {
  requireMain();
  assert(
    process.env.GITHUB_EVENT_NAME === 'workflow_dispatch',
    'Prepare Release must be dispatched manually',
  );
  const mainRef = await api<{ object: { sha: string } }>('/git/ref/heads/main');
  assert(
    mainRef.object.sha === process.env.GITHUB_SHA,
    'Main advanced before preparation started; dispatch again',
  );
  assert(
    !(await read(root)).some((item) => item.releases.some((pkg) => pkg.type === 'none')),
    'Release changesets must contain real version bumps',
  );
  output('source-sha', process.env.GITHUB_SHA!);
  output('has-changesets', String((await read(root)).some((item) => item.releases.length > 0)));
}
async function recordCandidate() {
  requireMain();
  const prNumber = argument('pr-number');
  assert(numeric(prNumber), 'Invalid PR number');
  const pr = await api<PullRequest>(`/pulls/${prNumber}`);
  assert(isReleasePR(pr) && !pr.merged_at, 'Unexpected version PR');
  const baseSha = process.env.GITHUB_SHA!;
  fetchCommit(pr.head.sha);
  const before = packagesAt(baseSha);
  const candidate: Candidate = {
    schemaVersion: 1,
    repository,
    baseSha,
    headSha: pr.head.sha,
    prepareRunId: process.env.GITHUB_RUN_ID!,
    prNumber: pr.number,
    packages: [...packagesAt(pr.head.sha).values()]
      .filter((pkg) => !pkg.private && before.get(pkg.name)?.version !== pkg.version)
      .map((pkg) => ({
        name: pkg.name,
        previousVersion: before.get(pkg.name)?.version ?? '',
        version: pkg.version,
      })),
  };
  validateCandidate(candidate, { headSha: pr.head.sha, baseSha, prNumber: pr.number });
  verifyVersionDiff(candidate, pr.head.sha);
  const releases = pr.body?.match(/^# Releases\r?$/m);
  assert(releases?.index !== undefined, 'Version PR is missing release notes');
  await api(`/pulls/${prNumber}`, 'PATCH', {
    body: [
      'This PR was prepared manually by **Prepare release**. Merge after all required checks pass; publication then requires **hexmora** to approve **npm-production**. If main changes, run **Prepare release** again to refresh this PR.',
      pr.body!.slice(releases.index),
    ].join('\n\n'),
  });
  saveCandidate(candidate);
  output('head-sha', candidate.headSha);
}
async function checkCandidate() {
  const headSha = argument('head');
  const baseSha = argument('base');
  const number = argument('pr');
  assert(numeric(number) && sha(headSha) && sha(baseSha), 'Invalid PR comparison');
  const pr = await api<PullRequest>(`/pulls/${number}`);
  if (!isReleasePR(pr)) {
    process.stdout.write('Ordinary PR: no release candidate needed.\n');
    return;
  }
  assert(pr.head.sha === headSha, 'PR head changed; use its current CI run');
  const candidate = await candidateFor(pr, true);
  const mainRef = await api<{ object: { sha: string } }>('/git/ref/heads/main');
  validateCandidate(candidate, { headSha, baseSha: mainRef.object.sha, prNumber: pr.number });
  assert(baseSha === candidate.baseSha, 'PR base changed; refresh the version PR');
  fetchCommit(candidate.baseSha);
  fetchCommit(headSha);
  verifyVersionDiff(candidate, headSha);
}
async function resolveRelease() {
  requireMain();
  const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH!, 'utf8')) as Event;
  if (process.env.GITHUB_EVENT_NAME === 'push') {
    assert(event.after === process.env.GITHUB_SHA && sha(event.before), 'Unexpected push event');
    const pulls = await api<PullRequest[]>(`/commits/${event.after}/pulls?per_page=100`);
    const pr = pulls.find(
      (item) => isReleasePR(item) && item.merged_at && item.merge_commit_sha === event.after,
    );
    if (!pr) {
      output('mode', 'skip');
      return;
    }
    const candidate = await candidateFor(pr);
    validateCandidate(candidate, {
      headSha: pr.head.sha,
      baseSha: event.before,
      prNumber: pr.number,
    });
    fetchCommit(candidate.baseSha);
    fetchCommit(candidate.headSha);
    verifyVersionDiff(candidate, event.after!);
    if (candidate.packages.length === 0) {
      output('mode', 'skip');
      return;
    }
    await checkEnvironment('stable');
    saveCandidate(candidate);
    output('mode', 'prepare');
    output('channel', 'stable');
    output('source-sha', event.after!);
  } else {
    assert(process.env.GITHUB_EVENT_NAME === 'workflow_dispatch', 'Unsupported release trigger');
    const operation = event.inputs?.operation;
    if (operation === 'beta') {
      await checkEnvironment('beta');
      output('mode', 'prepare');
      output('channel', 'beta');
      output('source-sha', process.env.GITHUB_SHA!);
    } else {
      assert(
        operation === 'resume-stable' || operation === 'resume-beta',
        'Invalid release operation',
      );
      const channel = operation === 'resume-stable' ? 'stable' : 'beta';
      const runId = event.inputs?.run_id;
      const artifactId = event.inputs?.artifact_id;
      assert(
        numeric(runId) && numeric(artifactId),
        'Recovery needs original run_id and artifact_id',
      );
      const run = await api<Run>(`/actions/runs/${runId}`);
      const artifact = await api<Artifact>(`/actions/artifacts/${artifactId}`);
      const manifest = await artifactJSON<ReleaseManifest>(artifact, 'manifest.json');
      validateResume(manifest, artifact, run, channel);
      await checkEnvironment(channel);
      const jobs = await api<{ jobs: { name: string; conclusion: string | null }[] }>(
        `/actions/runs/${runId}/attempts/${manifest.runAttempt}/jobs?per_page=100`,
      );
      assert(
        jobs.jobs.some((job) => job.name === 'prepare' && job.conclusion === 'success'),
        'Original preparation did not succeed',
      );
      output('mode', 'resume');
      output('channel', channel);
      output('source-sha', manifest.sourceSha);
      output('artifact-id', artifactId);
      output('run-id', String(manifest.runId));
      output('run-attempt', String(manifest.runAttempt));
      return;
    }
  }
  output('run-id', process.env.GITHUB_RUN_ID!);
  output('run-attempt', process.env.GITHUB_RUN_ATTEMPT!);
}
async function finalize() {
  requireMain();
  const manifest = JSON.parse(
    readFileSync(join(resolve(argument('artifact')), 'manifest.json'), 'utf8'),
  ) as ReleaseManifest;
  assert(
    manifest.publishable && manifest.repository === repository && sha(manifest.sourceSha),
    'Invalid release manifest',
  );
  if (manifest.channel !== 'stable') return;
  assert(
    process.env.EXPECTED_RELEASE_SOURCE_SHA === manifest.sourceSha,
    'Unexpected release source',
  );
  fetchCommit(manifest.sourceSha);
  const packages = packagesAt(manifest.sourceSha);
  for (const pkg of manifest.packages) {
    const tag = `${pkg.name}@${pkg.version}`;
    const tagPath = encodeURIComponent(tag);
    try {
      const reference = await api<{ object: { sha: string; type: string } }>(
        `/git/ref/tags/${tagPath}`,
      );
      assert(
        reference.object.sha === manifest.sourceSha && reference.object.type === 'commit',
        `Tag ${tag} points elsewhere`,
      );
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 404) throw error;
      await api('/git/refs', 'POST', { ref: `refs/tags/${tag}`, sha: manifest.sourceSha });
    }
    try {
      await api(`/releases/tags/${tagPath}`);
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 404) throw error;
      const pkgPath = packages.get(pkg.name)?.path;
      assert(pkgPath, `Missing released package ${pkg.name}`);
      const changelog = git(
        'show',
        `${manifest.sourceSha}:${pkgPath.replace('package.json', 'CHANGELOG.md')}`,
      );
      const heading = new RegExp(`^## ${pkg.version.replaceAll('.', '\\.')}\\r?$`, 'm');
      const section = changelog.split(heading)[1]?.split(/^## /m)[0]?.trim();
      assert(section, `Missing changelog for ${tag}`);
      await api('/releases', 'POST', {
        tag_name: tag,
        target_commitish: manifest.sourceSha,
        name: tag,
        body: section,
        draft: false,
        prerelease: false,
        make_latest: 'false',
      });
    }
  }
}
export async function main() {
  switch (process.argv[2]) {
    case 'prepare-check':
      return prepareCheck();
    case 'record-candidate':
      return recordCandidate();
    case 'check-candidate':
      return checkCandidate();
    case 'resolve':
      return resolveRelease();
    case 'finalize':
      return finalize();
    case 'verify-approval':
      return verifyApproval();
    default:
      throw new Error(
        'Expected prepare-check, record-candidate, check-candidate, resolve, or finalize',
      );
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
