import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { cp, mkdir, readdir, rm, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { embedDeviceArtwork } from './embed-device-artwork.mjs';
import { bundleFonts } from './fonts.mjs';
const root = path.resolve(import.meta.dirname, '..');
process.chdir(root);
await embedDeviceArtwork();
await rm('build', { recursive: true, force: true });
await mkdir('build', { recursive: true });
execFileSync(process.execPath, [fileURLToPath(import.meta.resolve('typescript/bin/tsc')),'--declaration','--declarationMap','--sourceMap','--inlineSources','--outDir','build','--rootDir','.'], { stdio: 'inherit' });
for (const name of ['core','presets','render','spatial','media','editor','sdk']) {
  const dir = `packages/${name}`;
  await rm(`${dir}/dist`, {recursive:true, force:true});
  await cp(`build/packages/${name}/src`, `${dir}/dist`, {recursive:true});
  for (const file of await readdir(`${dir}/dist`)) if (file.endsWith('.map')) {
    const mapPath = `${dir}/dist/${file}`;
    const map = JSON.parse(await readFile(mapPath, 'utf8'));
    map.sources = map.sources.map(source => `../src/${path.basename(source)}`);
    await writeFile(mapPath, JSON.stringify(map));
  }
  await cp('docs/THIRD-PARTY.md', `${dir}/dist/THIRD-PARTY.md`);
}
await mkdir('apps/demo/dist', {recursive:true});
await cp('icon.svg', 'apps/demo/dist/icon.svg');
await bundleFonts();
await build({entryPoints:['apps/demo/main.ts'], bundle:true, format:'esm', outfile:'apps/demo/dist/demo.js', sourcemap:true, target:'es2022', tsconfig:'tsconfig.json'});
const html = await readFile('apps/demo/index.html','utf8');
await writeFile('apps/demo/dist/index.html',html.replace('./main.ts','./demo.js'));
await mkdir('artifacts',{recursive:true});
await mkdir('artifacts/licenses',{recursive:true});
await cp('packages/editor/node_modules/lucide/LICENSE', 'artifacts/licenses/Lucide-LICENSE.txt');
await cp('packages/media/node_modules/gifenc/LICENSE.md', 'artifacts/licenses/gifenc-LICENSE.txt');
await cp('node_modules/@fontsource-variable/outfit/LICENSE', 'artifacts/licenses/Outfit-OFL.txt');
await build({entryPoints:['packages/sdk/src/index.ts'],bundle:true,format:'esm',outfile:'artifacts/mockup-studio.js',sourcemap:true,target:'es2022',tsconfig:'tsconfig.json'});
await build({entryPoints:['packages/sdk/src/headless.ts'],bundle:true,format:'esm',outfile:'artifacts/mockup-studio-headless.js',sourcemap:true,target:'es2022',tsconfig:'tsconfig.json'});
console.log('Built seven ESM packages, full and headless SDK bundles, and runnable demo.');
