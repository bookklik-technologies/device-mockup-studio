# Manual npm publishing

Nothing in release preparation publishes to npm. The root workspace remains private. Seven ESM packages are public-release candidates at version 0.3.0; each includes declarations, maps, sources, README, MIT license, and third-party notices. The SDK exports both `.` and `./headless`.

## Prerequisites

- Node.js 22+ and the pinned package manager (`pnpm@10.34.7`).
- An npm account allowed to publish all packages under the `@mockup-studio` scope. These settings do not reserve the scope or grant ownership. If you do not own it, rename the scope consistently in manifests, TypeScript paths, imports, examples and docs before building.
- Confirm each intended version is unused on npm. For subsequent releases update all seven package versions together; keep workspace dependencies as `workspace:^` and regenerate `pnpm-lock.yaml` when dependency changes require it.
- Review licenses, asset notices, API compatibility and changelog. Existing consumer compatibility has not been certified for every browser; see the root README.

## Prepare without publishing

```sh
pnpm install --frozen-lockfile
pnpm release:prepare
```

This runs typechecking, the production build, `pnpm pack` for every package, and archive validation. It deliberately does **not** run unit or browser tests or use npm credentials. Run tests only after obtaining the required approval for this repository.

Tarballs are written to `artifacts/packages`. `release-manifest.json` records their exact filenames, versions, sizes and SHA-256 hashes. Archive validation checks public publishing metadata, ESM/type export targets, packaged source-map sources, notices, and resolved internal dependency versions. `pnpm pack` converts `workspace:^` to the matching publishable `^0.3.0` dependency ranges. Do not use `npm pack` directly against the workspace package directories: npm does not perform pnpm's workspace-protocol rewriting.

To revalidate existing archives use `pnpm release:validate`. Rebuild/repack after source or version edits; validation of existing archives alone does not establish source freshness. Old-version archives may remain in the directory; publish only the exact filenames from the latest release manifest.

## Inspect and try locally

```sh
npm publish artifacts/packages/mockup-studio-sdk-0.3.0.tgz --dry-run --access public
```

Repeat the dry run for every tarball and inspect its file list. No package is published by `--dry-run`. In an empty consumer project, install **all seven tarballs in one command** so unpublished internal dependencies resolve locally:

```sh
npm install /absolute/path/to/artifacts/packages/mockup-studio-core-0.3.0.tgz /absolute/path/to/artifacts/packages/mockup-studio-presets-0.3.0.tgz /absolute/path/to/artifacts/packages/mockup-studio-render-0.3.0.tgz /absolute/path/to/artifacts/packages/mockup-studio-spatial-0.3.0.tgz /absolute/path/to/artifacts/packages/mockup-studio-media-0.3.0.tgz /absolute/path/to/artifacts/packages/mockup-studio-editor-0.3.0.tgz /absolute/path/to/artifacts/packages/mockup-studio-sdk-0.3.0.tgz
```

Then verify your intended Node/browser integration and TypeScript module resolution. `@mockup-studio/sdk/headless` must import without a browser document and must not pull editor/Three.js code into the runtime import graph. It still belongs to the umbrella package, whose declared dependencies are installed; choose individual packages for minimal dependency installation. Node rendering needs an explicit canvas/encoder adapter. CommonJS `require` is not an advertised entry point.

## Publish manually, in dependency order

Log in yourself (`npm login`) and verify the account (`npm whoami`). Publish the prepared tarballs, not the private workspace root. With the initial version unchanged, run these commands one at a time and confirm success before proceeding:

```sh
npm publish artifacts/packages/mockup-studio-core-0.3.0.tgz --access public
npm publish artifacts/packages/mockup-studio-presets-0.3.0.tgz --access public
npm publish artifacts/packages/mockup-studio-render-0.3.0.tgz --access public
npm publish artifacts/packages/mockup-studio-spatial-0.3.0.tgz --access public
npm publish artifacts/packages/mockup-studio-media-0.3.0.tgz --access public
npm publish artifacts/packages/mockup-studio-editor-0.3.0.tgz --access public
npm publish artifacts/packages/mockup-studio-sdk-0.3.0.tgz --access public
```

Wait for dependencies to become available on the registry before publishing their dependents. Complete npm's interactive authentication/2FA requirements yourself. Never put credentials in repository files. Published name/version pairs cannot be overwritten; if part of a release fails, inspect the registry before retrying and never blindly bump or republish successful packages. Use an appropriate prerelease version and `--tag next` instead if this is not a stable release.

After publication, install the SDK by version from npm in a clean consumer project. No automatic npm publishing workflow is added by this change.
