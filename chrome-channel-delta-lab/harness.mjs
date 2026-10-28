import { chromium } from 'playwright';
import fs from 'node:fs';

const BROWSERS = [
  ['stable-156', { channel: 'chrome' }],
  ['bundled-156', {}],
  ['beta-157', { executablePath: 'browsers/157.0.8103.15/chrome-linux64/chrome' }],
  ['dev-158', { executablePath: 'browsers/158.0.8117.2/chrome-linux64/chrome' }],
  ['canary-158', { executablePath: 'browsers/158.0.8127.2/chrome-linux64/chrome' }],
];

const PROBES = {
  // M157: CSS text-overflow <string>
  textOverflow: async (page) => {
    await page.setContent(`<div id="t" style="width:120px;white-space:nowrap;overflow:hidden;text-overflow:' [more]';font:16px monospace">aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa</div>`);
    return await page.evaluate(() => {
      const el = document.getElementById('t');
      return {
        supportsString: CSS.supports('text-overflow', '" [more]"'),
        computed: getComputedStyle(el).textOverflow,
        boxText: el.getBoundingClientRect().width,
      };
    });
  },
  // M157: HTML-in-canvas - empirical prototype diff on 2d context
  htmlInCanvas: async (page) => {
    await page.setContent('<canvas id="c"></canvas>');
    return await page.evaluate(() => {
      const props = Object.getOwnPropertyNames(CanvasRenderingContext2D.prototype).sort();
      const ctx = document.getElementById('c').getContext('2d');
      const novel = props.filter(p => /element|layout|html|dom/i.test(p));
      return { ctxPropCount: props.length, elementish: novel, hasDrawElement: typeof ctx.drawElementImage === 'function' || typeof ctx.drawElement === 'function' };
    });
  },
  // M157: LoAF styleDuration / forcedStyleDuration
  loaf: async (page) => {
    await page.setContent('<div id="x">x</div>');
    return await page.evaluate(() => new Promise((resolve) => {
      const out = { supported: false, entryKeys: [], scriptKeys: [], styleDurationSeen: null };
      if (!PerformanceObserver.supportedEntryTypes.includes('long-animation-frame')) return resolve(out);
      out.supported = true;
      const obs = new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          out.entryKeys = Object.keys(e.toJSON ? e.toJSON() : e);
          out.styleDurationSeen = 'styleDuration' in e;
          if (e.scripts && e.scripts.length) out.scriptKeys = Object.keys(e.scripts[0].toJSON ? e.scripts[0].toJSON() : e.scripts[0]);
          obs.disconnect();
          resolve(out);
        }
      });
      obs.observe({ type: 'long-animation-frame', buffered: false });
      // force a long frame WITH style/layout work
      requestAnimationFrame(() => {
        const el = document.getElementById('x');
        const t0 = performance.now();
        while (performance.now() - t0 < 120) {
          el.style.width = Math.random() * 300 + 'px';
          void el.getBoundingClientRect();
        }
      });
      setTimeout(() => { obs.disconnect(); resolve(out); }, 3000);
    }));
  },
  // M158: ::highlight(*) universal selector
  highlight: async (page) => {
    await page.setContent('<p>hello <span id="s">highlighted</span> world</p>');
    return await page.evaluate(() => {
      const res = { supportsSelector: CSS.supports('selector(::highlight(*))') };
      try {
        const sheet = new CSSStyleSheet();
        sheet.replaceSync('::highlight(*) { color: rgb(1, 2, 3); }');
        res.parsesInSheet = sheet.cssRules.length === 1;
      } catch (e) { res.parsesInSheet = 'threw: ' + e.name; }
      try {
        const h = new Highlight(new Range());
        CSS.highlights.set('probe', h);
        res.highlightApi = true;
      } catch (e) { res.highlightApi = 'threw'; }
      return res;
    });
  },
  // M158: SVG textPath side attribute
  textPathSide: async (page) => {
    await page.setContent(`<svg width="400" height="200"><defs><path id="p" d="M 50 150 A 100 100 0 0 1 350 150" fill="none"/></defs>
      <text><textPath id="tpL" href="#p" side="left">abcdefghij</textPath></text>
      <text><textPath id="tpR" href="#p" side="right">abcdefghij</textPath></text></svg>`);
    await new Promise(r => setTimeout(r, 300));
    return await page.evaluate(() => {
      const tpL = document.getElementById('tpL'), tpR = document.getElementById('tpR');
      const tL = tpL.parentNode, tR = tpR.parentNode;
      const posL = tL.getStartPositionOfChar(0), posR = tR.getStartPositionOfChar(0);
      const endL = tL.getEndPositionOfChar(0), endR = tR.getEndPositionOfChar(0);
      return {
        leftStart: [posL.x, posL.y], rightStart: [posR.x, posR.y],
        leftEnd: [endL.x, endL.y], rightEnd: [endR.x, endR.y],
        identical: posL.x === posR.x && posL.y === posR.y && endL.x === endR.x && endL.y === endR.y,
        attributeReadsBack: tpR.getAttribute('side') === 'right',  // attribute round-trip only, NOT support proof
      };
    });
  },
};

const results = {};
for (const [name, opts] of BROWSERS) {
  const browser = await chromium.launch({ headless: true, ...opts });
  const version = browser.version();
  results[name] = { version };
  const page = await browser.newPage();
  for (const [probe, fn] of Object.entries(PROBES)) {
    try { results[name][probe] = await fn(page); }
    catch (e) { results[name][probe] = { error: e.message.split('\n')[0] }; }
  }
  await browser.close();
  console.log(name, version, 'done');
}
fs.mkdirSync('research', { recursive: true });
fs.writeFileSync(`research/results-${Date.now()}.json`, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
