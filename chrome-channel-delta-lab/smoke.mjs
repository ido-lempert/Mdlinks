import { chromium } from 'playwright';
const targets = [
  ['stable-system-156', { channel: 'chrome' }],
  ['beta-cft-157', { executablePath: 'browsers/157.0.8103.15/chrome-linux64/chrome' }],
  ['dev-cft-158', { executablePath: 'browsers/158.0.8117.2/chrome-linux64/chrome' }],
  ['canary-cft-158', { executablePath: 'browsers/158.0.8127.2/chrome-linux64/chrome' }],
  ['playwright-chromium', {}],
];
for (const [name, opts] of targets) {
  try {
    const b = await chromium.launch({ headless: true, ...opts });
    console.log(name, '| version():', b.version());
    await b.close();
  } catch (e) {
    console.log(name, '| FAILED:', e.message.split('\n')[0]);
  }
}
