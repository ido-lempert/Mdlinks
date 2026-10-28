import { chromium } from 'playwright';
const BROWSERS = [
  ['stable-156', 'Chrome 156.0.8078.47 (stable)', { channel: 'chrome' }],
  ['canary-158', 'Chrome 158.0.8127.2 (canary)', { executablePath: 'browsers/158.0.8127.2/chrome-linux64/chrome' }],
];
const PAGES = {
  textoverflow: (label) => `<body style="margin:0;padding:18px;background:#fff;font-family:Arial,sans-serif">
    <div style="font-size:15px;font-weight:700;margin-bottom:10px">${label}</div>
    <div id="demo" style="width:340px;white-space:nowrap;overflow:hidden;text-overflow:' [more]';border:1px solid #999;padding:6px;font:22px monospace">aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa</div></body>`,
  textpath: (label) => `<body style="margin:0;padding:18px;background:#fff;font-family:Arial,sans-serif">
    <div style="font-size:15px;font-weight:700;margin-bottom:10px">${label}</div>
    <svg id="demo" width="560" height="220"><defs><path id="p" d="M 60 190 A 160 160 0 0 1 500 190" fill="none" stroke="#bbb"/></defs>
    <text font-size="26" fill="blue"><textPath href="#p" side="left">side=left</textPath></text>
    <text font-size="26" fill="red"><textPath href="#p" side="right">side=right</textPath></text></svg></body>`,
};
for (const [name, label, opts] of BROWSERS) {
  const b = await chromium.launch({ headless: true, ...opts });
  const page = await b.newPage({ viewport: { width: 640, height: 400 } });
  for (const [p, html] of Object.entries(PAGES)) {
    await page.setContent(html(label));
    await page.waitForTimeout(400);
    const box = await page.evaluate(() => {
      const d = document.getElementById('demo').getBoundingClientRect();
      const l = document.querySelector('div').getBoundingClientRect();
      const x = Math.min(d.left, l.left) - 18, y = l.top - 18;
      const r = Math.max(d.right, l.right) + 18, bt = Math.max(d.bottom, l.bottom) + 18;
      return { x: Math.max(0, x), y: Math.max(0, y), width: r - Math.max(0, x), height: bt - Math.max(0, y) };
    });
    await page.screenshot({ path: `research/fig-${p}-${name}.png`, clip: box });
    console.log(name, p, JSON.stringify(box));
  }
  await b.close();
}
