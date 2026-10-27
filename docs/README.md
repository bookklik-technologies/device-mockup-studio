# Device Mockup Studio — documentation site

This folder is a self-contained [VitePress](https://vitepress.dev) documentation site for Device Mockup Studio. It builds on top of the hand-written guides that already lived here (`API.md`, `HEADLESS.md`, `SPATIAL.md`, `MEDIA.md`, `FEATURES.md`, `DEVICE-ARTWORK.md`, `PUBLISHING.md`, `THIRD-PARTY.md`) and adds:

- `index.md` — the landing/home page
- `guide/getting-started.md` — install, run, and SDK quickstart
- `.vitepress/config.mts` — theme config (nav, sidebar, search)

## Commands

Dependencies are installed directly in this folder (`docs/package.json`, with npm) because the root workspace pins pnpm modules that conflict with VitePress's toolchain:

```bash
npm install        # first time only, from docs/
npm run dev        # dev server with hot reload (root: pnpm docs)
npm run build      # static build to .vitepress/dist (root: pnpm docs:build)
npm run preview    # serve the production build locally (root: pnpm docs:preview)
```

From the **repository root** the convenience scripts are:

```bash
pnpm docs          # start the docs dev server
pnpm docs:build    # build the site
pnpm docs:preview  # preview the built site
```

## Deployment notes

- For GitHub Pages under a repository subpath, set the `base` option in `.vitepress/config.mts` (the line is already present as a comment).
- The single published package reference for the project is `@bookklik/device-mockup-studio`; see the [Publishing & versioning guide](/PUBLISHING).
