import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { findBroken } from '../mdlinks.mjs';
assert.deepEqual(findBroken(new URL('./fixtures/page.md', import.meta.url).pathname), ['missing.md']);
const dir = mkdtempSync(join(tmpdir(), 'mdlinks-test-'));
try {
  writeFileSync(join(dir, 'good file.md'), '# Exists');
  const file = join(dir, 'page.md');
  writeFileSync(file, '[bad](not%ZZ.md)\n[truncated](bad%.md)\n[good](good%20file.md#heading)\n[missing](missing.md)');
  assert.deepEqual(findBroken(file), ['not%ZZ.md', 'bad%.md', 'missing.md']);
  const cli = spawnSync(process.execPath, [new URL('../mdlinks.mjs', import.meta.url).pathname, file], { encoding: 'utf8' });
  assert.equal(cli.status, 1);
  assert.match(cli.stdout, /3 broken link\(s\)/);
  assert.equal(cli.stderr, '');
} finally { rmSync(dir, { recursive: true, force: true }); }
console.log('ok');
