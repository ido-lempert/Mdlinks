import { chromium } from 'playwright';
import fs from 'node:fs';
const BROWSERS = [
  ['stable-156', { channel: 'chrome' }],
  ['bundled-156', {}],
  ['beta-157', { executablePath: 'browsers/157.0.8103.15/chrome-linux64/chrome' }],
  ['dev-158', { executablePath: 'browsers/158.0.8117.2/chrome-linux64/chrome' }],
  ['canary-158', { executablePath: 'browsers/158.0.8127.2/chrome-linux64/chrome' }],
];
const results = {};
for (const [name, opts] of BROWSERS) {
  const b = await chromium.launch({ headless: true, ...opts });
  const page = await b.newPage();
  const r = { version: b.version() };

  // 1. drawElementImage: arity + actual render attempt
  await page.setContent('<canvas id="c" width="100" height="50"></canvas><div id="src" style="width:50px;height:20px;background:#f00">hi</div>');
  r.drawElement = await page.evaluate(async () => {
    const ctx = document.getElementById('c').getContext('2d');
    if (typeof ctx.drawElementImage !== 'function') return { present: false };
    const out = { present: true, arity: ctx.drawElementImage.length };
    try {
      await ctx.drawElementImage(document.getElementById('src'), 0, 0);
      const px = ctx.getImageData(10, 10, 1, 1).data;
      out.rendered = [px[0], px[1], px[2], px[3]];
    } catch (e) { out.error = e.name + ': ' + e.message.slice(0, 120); }
    return out;
  });

  // 2. ::highlight(*) cascade: pseudo-aware getComputedStyle probe
  await page.setContent('<p>aa <span id="one">one</span> bb <span id="two">two</span> cc</p>');
  r.highlightCascade = await page.evaluate(() => {
    const out = {};
    const mk = (id, name) => { const range = new Range(); range.selectNodeContents(document.getElementById(id)); CSS.highlights.set(name, new Highlight(range)); };
    try {
      mk('one', 'base'); mk('two', 'named');
      const sheet = new CSSStyleSheet();
      sheet.replaceSync('::highlight(*) { background-color: rgb(255, 255, 0); } ::highlight(named) { background-color: rgb(0, 0, 255); }');
      document.adoptedStyleSheets = [sheet];
      out.rulesParsed = sheet.cssRules.length;
      try { out.starComputed = getComputedStyle(document.getElementById('one'), '::highlight(base)').backgroundColor; } catch (e) { out.starComputed = 'threw ' + e.name; }
      try { out.namedComputed = getComputedStyle(document.getElementById('two'), '::highlight(named)').backgroundColor; } catch (e) { out.namedComputed = 'threw ' + e.name; }
      try { out.viaStar = getComputedStyle(document.getElementById('one'), '::highlight(*)').backgroundColor; } catch (e) { out.viaStar = 'threw ' + e.name; }
    } catch (e) { out.error = e.name + ': ' + e.message.slice(0, 100); }
    return out;
  });

  // 3. text-overflow two-value syntax
  r.textOverflow2 = await page.evaluate(() => ({
    twoStrings: CSS.supports('text-overflow', '"L" "R"'),
    stringEllipsis: CSS.supports('text-overflow', '"L" ellipsis'),
  }));

  // 4. textPath lengths + glyph rotation
  await page.setContent(`<svg width="400" height="200"><defs><path id="p" d="M 50 150 A 100 100 0 0 1 350 150" fill="none"/></defs>
    <text font-size="20"><textPath id="L" href="#p" side="left">measure me</textPath></text>
    <text font-size="20"><textPath id="R" href="#p" side="right">measure me</textPath></text></svg>`);
  r.textPathDeep = await page.evaluate(() => {
    const L = document.getElementById('L').parentNode, R = document.getElementById('R').parentNode;
    const g = (t, i, f) => { try { return Math.round(t[f](i) * 100) / 100; } catch (e) { return 'threw'; } };
    const p = (t, i) => { try { const pt = t.getStartPositionOfChar(i); return { x: Math.round(pt.x * 100) / 100, y: Math.round(pt.y * 100) / 100 }; } catch (e) { return 'threw'; } };
    return {
      lenLeft: Math.round(L.getComputedTextLength() * 100) / 100,
      lenRight: Math.round(R.getComputedTextLength() * 100) / 100,
      rotLeft0: g(L, 0, 'getRotationOfChar'), rotRight0: g(R, 0, 'getRotationOfChar'),
      startLeft: p(L, 0), startRight: p(R, 0),
    };
  });

  results[name] = r;
  await b.close();
  console.log(name, 'done');
}
fs.mkdirSync('research', { recursive: true });
fs.writeFileSync(`research/deep-${Date.now()}.json`, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
