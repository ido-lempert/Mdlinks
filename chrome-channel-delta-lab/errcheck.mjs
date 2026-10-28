import { chromium } from 'playwright';
const b = await chromium.launch({ headless: true, executablePath: 'browsers/157.0.8103.15/chrome-linux64/chrome' });
const page = await b.newPage();
const out = await page.evaluate(async () => {
  const errs = {};
  // canvas without content=drawable
  const c1 = document.createElement('canvas');
  const d1 = document.createElement('div');
  try { await c1.getContext('2d').drawElementImage(d1, 0, 0); } catch (e) { errs.noContent = e.message; }
  // canvas with content=drawable, child without drawable
  const c2 = document.createElement('canvas');
  c2.setAttribute('content', 'drawable');
  const d2 = document.createElement('div');
  try { await c2.getContext('2d').drawElementImage(d2, 0, 0); } catch (e) { errs.noDrawable = e.message; }
  return errs;
});
console.log(JSON.stringify(out, null, 1));
await b.close();
