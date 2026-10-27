import { execFileSync } from 'node:child_process';
import { access, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve(import.meta.dirname,'..');
process.chdir(root);
const pnpm = process.env.npm_execpath;
if (!pnpm) throw new Error('Run this command through pnpm pack:all so the pinned package manager is used.');
const packages = ['core','presets','render','spatial','media','editor','sdk'];
for (const name of packages) {
  const manifest = JSON.parse(await readFile(`packages/${name}/package.json`, 'utf8'));
  for (const entry of Object.values(manifest.exports)) {
    for (const target of Object.values(entry)) await access(path.join(root, 'packages', name, target));
  }
}
await mkdir('artifacts/packages',{recursive:true});
for (const name of packages) {
  const args = ['--dir',`packages/${name}`,'pack','--pack-destination',path.join(root,'artifacts/packages')];
  if (pnpm.endsWith('.exe')) execFileSync(pnpm, args, { stdio: 'inherit' });
  else execFileSync(process.execPath, [pnpm, ...args], { stdio: 'inherit' });
}
