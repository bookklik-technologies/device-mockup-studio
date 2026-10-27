import { execFileSync } from 'node:child_process';
import { access, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve(import.meta.dirname,'..');
process.chdir(root);
const pnpm = process.env.npm_execpath;
if (!pnpm) throw new Error('Run this command through pnpm pack:release so the pinned package manager is used.');
const manifest = JSON.parse(await readFile('packages/sdk/package.json', 'utf8'));
if (manifest.name !== '@bookklik/device-mockup-studio' || manifest.private) throw new Error('Expected the single public Device Mockup Studio package.');
for (const entry of Object.values(manifest.exports)) {
  for (const target of Object.values(entry)) await access(path.join(root, 'packages/sdk', target));
}
await mkdir('artifacts/packages',{recursive:true});
const args = ['--dir','packages/sdk','pack','--pack-destination',path.join(root,'artifacts/packages')];
if (pnpm.endsWith('.exe')) execFileSync(pnpm, args, { stdio: 'inherit' });
else execFileSync(process.execPath, [pnpm, ...args], { stdio: 'inherit' });
