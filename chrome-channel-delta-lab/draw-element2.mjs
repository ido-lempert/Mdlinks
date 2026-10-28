import { chromium } from 'playwright';
for (const [name, opts] of [['beta-157', { executablePath: 'browsers/157.0.8103.15/chrome-linux64/chrome' }], ['canary-158', { executablePath: 'browsers/158.0.8127.2/chrome-linux64/chrome' }]]) {
  const b = await chromium.launch({ headless: true, ...opts });
  const page = await b.newPage();
  await page.setContent('<canvas id="c" width="120" height="60" content="drawable"><div id="src" drawable style="background:#f00;width:60px;height:30px;color:#fff">hi</div></canvas>');
  console.log(name, await page.evaluate(async () => {
    try {
      const ctx = document.getElementById('c').getContext('2d');
      await ctx.drawElementImage(document.getElementById('src'), 5, 5);
      const px = ctx.getImageData(10, 10, 1, 1).data;
      const pxOutside = ctx.getImageData(110, 55, 1, 1).data;
      return JSON.stringify({ pixelInside: [px[0], px[1], px[2], px[3]], pixelOutside: [pxOutside[0], pxOutside[1], pxOutside[2], pxOutside[3]] });
    } catch (e) { return 'ERR ' + e.message; }
  }));
  await b.close();
}
