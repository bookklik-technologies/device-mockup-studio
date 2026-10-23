// Browser integration/visual checks only. Does not invoke the unit test runner.
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
process.chdir(path.resolve(import.meta.dirname, '..'));
await mkdir('artifacts', { recursive: true });
const server = createServer(async (req, res) => {
  try {
    const p = new URL(req.url, 'http://localhost').pathname;
    const file = p === '/sdk.js' ? 'artifacts/mockup-studio.js' : path.join('apps/demo/dist', p === '/' ? 'index.html' : p.slice(1));
    const bytes = await readFile(file); res.setHeader('content-type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.woff2') ? 'font/woff2' : 'text/html'); res.end(bytes);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--enable-unsafe-swiftshader'] });
const results = [], errors = [];
const pass = name => { results.push(name); console.log('PASS', name); };
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } }); page.setDefaultTimeout(60000);
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.waitForFunction(() => window.mockupStudio);
  await page.evaluate(async () => { window.sdk = await import('/sdk.js'); });
  const visual = await page.evaluate(async () => {
    const sdk = window.sdk;
    const media = document.createElement('canvas'); media.width = 900; media.height = 1400;
    const m = media.getContext('2d'); m.fillStyle = '#f4f1ed'; m.fillRect(0, 0, 900, 1400);
    m.fillStyle = '#263e3a'; m.font = 'bold 45px sans-serif'; m.fillText('northstar', 64, 145);
    m.font = '64px sans-serif'; m.fillText('A clearer view.', 64, 295);
    m.fillStyle = '#d5e2d7'; m.fillRect(64, 365, 772, 360); m.fillStyle = '#254d45'; m.font = '28px sans-serif'; m.fillText('YOUR WORKSPACE', 100, 430); m.font = 'bold 94px sans-serif'; m.fillText('24,809', 100, 560);
    m.font = '30px sans-serif'; m.fillText('Growing at your own pace', 100, 640);
    for (let i = 0; i < 5; i++) { m.fillStyle = '#fff'; m.fillRect(64, 775 + i * 105, 772, 80); m.fillStyle = '#50635a'; m.font = '27px sans-serif'; m.fillText(['Overview', 'Projects', 'Customers', 'Activity', 'Settings'][i], 95, 825 + i * 105); }
    const asset = { id: 'fixture', kind: 'image', src: media.toDataURL(), width: 900, height: 1400 };
    const devices = sdk.listDevices({ includeLegacy: false }).filter(d => d.artwork);
    const sheet = document.createElement('canvas'); sheet.width = 2400; sheet.height = Math.ceil(devices.length / 4) * 700; const c = sheet.getContext('2d'); c.fillStyle = '#e7edf1'; c.fillRect(0, 0, sheet.width, sheet.height);
    const newIds = ['iphone-17', 'galaxy-s26', 'pixel-10-pro', 'ipad-air-11-m4', 'galaxy-tab-s11', 'macbook-air-13-m5'];
    const additions = document.createElement('canvas'); additions.width = 1800; additions.height = 1400; const ac = additions.getContext('2d'); ac.fillStyle = '#e7edf1'; ac.fillRect(0, 0, 1800, 1400);
    const renderer = new sdk.CanvasRenderer(document.createElement('canvas'));
    for (let i = 0; i < devices.length; i++) {
      const d = devices[i], w = Math.min(530, 570 * d.aspect), h = w / d.aspect;
      const node = sdk.createMockup({ deviceId: d.id, assetId: asset.id, x: 300, y: 320, width: w, height: h, lighting: .15, shadow: { color: '#173047', opacity: .25, blur: 14, offsetX: 0, offsetY: 12, spread: 0 } });
      const scene = sdk.createScene({ width: 600, height: 650, background: { type: 'transparent' }, assets: [asset], nodes: [node] });
      await renderer.render(scene); c.drawImage(renderer.canvas, (i % 4) * 600, Math.floor(i / 4) * 700);
      c.fillStyle = '#233e4c'; c.font = '18px sans-serif'; c.fillText(d.name, (i % 4) * 600 + 20, Math.floor(i / 4) * 700 + 675);
      const addedIndex = newIds.indexOf(d.id);
      if (addedIndex >= 0) { ac.drawImage(renderer.canvas, (addedIndex % 3) * 600, Math.floor(addedIndex / 3) * 700); ac.fillStyle = '#233e4c'; ac.font = '18px sans-serif'; ac.fillText(d.name, (addedIndex % 3) * 600 + 20, Math.floor(addedIndex / 3) * 700 + 675); }
      // Composite center is filled and the outside stays transparent, including stand gaps.
      const p = renderer.canvas.getContext('2d'); if (p.getImageData(300, 300, 1, 1).data[3] === 0) throw Error('Missing screen: ' + d.id);
      if (p.getImageData(0, 0, 1, 1).data[3] !== 0) throw Error('Opaque background: ' + d.id);
      if (d.id === 'iphone-17-pro') window.fixtureScene = scene;
    }
    const tilted = structuredClone(window.fixtureScene); tilted.nodes[0].tiltX = 12; tilted.nodes[0].tiltY = -22; tilted.nodes[0].rotation = -7;
    await renderer.render(tilted); const tilt = renderer.canvas.toDataURL();
    const formats = [];
    for (const format of ['png', 'jpeg', 'webp']) { const blob = await sdk.exportImage(renderer, tilted, { format, scale: 2 }); if (!blob.size) throw Error('Empty export'); formats.push([format, blob.size]); }
    renderer.dispose();
    if (!newIds.every(id => devices.some(d => d.id === id))) throw Error('Missing expanded model');
    return { sheet: sheet.toDataURL(), additions: additions.toDataURL(), tilt, formats, count: devices.length };
  });
  for (const key of ['sheet', 'additions', 'tilt']) await writeFile(`artifacts/device-${key}.png`, Buffer.from(visual[key].split(',')[1], 'base64'));
  assert.equal(visual.count, 19); pass('all eleven models and eight landscape variants render; PNG/JPEG/WebP exports');

  // Exercise actual editor selection, history, filtering and project persistence.
  await page.evaluate(() => {
    const scene = structuredClone(window.fixtureScene), n = scene.nodes[0]; n.focalX = .3; n.focalY = .7;
    scene.tracks = ['x', 'width'].map(property => ({ id: property, nodeId: n.id, property, keyframes: [{ time: 0, value: n[property] }, { time: 1, value: n[property] + 10 }] }));
    window.mockupStudio.setScene(scene);
  });
  await page.locator('.ms-layer-name').first().click();
  const beforeSwitch = await page.evaluate(() => window.mockupStudio.getScene());
  await page.getByLabel('Device', { exact: true }).selectOption('imac-24-m4');
  const afterSwitch = await page.evaluate(() => window.mockupStudio.getScene());
  for (const key of ['x', 'y', 'assetId', 'fit', 'focalX', 'focalY']) assert.equal(afterSwitch.nodes[0][key], beforeSwitch.nodes[0][key]);
  for (const track of afterSwitch.tracks) {
    const old = beforeSwitch.tracks.find(t => t.id === track.id);
    for (let i = 0; i < track.keyframes.length; i++) {
      const expected = track.property === 'width' ? old.keyframes[i].value * afterSwitch.nodes[0].width / beforeSwitch.nodes[0].width : old.keyframes[i].value;
      assert.ok(Math.abs(track.keyframes[i].value - expected) < 1e-8);
      assert.equal(track.keyframes[i].time, old.keyframes[i].time);
    }
  }
  assert.equal(await page.getByLabel('Frame style', { exact: true }).count(), 0);
  assert.equal(await page.getByLabel('Corner radius', { exact: true }).count(), 0);
  assert.equal(await page.evaluate(() => window.mockupStudio.getScene().nodes[0].assetId), 'fixture');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  assert.equal(await page.evaluate(() => window.mockupStudio.getScene().nodes[0].deviceId), 'iphone-17-pro');
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  assert.equal(await page.evaluate(() => window.mockupStudio.getScene().nodes[0].deviceId), 'imac-24-m4');
  const options = await page.getByLabel('Device', { exact: true }).locator('option').evaluateAll(os => os.map(o => o.value));
  assert.ok(!options.includes('phone')); assert.ok(options.includes('browser')); assert.ok(options.includes('screenshot'));
  await page.getByRole('tab', { name: 'Devices', exact: true }).click();
  await page.locator('.ms-library-panel').evaluate(async el => { await Promise.all(el.getAnimations().map(a => a.finished)); });
  assert.equal(await page.locator('.ms-device').count(), 21);
  await page.locator('.ms-device img').evaluateAll(async images => { await Promise.all(images.map(image => image.decode())); });
  await page.screenshot({ path: 'artifacts/device-editor.png' });
  pass('editor picker, thumbnails, control visibility, device switching, undo and redo');

  const extra = await page.evaluate(async () => {
    const sdk = window.sdk;
    const current = window.mockupStudio.getScene(), serialized = sdk.serializeScene(current);
    const restored = sdk.deserializeScene(serialized); window.mockupStudio.setScene(restored);
    const r = new sdk.CanvasRenderer(document.createElement('canvas'));
    const legacy = structuredClone(restored); legacy.nodes[0].deviceId = 'phone'; await r.render(legacy);
    const previous = r.canvas.toDataURL(), broken = sdk.getDevice('iphone-17-pro'); broken.id = 'check:broken-frame'; broken.artwork.src = 'data:image/png;base64,AA=='; sdk.registerDevice(broken);
    const brokenScene = structuredClone(legacy); brokenScene.nodes[0].deviceId = broken.id;
    let loadError; try { await r.render(brokenScene); } catch (error) { loadError = error.code; }
    if (loadError !== 'DEVICE_ARTWORK_LOAD' || r.canvas.toDataURL() !== previous) throw Error('Failed frame did not preserve previous output');
    const restoredNode = restored.nodes[0]; restoredNode.style = 'liquid-glass'; restoredNode.tiltX = 12; restoredNode.tiltY = -18;
    const spatial = new sdk.SpatialRenderer(document.createElement('canvas')); restored.spatial = sdk.createSpatialSettings(); await spatial.render(restored);
    const info = spatial.getDebugInfo(), spatialImage = spatial.canvas.toDataURL(); spatial.dispose();
    // Encode a real finite-duration video, then seek it inside every device variant.
    const videoScene = sdk.createScene({ width: 320, height: 240, duration: .5, fps: 12, background: { type: 'solid', color: '#ecbd8e' }, nodes: [sdk.createShape({ id: 'block', x: 90, y: 120, width: 70, height: 70, fill: '#305747' })], tracks: [{ id: 'move', nodeId: 'block', property: 'x', keyframes: [{ time: 0, value: 70 }, { time: .5, value: 250 }] }] });
    const blob = await sdk.exportVideo(r, videoScene, { format: 'webm', fps: 12 });
    const url = await new Promise(resolve => { const fr = new FileReader(); fr.onload = () => resolve(fr.result); fr.readAsDataURL(blob); });
    const video = { id: 'clip', kind: 'video', src: url, width: 320, height: 240, duration: .5 };
    for (const d of sdk.listDevices({ includeLegacy: false }).filter(d => d.artwork && !d.id.startsWith('check:'))) {
      const w = Math.min(260, 250 * d.aspect), h = w / d.aspect;
      const scene = sdk.createScene({ width: 320, height: 300, assets: [video], nodes: [sdk.createMockup({ deviceId: d.id, assetId: video.id, x: 160, y: 150, width: w, height: h, lighting: 0 })] });
      await r.render(scene, 0); const first = r.canvas.toDataURL(); await r.render(scene, .3); if (r.canvas.toDataURL() === first) throw Error('Video did not advance: ' + d.id);
    }
    r.dispose();
    return { volumes: info.resources.volumes, spatialImage, serializedBytes: serialized.length };
  });
  assert.equal(extra.volumes, 0); await writeFile('artifacts/device-spatial.png', Buffer.from(extra.spatialImage.split(',')[1], 'base64'));
  pass('JSON reload, legacy rendering, failed-load recovery, physical-glass bypass and video seeking in all nineteen frames');
  await page.context().setOffline(true);
  await page.evaluate(async () => { const r = new window.sdk.CanvasRenderer(document.createElement('canvas')); await r.render(window.fixtureScene); r.dispose(); });
  pass('fresh renderer loads embedded artwork while offline');
  assert.deepEqual(errors, []);
  await writeFile('artifacts/device-browser-results.json', JSON.stringify({ results, exports: visual.formats, errors }, null, 2));
} finally { await browser.close(); await new Promise(r => server.close(r)); }
