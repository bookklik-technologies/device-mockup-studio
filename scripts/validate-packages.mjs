import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';

const root = path.resolve(import.meta.dirname, '..');
const names = ['core', 'presets', 'render', 'spatial', 'media', 'editor', 'sdk'];
const manifests = await Promise.all(names.map(name => readFile(path.join(root, 'packages', name, 'package.json'), 'utf8').then(JSON.parse)));
const versions = new Map(manifests.map(manifest => [manifest.name, manifest.version]));
const packages = [];

function readArchive(bytes) {
  const tar = gunzipSync(bytes);
  const files = new Map();
  const text = (start, length) => tar.subarray(start, start + length).toString('utf8').replace(/\0.*$/s, '');
  for (let offset = 0; offset + 512 <= tar.length && tar[offset];) {
    const name = text(offset, 100);
    const prefix = text(offset + 345, 155);
    const size = parseInt(text(offset + 124, 12).trim() || '0', 8);
    assert(Number.isSafeInteger(size) && size >= 0 && offset + 512 + size <= tar.length, 'Invalid tar entry');
    const type = text(offset + 156, 1);
    if (type === '' || type === '0') files.set(prefix ? `${prefix}/${name}` : name, tar.subarray(offset + 512, offset + 512 + size));
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  return files;
}

for (const expected of manifests) {
  const filename = `${expected.name.replace('@', '').replace('/', '-')}-${expected.version}.tgz`;
  const bytes = await readFile(path.join(root, 'artifacts', 'packages', filename));
  const files = readArchive(bytes);
  const manifest = JSON.parse(files.get('package/package.json')?.toString('utf8') ?? '{}');
  assert.equal(manifest.name, expected.name);
  assert.equal(manifest.version, expected.version);
  assert.notEqual(manifest.private, true);
  assert.equal(manifest.publishConfig?.access, 'public');
  assert.equal(manifest.type, 'module');
  assert(manifest.engines?.node, `${manifest.name}: missing Node engine`);
  for (const target of [manifest.main, manifest.types, ...Object.values(manifest.exports).flatMap(entry => Object.values(entry))]) {
    assert(typeof target === 'string' && files.has(`package/${target.replace(/^\.\//, '')}`), `${manifest.name}: missing export ${target}`);
  }
  for (const required of ['LICENSE', 'README.md', 'dist/THIRD-PARTY.md']) assert(files.has(`package/${required}`), `${manifest.name}: missing ${required}`);
  for (const dependencies of [manifest.dependencies, manifest.optionalDependencies, manifest.peerDependencies, manifest.devDependencies]) {
    for (const [name, spec] of Object.entries(dependencies ?? {})) {
      assert(!/^(workspace:|file:|link:)/.test(spec), `${manifest.name}: non-publishable dependency ${name}: ${spec}`);
      if (versions.has(name)) assert.equal(spec, `^${versions.get(name)}`, `${manifest.name}: incorrect internal version for ${name}`);
    }
  }
  for (const [name, contents] of files) {
    assert(!/(^|\/)(node_modules|tests|\.git|\.env)(\/|$)/.test(name), `Unexpected package content: ${name}`);
    if (name.endsWith('.map')) {
      const map = JSON.parse(contents.toString('utf8'));
      for (const source of map.sources ?? []) assert(files.has(path.posix.join(path.posix.dirname(name), source)), `${name}: missing map source ${source}`);
    }
  }
  packages.push({ name: manifest.name, version: manifest.version, filename, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
  console.log(`Validated ${filename} (${files.size} files)`);
}
await writeFile(path.join(root, 'artifacts', 'packages', 'release-manifest.json'), JSON.stringify({ packages }, null, 2) + '\n');
console.log('All seven tarballs are ready for manual publishing. No packages were published.');
