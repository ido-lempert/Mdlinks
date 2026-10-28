import { chromium } from 'playwright';
const BROWSERS = [
  ['beta-157', { executablePath: 'browsers/157.0.8103.15/chrome-linux64/chrome' }],
  ['canary-158', { executablePath: 'browsers/158.0.8127.2/chrome-linux64/chrome' }],
];
for (const [name, opts] of BROWSERS) {
  const b = await chromium.launch({ headless: true, ...opts });
  const page = await b.newPage();
  await page.setContent('<div id="x">x</div>'.repeat(500));
  const out = await page.evaluate(() => new Promise((resolve) => {
    const entries = [];
    const obs = new PerformanceObserver((list) => { entries.push(...list.getEntries().map(e => e.toJSON())); });
    obs.observe({ type: 'long-animation-frame', buffered: false });
    const work = () => {
      const els = document.querySelectorAll('#x');
      const t0 = performance.now();
      while (performance.now() - t0 < 250) {
        for (const el of els) el.style.transform = `translateX(${Math.random()*100}px)`;
        void document.body.getBoundingClientRect();
      }
    };
    requestAnimationFrame(work);
    requestAnimationFrame(() => requestAnimationFrame(work));
    setTimeout(() => { obs.disconnect(); resolve(entries); }, 4000);
  }));
  console.log('==', name, b.version(), '| entries:', out.length);
  for (const e of out.slice(0, 2)) {
    console.log('  keys:', Object.keys(e).join(','));
    console.log('  styleDuration:', e.styleDuration, '| layoutDuration:', e.layoutDuration, '| styleAndLayoutStart:', e.styleAndLayoutStart, '| scripts[0].forcedStyleDuration:', e.scripts?.[0]?.forcedStyleDuration, '| scripts[0].forcedStyleAndLayoutDuration:', e.scripts?.[0]?.forcedStyleAndLayoutDuration);
  }
  await b.close();
}
