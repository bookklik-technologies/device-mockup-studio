# Third-party and asset notices

This document covers device artwork, dependency licenses and bundled notices.

The photographic device frames in `packages/presets/artwork/` are original AI-generated illustrations created with the built-in image-generation tool. The prompts are included in that directory. They are not official manufacturer artwork; Apple, iPhone, iPad, MacBook, iMac, Samsung, Galaxy, Google and Pixel names identify the represented devices and belong to their respective owners. No endorsement is implied. See [device artwork](DEVICE-ARTWORK.md) for packaging and fidelity details.

The editor uses **Lucide 1.61.0** icons (ISC, with MIT notices for icons derived from Feather). The demo self-hosts twelve normal Latin variable fonts through Fontsource: **Outfit, Inter, DM Sans, Manrope, Space Grotesk, Plus Jakarta Sans, Sora, Lora, Playfair Display, Fraunces, Bricolage Grotesque, and JetBrains Mono** (SIL Open Font License 1.1; exact package versions are recorded in `pnpm-lock.yaml`). Original font licenses are copied to `artifacts/licenses/` and served individually as `fonts/<font-id>-OFL.txt`. The original Outfit license URL `fonts/OFL.txt` remains available. These assets require no runtime CDN requests. The Forma sample dashboard and poster used in scene templates are original vector artwork authored in this repository.

The pure core and presets have no external runtime dependencies. The original renderer is Canvas2D; the optional spatial package now uses Three.js0.180.0 (MIT) with @types/three and @webgpu/types declarations, including its generated RoomEnvironment and geometry helpers. No external HDR images/models are bundled. Media dynamically imports these pinned MIT-licensed muxers:

- webm-muxer 5.1.4
- mp4-muxer 5.2.2

Both are deprecated upstream in favor of Mediabunny. They were retained as small, typed container adapters for this initial release, isolated behind EncoderMuxerAdapter. Review or replace them before long-term production adoption. The WebM adapter repairs the pinned muxer's last-frame-start duration metadata after muxing; see MEDIA.md and muxers.ts. No codec patent or third-party service rights are granted by this project's MIT license.

Build/test tools (not browser runtime dependencies) include TypeScript (Apache-2.0), esbuild (MIT), tsx (MIT), Playwright (Apache-2.0), @napi-rs/canvas (MIT), @sparticuz/chromium (MIT for packaging; Chromium components retain their upstream licenses), and @types/node (MIT). Their own package distributions contain authoritative notices. Chromium is not shipped in this source ZIP; a development install downloads it through its npm package.

## Runtime dependency license texts

### webm-muxer

```text
MIT License

Copyright (c) 2022 Vanilagy

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

```

### mp4-muxer

```text
MIT License

Copyright (c) 2023 Vanilagy

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

```

## Three.js 0.180.0

```text
The MIT License

Copyright © 2010-2025 three.js authors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

```
