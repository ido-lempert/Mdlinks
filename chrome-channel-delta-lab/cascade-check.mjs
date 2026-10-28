import { chromium } from 'playwright';
import fs from 'node:fs';
// ::highlight cascade probe (M158): does a NAMED highlight rule override the universal ::highlight(*) rule
// when the named rule comes LATER in source order? CSS spec: per-highlight cascade; ::highlight(*) styles
// apply to all custom highlights, but a more specific ::highlight(name) rule should win for that name
// regardless of order? Verify empirically: universal sets green, named sets red AFTER it.
const b = await chromium.launch({ headless: true, executablePath: 'browsers/158.0.8127.2/chrome-linux64/chrome' });
const page = await b.newPage();
const out = await page.evaluate(() => {
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(`
    ::highlight(*) { background-color: rgb(0, 200, 0); }
    ::highlight(named) { background-color: rgb(200, 0, 0); }
  `);
  document.adoptedStyleSheets = [sheet];
  const el = document.createElement('div');
  el.textContent = 'probe text for highlight cascade';
  document.body.appendChild(el);
  const range = new Range();
  range.selectNodeContents(el.firstChild);
  const reg = new Highlight(range);
  CSS.highlights.set('named', reg);
  const bg = getComputedStyle(el, '::highlight(named)').backgroundColor;
  // reversed order: named first, universal after
  sheet.replaceSync(`
    ::highlight(named2) { background-color: rgb(200, 0, 0); }
    ::highlight(*) { background-color: rgb(0, 200, 0); }
  `);
  CSS.highlights.set('named2', reg);
  const bg2 = getComputedStyle(el, '::highlight(named2)').backgroundColor;
  return { namedAfterUniversal: bg, namedBeforeUniversal: bg2, version: navigator.userAgent.match(/Chrome\/[\d.]+/)?.[0] };
});
await b.close();
fs.writeFileSync(`research/cascade-${Date.now()}.json`, JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
