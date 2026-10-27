import { createScene, createMesh, createShape, createMaterialPreset, createSpatialSettings } from '@bookklik/device-mockup-studio-core';
import { SpatialRenderer } from '@bookklik/device-mockup-studio-spatial';
import { exportImage } from '@bookklik/device-mockup-studio-media';

export async function renderGlassStudy(canvas: HTMLCanvasElement) {
  const scene = createScene({
    width: 1000, height: 800,
    background: { type: 'solid', color: '#f3efe5' },
    spatial: createSpatialSettings({ quality: 'high' }),
    nodes: [
      ...Array.from({ length: 16 }, (_, i) => createShape({
        x: 200 + i * 40, y: 400, z: -180,
        width: 12, height: 500, radius: 0, fill: '#263840',
      })),
      createMesh({ geometry: 'sphere', x: 520, y: 410, z: 170,
        width: 350, height: 350, depth: 330,
        material: { ...createMaterialPreset('glass'), transmission: 1, ior: 1.5, thickness: 260 },
      }),
      createMesh({ geometry: 'rounded-box', x: 780, y: 240, z: 70,
        width: 180, height: 200, depth: 130, bevel: 25, tiltY: -24, rotation: -12,
        material: { ...createMaterialPreset('metal'), color: '#c4b38f' },
      }),
    ],
  });
  const renderer = new SpatialRenderer(canvas);
  try { return await exportImage(renderer, scene, { format: 'png' }); }
  finally { renderer.dispose(); }
}
