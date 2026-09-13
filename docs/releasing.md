# Releases

Use the Node.js version in `.node-version` and the pnpm version pinned in `package.json`.

## Development

Every PR that changes a package's `src/**` must add a new, nonempty Changeset
naming every affected package, including private packages. Select `patch`, `minor`,
or `major`. This also applies to source deletions, renames, refactors, and comments.

```sh
pnpm changeset
pnpm changeset:status
pnpm check
pnpm publish:dry-run
```

Commit the Changeset with the code. Do not manually bump versions or edit release
changelogs. The dry run builds and checks actual packages without publishing.

## Stable releases

1. Open **Actions → Prepare release → Run workflow** and choose `main` to create
   or refresh the version PR.
2. Review the versions, dependency updates, changelogs, and lockfile. All required
   checks must pass. If GitHub asks to approve the bot PR's workflows, approve CI.
3. Merge the version PR. **Publish npm packages** builds and verifies the packages
   from that merge's fixed commit SHA.
4. Review the workflow summary and packages. **@hexmora must manually approve** the
   `npm-production` environment, even when @hexmora prepared or merged the PR.
5. The approved packages are published to `latest`, followed by Git tags and
   GitHub Releases. A private-only version PR does not publish to npm.

If `main` advances before merge, run **Prepare release** again. Do not use
**Update branch** or manually edit the version PR. After merge, development may
continue: this release keeps its fixed SHA and prepared packages.

## Beta releases

Open **Actions → Publish npm packages → Run workflow**, choose `main`, and select
`operation: beta`. Leave `run_id` and `artifact_id` empty.

The workflow prepares all public packages, then waits for **@hexmora's manual
approval** in `npm-beta`. Beta versions include the version base and source commit.
They use the `beta` tag, leave `latest` unchanged, and preserve pending Changesets.

```sh
npm install fluxdown@beta
# Use the full version from the workflow summary to pin a particular build.
```

Starting a workflow or approving a PR does not approve publication. The owner may
approve their own run, but must still perform the environment approval manually.

## Resume an interrupted publication

1. Find the original **Publish npm packages** run and its release artifact. Copy
   the numeric **run ID** and **artifact ID**.
2. Start a new run from `main`, select `resume-stable` or `resume-beta`, and enter
   those IDs in `run_id` and `artifact_id`.
3. Review the original packages and obtain a **new owner environment approval**.
   Already-published matching versions are skipped; missing versions are uploaded.

Use a new workflow run, not **Re-run jobs**. If the artifact expired, prepare a new
release. Avoid starting several publications at once.

## GitHub and npm setup

Before the first publication, the owner must configure:

- Allow GitHub Actions to create pull requests. Protect `main` with PR review and
  required checks: `changeset-coverage`, `package-quality`, and `release-candidate`.
- Create `npm-production` and `npm-beta` environments. Set `hexmora` as the required
  reviewer, allow self-review, disable administrator bypass, and allow only `main`.
- For each npm package, configure Trusted Publishing for `hexmora/flowdown`,
  workflow `release.yml`, and each of the two environment names. Remove old CI
  publishing tokens. New package names need npm ownership and setup first.

For new names, set a one-day, publish-capable `NPM_BOOTSTRAP_TOKEN` secret only in
`npm-beta` and dispatch `operation: beta` with `bootstrap: true`; the same package
checks and explicit owner approval apply. Use `bootstrap: true` with `resume-beta`
if this initial publication needs recovery.
After the first beta, configure both trusted publishers with direct publishing
allowed, revoke the token, and delete the secret; normal releases use OIDC only.

References: [Changesets](https://changesets.dev/guide/automating),
[GitHub environments](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments),
[npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers/).
