import { chromium } from 'playwright';
import fs from 'node:fs';
// drawElementImage error conditions, one invalid condition per case, child ATTACHED to the canvas.
// Each case isolates exactly one violation so the error text maps to one cause.
const out = {};
for (const [name, opts] of [
  ['beta-157', { executablePath: 'browsers/157.0.8103.15/chrome-linux64/chrome' }],
  ['stable-156', { channel: 'chrome' }],
]) {
  const b = await chromium.launch({ headless: true, ...opts });
  const page = await b.newPage();
  out[name] = { version: b.version(), ...(await page.evaluate(async () => {
    const errs = {};
    // case 1: canvas WITHOUT content="drawable"; child HAS drawable and is attached
    const c1 = document.createElement('canvas');
    const d1 = document.createElement('div');
    d1.setAttribute('drawable', '');
    d1.textContent = 'hello';
    c1.appendChild(d1); document.body.appendChild(c1);
    try { await c1.getContext('2d').drawElementImage(d1, 0, 0); errs.case1 = 'no error'; }
    catch (e) { errs.case1_noContentAttr = e.name + ': ' + e.message; }
    // case 2: canvas WITH content="drawable"; attached child LACKS drawable attribute
    const c2 = document.createElement('canvas');
    c2.setAttribute('content', 'drawable');
    const d2 = document.createElement('div');
    d2.textContent = 'hello';
    c2.appendChild(d2); document.body.appendChild(c2);
    try { await c2.getContext('2d').drawElementImage(d2, 0, 0); errs.case2 = 'no error'; }
    catch (e) { errs.case2_noDrawableAttr = e.name + ': ' + e.message; }
    // case 3 (control): both attributes present, attached - should draw without error
    const c3 = document.createElement('canvas');
    c3.setAttribute('content', 'drawable');
    const d3 = document.createElement('div');
    d3.setAttribute('drawable', '');
    d3.textContent = 'hello';
    c3.appendChild(d3); document.body.appendChild(c3);
    try { await c3.getContext('2d').drawElementImage(d3, 0, 0); errs.case3_control = 'drew without error'; }
    catch (e) { errs.case3_control = e.name + ': ' + e.message; }
    return errs;
  })) };
  await b.close();
}
fs.writeFileSync(`research/errcheck-${Date.now()}.json`, JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
