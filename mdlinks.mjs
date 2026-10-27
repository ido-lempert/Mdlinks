#!/usr/bin/env node
// mdlinks: report relative links in Markdown files that point to files that do not exist.
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const LINK = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

export function findBroken(file) {
  const text = readFileSync(file, 'utf8').replace(/```[\s\S]*?```/g, '');
  const broken = [];
  for (const m of text.matchAll(LINK)) {
    const target = m[1];
    if (/^([a-z][a-z0-9+.-]*:|#|\/\/)/i.test(target)) continue; // URL or in-page anchor
    const path = decodeURIComponent(target.split('#')[0].split('?')[0]);
    if (path && !existsSync(resolve(dirname(file), path))) broken.push(target);
  }
  return broken;
}

function walk(p) {
  if (statSync(p).isFile()) return p.endsWith('.md') ? [p] : [];
  return readdirSync(p).flatMap((n) => (n === 'node_modules' || n.startsWith('.') ? [] : walk(join(p, n))));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  if (args.includes('-h') || args.includes('--help')) {
    console.log('usage: mdlinks [path ...]   (default: current directory)\nexit code 1 if any relative link is broken');
    process.exit(0);
  }
  let bad = 0;
  for (const f of args.length ? args.flatMap(walk) : walk('.')) {
    for (const t of findBroken(f)) { console.log(`${f}: broken link -> ${t}`); bad++; }
  }
  console.log(bad ? `${bad} broken link(s)` : 'no broken relative links');
  process.exit(bad ? 1 : 0);
}
