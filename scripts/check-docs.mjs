#!/usr/bin/env node
/** Dependency-free hygiene on the asset manifest and repository docs. */
import { readFile } from 'node:fs/promises';
import { strict as assert } from 'node:assert';
for (const name of ['README.md','CHANGELOG.md','CONTRIBUTING.md','docs/ARCHITECTURE.md','assets/README.md']) {
  const contents=await readFile(name,'utf8');
  assert(contents.endsWith('\n'),name+' should end with LF');
  assert(!contents.includes('\r\n'),name+' should use LF endings');
  assert(!/^(<<<<<<<|=======|>>>>>>>)\s/gm.test(contents),name+' contains conflict markers');
}
console.log('Documentation structure OK');
