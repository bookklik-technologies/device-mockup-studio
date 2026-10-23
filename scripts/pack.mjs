import { execFileSync } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve(import.meta.dirname,'..');
process.chdir(root);
await mkdir('artifacts/packages',{recursive:true});
for (const name of ['core','presets','render','spatial','media','editor','sdk']) execFileSync('pnpm',['--dir',`packages/${name}`,'pack','--pack-destination',path.join(root,'artifacts/packages')],{stdio:'inherit'});
