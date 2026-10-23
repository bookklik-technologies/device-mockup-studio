import { createScene, createMockup, CanvasRenderer, exportImage, createAnimationTracks, exportVideo, mountEditor } from '@mockup-studio/sdk';

export async function generate(imageURL: string, width: number, height: number) {
  const media = { id: 'design', kind: 'image' as const, src: imageURL, width, height };
  const node = createMockup({ assetId: media.id, deviceId: 'browser', x: 800, y: 600, width: 1200, height: 800, tiltY: -12 });
  const scene = createScene({ width: 1600, height: 1200, assets: [media], nodes: [node] });
  const renderer = new CanvasRenderer(document.createElement('canvas'));
  try {
    const png = await exportImage(renderer, scene, { scale: 2, format: 'png' });
    scene.tracks = createAnimationTracks(node, 'parallax', scene.duration);
    const webm = await exportVideo(renderer, scene, { format: 'webm', fps: 30, onProgress: console.log });
    return { scene, png, webm };
  } finally { renderer.dispose(); }
}

export function embed(container: HTMLElement) {
  return mountEditor(container, { onChange: scene => console.log(scene.id), onError: console.error });
}
