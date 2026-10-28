import { chromium } from 'playwright';
const BROWSERS = [
  ['stable-156', { channel: 'chrome' }],
  ['canary-158', { executablePath: 'browsers/158.0.8127.2/chrome-linux64/chrome' }],
];
const PAGES = {
  textoverflow: `<body style="margin:20px;font:16px monospace"><div style="width:200px;white-space:nowrap;overflow:hidden;text-overflow:' [more]';border:1px solid #999;padding:4px">aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa</div></body>`,
  textpath: `<body style="margin:0"><svg width="400" height="200"><defs><path id="p" d="M 50 150 A 100 100 0 0 1 350 150" fill="none" stroke="#ccc"/></defs>
    <text font-size="20" fill="blue"><textPath href="#p" side="left">side=left</textPath></text>
    <text font-size="20" fill="red"><textPath href="#p" side="right">side=right</textPath></text></svg></body>`,
};
for (const [name, opts] of BROWSERS) {
  const b = await chromium.launch({ headless: true, ...opts });
  const page = await b.newPage({ viewport: { width: 420, height: 220 } });
  for (const [p, html] of Object.entries(PAGES)) {
    await page.setContent(html);
    await page.waitForTimeout(400);
    await page.screenshot({ path: `research/shot-${p}-${name}.png` });
  }
  await b.close();
  console.log(name, 'shots done');
}
