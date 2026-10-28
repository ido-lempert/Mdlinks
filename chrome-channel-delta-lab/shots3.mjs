import { chromium } from 'playwright';
const BROWSERS = [
  ['stable-156', 'Chrome 156.0.8078.47 (stable)', { channel: 'chrome' }],
  ['canary-158', 'Chrome 158.0.8127.2 (canary)', { executablePath: 'browsers/158.0.8127.2/chrome-linux64/chrome' }],
];
for (const [name, label, opts] of BROWSERS) {
  const b = await chromium.launch({ headless: true, ...opts });
  const page = await b.newPage({ viewport: { width: 640, height: 360 } });
  await page.setContent(`<body style="margin:0;padding:18px;background:#fff;font-family:Arial,sans-serif">
    <div style="font-size:17px;font-weight:700;margin-bottom:8px">${label}</div>
    <svg id="demo" width="560" height="250" viewBox="0 0 560 250">
      <defs><path id="p" d="M 50 210 A 400 400 0 0 1 510 210"/></defs><path d="M 50 210 A 400 400 0 0 1 510 210" fill="none" stroke="#888" stroke-width="2"/>
      <text font-size="38" fill="blue"><textPath href="#p" side="left" startOffset="4">side=left</textPath></text>
      <text font-size="38" fill="red"><textPath href="#p" side="right" startOffset="4">side=right</textPath></text>
    </svg></body>`);
  await page.waitForTimeout(400);
  const box = await page.evaluate(() => {
    const d = document.getElementById('demo').getBoundingClientRect();
    const l = document.querySelector('div').getBoundingClientRect();
    const x = Math.min(d.left, l.left) - 18, y = l.top - 18;
    return { x: Math.max(0, x), y: Math.max(0, y), width: Math.max(d.right, l.right) + 18 - Math.max(0, x), height: Math.max(d.bottom, l.bottom) + 18 - Math.max(0, y) };
  });
  await page.screenshot({ path: `research/fig-textpath-${name}.png`, clip: box });
  console.log(name, 'done');
  await b.close();
}
