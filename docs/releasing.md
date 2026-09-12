# Releases

Use the Node.js version in `.node-version` and the pinned pnpm version.

## Versions

```sh
pnpm changeset
pnpm changeset:status
pnpm release:version
```

Review and commit the generated versions, changelogs, and lockfile before publishing stable packages from `main`.

## Publish

```sh
pnpm check
pnpm publish:dry-run
pnpm release -- --channel beta --package all --dry-run
pnpm release -- --channel stable --package @fluxdown/utils --publish
```

Use `--package all` or an exact npm package name. Commands default to dry run; `--publish` uploads.
Beta uses the `beta` tag and temporary versions; stable uses `latest` and the reviewed versions.
Single-package releases require their internal dependencies to exist on npm. Use `all` for the first release.
Already-published versions are rejected; after a partial release, publish the remaining packages individually.

## GitHub Actions

Open **Actions → Publish npm packages → Run workflow**. Choose the channel and package, then disable `dry_run` to publish.
Configure the `npm` environment and npm package ownership first. Trusted publishing must match repository `hexmora/flowdown`, workflow `release.yml`, environment `npm`, and allow `npm publish`. An optional `NPM_TOKEN` environment secret supports initial publication.

Dry runs verify package contents, Node/TypeScript consumers, and automatic browser CSS. Real uploads also verify the downloaded package contents.
Inspect tarballs and `manifest.json` under `.release/` or in the workflow artifacts.
