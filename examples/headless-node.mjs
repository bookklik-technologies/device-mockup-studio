import { createCanvas } from '@napi-rs/canvas';
import { writeFile } from 'node:fs/promises';
import { createHeadlessStudio, createScene, createShape } from '../packages/sdk/dist/headless.js';

const studio = createHeadlessStudio({
  scene: createScene({
    width: 640, height: 480,
    background: { type: 'solid', color: '#f3f4f4' },
    nodes: [createShape({ x: 320, y: 240, width: 320, height: 200, fill: '#007777' })],
  }),
  canvasFactory: createCanvas,
  encodeCanvas: async (canvas, { type, quality }) => {
    const format = type === 'image/jpeg' ? 'jpeg' : type === 'image/webp' ? 'webp' : 'png';
    const bytes = format === 'png' ? await canvas.encode('png') : await canvas.encode(format, Math.round((quality ?? .92) * 100));
    return new Blob([new Uint8Array(bytes)], { type });
  },
});

try {
  const blob = await studio.exportImage({ format: 'png' });
  const output = process.argv[2] ?? 'artifacts/headless.png';
  await writeFile(output, new Uint8Array(await blob.arrayBuffer()));
  console.log(`Saved ${output}`);
} finally {
  studio.destroy();
}
