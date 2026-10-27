# Manual npm publishing

Publish exactly one package: **`@bookklik/device-mockup-studio`**, currently version **0.3.0**. The repository root and six supporting workspace packages are private. The public package is assembled in `packages/sdk` and contains all internal modules; it has no dependency on another `@bookklik` package.

## Prerequisites

- Node.js 22+ and the pinned package manager (`pnpm@10.34.7`).
- An npm account authorized to publish `@bookklik/device-mockup-studio` in the `@bookklik` organization. Package metadata does not grant permission or reserve the name.
- Confirm version 0.3.0 is unused on npm. For subsequent releases keep root/workspace versions synchronized and regenerate the lockfile if dependencies change.
- Review the changelog, licenses, device artwork notices and compatibility limits in the root README.

## Prepare without publishing

```sh
pnpm install --frozen-lockfile
pnpm release:prepare
```

This runs typechecking, production builds, `pnpm pack:release`, and archive validation. It does **not** run unit/browser tests, publish anything or require npm credentials. `pnpm pack:all` remains an alias but also packs only this one public package.

The build copies internal JavaScript and declarations into the public package, rewrites their private workspace imports to relative paths, and includes source-map sources and third-party notices. External libraries such as Three.js and media encoders remain ordinary npm dependencies. The `/headless` entry does not import the editor or Three.js even though the single package installs their external dependencies.

Output:

```text
artifacts/packages/bookklik-device-mockup-studio-0.3.0.tgz
artifacts/packages/release-manifest.json
```

The manifest lists exactly one tarball with its name, version, size and SHA-256 hash. Validation checks private workspace flags, public ESM/type exports, included relative modules, external dependency declarations, source-map sources and notices. It rejects unresolved workspace imports and dependencies on the private workspace packages.

Use `pnpm release:validate` to revalidate an existing archive. Rebuild/repack after source or version edits; archive validation alone does not establish source freshness. Old scope/version tarballs may remain in `artifacts/packages`; ignore those and publish **only the single filename from the latest release manifest**.

## Inspect and install locally

```sh
npm publish artifacts/packages/bookklik-device-mockup-studio-0.3.0.tgz --dry-run --access public
```

The dry run does not publish. In an empty consumer project, install just the one tarball:

```sh
npm install /absolute/path/to/artifacts/packages/bookklik-device-mockup-studio-0.3.0.tgz
```

Verify your browser/Node integration and TypeScript module resolution. Public imports are:

```ts
import { mountEditor } from '@bookklik/device-mockup-studio';
import { createHeadlessStudio } from '@bookklik/device-mockup-studio/headless';
import { createScene } from '@bookklik/device-mockup-studio/core';
import { CanvasRenderer } from '@bookklik/device-mockup-studio/render';
import { SpatialRenderer } from '@bookklik/device-mockup-studio/spatial';
```

The `/presets`, `/media` and `/editor` entries are available too. These are entry points within the same npm package, not separately published packages. ESM is the advertised module format. Node rendering needs a canvas/encoder adapter; SSR imports do not require a DOM.

## Publish manually

Log in yourself (`npm login`), verify the account (`npm whoami`), and publish the prepared tarball:

```sh
npm publish artifacts/packages/bookklik-device-mockup-studio-0.3.0.tgz --access public
```

Do not publish the private repository root or any supporting workspace, and do not publish old multi-package tarballs. No dependency-order release is necessary. Complete npm authentication/2FA yourself and never store credentials in repository files. Published name/version pairs cannot be overwritten; inspect the registry before retrying a failed publication. For a prerelease, use a matching prerelease version and `--tag next`.

After publishing, verify a clean install with `npm install @bookklik/device-mockup-studio@0.3.0`. No automatic publishing workflow is added.
