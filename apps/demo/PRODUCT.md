# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Designers and marketers who need polished device presentations of their own designs: marketing/portfolio shots, app store screenshots, social media posts. They work in a browser, typically with assets already at hand, and do not run a server.

## Product Purpose

Device Mockup Studio turns images and videos into device presentations. Users build layered compositions — photographic device frames, backgrounds, text, shapes, and motion — or explore 3D geometry with physical materials, then export them. Success is a finished, exported mockup asset produced quickly and entirely in the browser.

## Positioning

Fully client-side editing *and* export — including animated GIF and WebM/MP4 video and an optional 3D PBR renderer — with zero upload or server, plus an embeddable editor and SDK route for composing scenes programmatically. A neighboring tool could not truthfully copy the complete no-upload pipeline paired with video export and embeddability.

## Operating Context

- Runs as a static web app on GitHub Pages (https://bookklik-technologies.github.io/device-mockup-studio/); the same build works on the local dev server (http://127.0.0.1:4173 via `pnpm dev`).
- Monorepo of seven packages (`@mockup-studio/core`, `presets`, `render`, `spatial`, `media`, `editor`, `sdk`) under `packages/`; the demo app in `apps/demo` is the user-facing editor surface.
- Projects save as portable JSON files with embedded media; separate local 2D/3D browser drafts.

## Capabilities and Constraints

Confirmed functionality:
- 11 photographic device models in 19 views plus 17 procedural device definitions; fit, crop, perspective, shadows, lighting.
- 16 editable 2D templates, six 3D material studies, nine social canvas sizes, custom dimensions; transparent/solid/gradient/image backgrounds with local palette extraction.
- Layer-based canvas editing: visibility/locking, snapping, alignment, nudging, undo/redo, text, shapes, watermarks, color picker.
- Optional WebGL2 renderer (Three.js): seven volumetric geometries, PBR materials, studio lights, reflections, shadows, refractive glass.
- 16 animation presets, timeline preview, animated gradients, programmatic keyframes.
- Export: PNG, JPEG, WebP, looping GIF, frame sequences, silent WebM/MP4 (codec-dependent); the editor exposes PNG, WebM, GIF, more via SDK.
- Framework-free embeddable editor; versioned scene model, validation, transactional history.

Durable constraints (confirmed binding):
- Client-side only: no server, no upload; all processing and export happen in the browser.
- MIT license.
- SDK packages are workspace-only: not published to npm; distributed as `.tgz` tarballs via `pnpm pack:all` (install all seven together).
- Video export depends on browser codec support.
- Remote HTTP(S) assets require anonymous CORS permission from their server.
- Requires Node.js 22+ and pnpm 10 (pinned in root `package.json`) for development.

## Evidence on Hand

- Hero product demo: the live editor itself at the GitHub Pages URL.
- Device artwork guide: `docs/DEVICE-ARTWORK.md`; features and limitations: `docs/FEATURES.md`.
- SDK usage example in `README.md` with real code.
- No testimonials, customer lists, benchmark data, or press exist — future work must not fabricate any.

## Product Principles

1. Everything happens in the browser; nothing leaves the user's machine.
2. The editor and the SDK are the same product: what the UI composes, code composes too.
3. Capability claims state real browser limits (codecs, CORS) rather than hiding them.
4. Portability by default: scenes and projects are explicit JSON with embedded media.

## Accessibility & Inclusion

No product-specific requirement was established yet.
