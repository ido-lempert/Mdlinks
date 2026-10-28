// Generate deterministic ~50MB demo content for the test.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const DATA = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data');
const TARGET = 50 * 1024 * 1024;
const out = path.join(DATA, 'demo50--demo-content-50mb.txt');
if (!fs.existsSync(out) || fs.statSync(out).size !== TARGET) {
  const ws = fs.createWriteStream(out);
  let written = 0, i = 0;
  while (written < TARGET) {
    const line = `line ${String(i++).padStart(9, '0')} - the quick brown fox jumps over the lazy dog - ${(i * 2654435761) % 4294967296}\n`;
    written += Buffer.byteLength(line);
    if (!ws.write(line)) await new Promise(r => ws.once('drain', r));
  }
  await new Promise(r => ws.end(r));
}
console.log(out, fs.statSync(out).size);
