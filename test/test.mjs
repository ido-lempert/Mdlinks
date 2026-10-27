import assert from 'node:assert/strict';
import { findBroken } from '../mdlinks.mjs';
assert.deepEqual(findBroken(new URL('./fixtures/page.md', import.meta.url).pathname), ['missing.md']);
console.log('ok');
