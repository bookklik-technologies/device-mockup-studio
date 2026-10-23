import test from 'node:test';
import assert from 'node:assert/strict';
import { createCanvas } from '@napi-rs/canvas';
import { createScene, createText } from '@mockup-studio/core';
import { CanvasRenderer } from '@mockup-studio/render';

function rendererWithFonts(load: (font: string, sample: string) => Promise<unknown>) {
  const canvas = createCanvas(40, 40);
  Object.defineProperty(canvas, 'ownerDocument', { value:{ fonts:{ load } } });
  const renderer = new CanvasRenderer(canvas as unknown as HTMLCanvasElement, {
    canvasFactory:(width, height) => createCanvas(width, height) as unknown as HTMLCanvasElement,
  });
  return { canvas, renderer };
}

test('async rendering waits for fonts before replacing the last frame and groups matching faces', async () => {
  let ready!: () => void, requested!: () => void;
  const started = new Promise<void>(resolve => { requested = resolve; });
  const loaded = new Promise<void>(resolve => { ready = resolve; });
  const calls: [string, string][] = [];
  const { renderer, canvas } = rendererWithFonts(async (font, sample) => { calls.push([font, sample]); requested(); await loaded; });
  const scene = createScene({ width:100, height:80, nodes:[
    createText({ fontFamily:'Lora', fontWeight:500, text:'First' }),
    createText({ fontFamily:'Lora', fontWeight:500, text:'Second' }),
    createText({ fontFamily:'Inter', visible:false }),
  ] });
  try {
    const pending = renderer.render(scene); await started;
    assert.equal(canvas.width, 40, 'previous output is kept while fonts are pending');
    assert.deepEqual(calls, [['500 16px "Lora"', 'FirstSecond']]);
    ready(); await pending; assert.equal(canvas.width, 100);
  } finally { renderer.dispose(); }
});

test('font failures reject without clearing output, and cancellation can interrupt loading', async () => {
  const failure = new Error('Font download failed');
  const failed = rendererWithFonts(async () => { throw failure; });
  const scene = createScene({ width:100, height:80, nodes:[createText({ fontFamily:'Inter' })] });
  try { await assert.rejects(failed.renderer.render(scene), failure); assert.equal(failed.canvas.width, 40); }
  finally { failed.renderer.dispose(); }

  let requested!: () => void, finish!: () => void;
  const started = new Promise<void>(resolve => { requested = resolve; });
  const loading = new Promise<void>(resolve => { finish = resolve; });
  const pending = rendererWithFonts(async () => { requested(); await loading; });
  const controller = new AbortController();
  try {
    const rendering = pending.renderer.render(scene, 0, { signal:controller.signal }); await started; controller.abort();
    await assert.rejects(rendering, { code:'ABORTED' }); assert.equal(pending.canvas.width, 40);
  } finally { finish(); pending.renderer.dispose(); }
});
