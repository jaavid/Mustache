#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(await readFile(path.join(root, 'assets/manifest.json'), 'utf8'));
assert.equal(manifest.schemaVersion, 1, 'Unknown asset manifest schema');
const paths = new Set();

for (const asset of manifest.sourceAssets) {
  assert(!paths.has(asset.path), 'Duplicate source: ' + asset.path);
  paths.add(asset.path);
  const file = path.join(root, asset.path);
  const bytes = await readFile(file);
  assert(
    bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')),
    'Expected PNG: ' + asset.path,
  );
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  if (asset.width !== undefined) {
    assert.equal(width, asset.width, 'Sprite width mismatch: ' + asset.path);
  }
  if (asset.height !== undefined) {
    assert.equal(height, asset.height, 'Sprite height mismatch: ' + asset.path);
  }
  if (asset.transparency) {
    // Indexed PNGs need tRNS; truecolor RGBA carries alpha in the color type.
    const colorType = bytes[25];
    assert(
      colorType === 6 || (colorType === 3 && bytes.includes(Buffer.from('tRNS'))),
      'Expected alpha-enabled PNG: ' + asset.path,
    );
  }
  if (asset.orientation === 'horizontal') {
    assert.equal(
      width,
      asset.frameWidth * asset.frames,
      'Sprite sheet width mismatch: ' + asset.path,
    );
    assert.equal(height, asset.frameHeight, 'Sprite sheet height mismatch: ' + asset.path);
  }
  assert((await stat(file)).size > 0, 'Empty asset: ' + asset.path);
  console.log('Source OK: ' + asset.path + ' (' + width + 'x' + height + ')');
}
for (const texture of manifest.generatedTextures) {
  assert(texture.key && texture.producer, 'Invalid generated texture entry');
  await stat(path.join(root, texture.producer));
}
await stat(path.join(root, manifest.audio.producer));
console.log(
  'Asset inventory OK: ' +
    manifest.sourceAssets.length +
    ' image(s), ' +
    manifest.generatedTextures.length +
    ' texture groups',
);
