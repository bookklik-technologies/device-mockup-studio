import { cp, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

export async function assemblePackage(root) {
  const names = ['core', 'presets', 'render', 'spatial', 'media', 'editor'];
  const directory = path.join(root, 'packages/sdk/dist');
  for (const name of names) await cp(path.join(root, 'packages', name, 'dist'), path.join(directory, name), { recursive: true });
  for (const name of [...names, 'sdk']) await cp(path.join(root, 'packages', name, 'src'), path.join(directory, 'sources', name), { recursive: true });
  for (const file of await readdir(directory, { recursive: true })) {
    const filename = path.join(directory, file);
    if (file.startsWith(`sources${path.sep}`)) continue;
    if (file.endsWith('.js') || file.endsWith('.d.ts')) {
      const source = await readFile(filename, 'utf8');
      const rewritten = source.replace(/(['"])@bookklik\/(core|presets|render|spatial|media|editor)\1/g, (_match, quote, name) => {
        const relative = path.relative(path.dirname(filename), path.join(directory, name, 'index.js')).split(path.sep).join('/');
        return `${quote}${relative.startsWith('.') ? relative : `./${relative}`}${quote}`;
      });
      if (source !== rewritten) await writeFile(filename, rewritten);
    } else if (file.endsWith('.map')) {
      const map = JSON.parse(await readFile(filename, 'utf8'));
      const name = file.includes(path.sep) ? file.split(path.sep)[0] : 'sdk';
      map.sources = map.sources.map(source => path.relative(path.dirname(filename), path.join(directory, 'sources', name, path.basename(source))).split(path.sep).join('/'));
      await writeFile(filename, JSON.stringify(map));
    }
  }
}
