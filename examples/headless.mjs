/** Optional Node + Chromium adapter. Requires workspace dev dependencies and pnpm build.
 * Usage on your own machine: node examples/headless.mjs scene.json output.png
 * Local project files are not silently served over the network; assets should be data URLs
 * or remote CORS-enabled URLs. Treat untrusted URLs according to your deployment policy.
 */
import { chromium } from '@playwright/test';
import binary from '@sparticuz/chromium';
import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import { deserializeScene } from '../packages/core/dist/index.js';
const [input,output='mockup.png'] = process.argv.slice(2);
if(!input) { console.error('Usage: node examples/headless.mjs scene.json output.png'); process.exit(1); }
const scene = deserializeScene(await readFile(input,'utf8'));
const { outputFiles } = await build({entryPoints:['packages/sdk/src/index.ts'],bundle:true,format:'iife',globalName:'MockupStudio',write:false,target:'es2022',tsconfig:'tsconfig.json'});
const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || await binary.executablePath(),args:binary.args,headless:true});
try {
  const page = await browser.newPage();
  await page.goto('about:blank');
  await page.addScriptTag({content:outputFiles[0].text});
  const base64 = await page.evaluate(async(scene)=>{
    const sdk=globalThis.MockupStudio;
    const Renderer=scene.spatial?.enabled||scene.nodes.some(n=>n.type==='mesh')?sdk.SpatialRenderer:sdk.CanvasRenderer;
    const renderer=new Renderer(document.createElement('canvas'));
    try {
      const blob=await sdk.exportImage(renderer,scene,{format:'png'});
      return await new Promise((resolve,reject)=>{const f=new FileReader();f.onload=()=>resolve(f.result.split(',')[1]);f.onerror=reject;f.readAsDataURL(blob);});
    } finally {renderer.dispose();}
  },scene);
  await writeFile(output,Buffer.from(base64,'base64'));
  console.log(`Saved ${output}`);
} finally {await browser.close();}
