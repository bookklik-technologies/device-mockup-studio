import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';

/** Shared manifest keeps the inspector, CSS, files and notices in agreement. */
export async function bundleFonts() {
  const families = JSON.parse(await readFile('packages/presets/src/fonts.json', 'utf8'));
  await mkdir('apps/demo/dist/fonts', { recursive:true });
  await mkdir('artifacts/licenses', { recursive:true });
  const css = [];
  for (const font of families) {
    const base = `node_modules/@fontsource-variable/${font.id}`;
    const file = `${font.id}-latin-wght-normal.woff2`;
    await cp(`${base}/files/${file}`, `apps/demo/dist/fonts/${file}`);
    await cp(`${base}/LICENSE`, `apps/demo/dist/fonts/${font.id}-OFL.txt`);
    await cp(`${base}/LICENSE`, `artifacts/licenses/${font.family.replaceAll(' ', '-')}-OFL.txt`);
    css.push(`@font-face { font-family:'${font.family}'; font-style:normal; font-weight:${font.weights}; font-display:swap; src:url('./${file}') format('woff2'); }`);
  }
  // Retain the existing Outfit license URL for hosts that already link to it.
  await cp('node_modules/@fontsource-variable/outfit/LICENSE', 'apps/demo/dist/fonts/OFL.txt');
  await writeFile('apps/demo/dist/fonts/fonts.css', css.join('\n') + '\n');
}
