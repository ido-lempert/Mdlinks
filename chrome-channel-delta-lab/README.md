# Chrome channel delta lab (Chrome 156 / 157 / 158)

Companion POC for an article about what actually changed between Chrome
milestones 156, 157 and 158, measured by running the same probes against
real browser builds. Chrome Status listings are the claim; the numbers
here are the runtime.

## Measured environment

- OS: Linux x86_64 (kernel 7.2.9), headless (`headless: true`), no extra
  launch flags.
- Node v22.23.4, playwright 1.64.1 (npm package only; its bundled
  chromium was used for one control row).
- Browser builds, versions read from `browser.version()` at runtime:
  - Chrome stable 156.0.8078.47 - system `/usr/bin/google-chrome`,
    launched via Playwright `channel: 'chrome'`.
  - Playwright chromium 156.0.8078.4 - `npx playwright install chromium`.
  - Chrome for Testing beta 157.0.8103.15, dev 158.0.8117.2,
    canary 158.0.8127.2 - hermetic linux64 zips from the official CfT
    feed (https://googlechromelabs.github.io/chrome-for-testing/),
    unzipped under `browsers/<version>/`, launched via `executablePath`.
  - Branded beta/dev installs via `npx playwright install chrome-beta`
    require sudo; the CfT zips avoid that.

## Probes

- `npm run smoke` - launches every build, prints real version strings.
- `npm run round1` - feature-detection matrix across all builds
  (results-round1.json): CSS `text-overflow: <string>`,
  HTML-in-canvas presence, LoAF entry fields, `::highlight(*)`,
  SVG textPath `side`.
- `npm run deep` - behavior probes (results-deep.json):
  `drawElementImage` render contract, `::highlight(*)` cascade via
  pseudo-aware `getComputedStyle`, two-value text-overflow syntax,
  textPath lengths/rotations.
- `npm run loaf` - long-animation-frame entries captured under a heavy
  forced style/layout workload, full `toJSON()` key dumps.
- `npm run draw` - minimal verified `drawElementImage` example
  (canvas `content="drawable"` + child `drawable` attribute), pixel-verified.
- `npm run shots` - visual before/after screenshots
  (fig-*.png committed here; shots2.mjs for text-overflow, shots3.mjs for textPath).

## Headline findings (Oct 28, 2026)

| Feature | 156 stable | 157 beta | 158 dev/canary |
| --- | --- | --- | --- |
| `text-overflow: <string>` | dropped (computes `clip`) | works | works |
| HTML-in-canvas `drawElementImage` | absent | present, renders | present, renders |
| LoAF `styleDuration`/`layoutDuration` + script `forcedStyleDuration` | absent | absent (see note) | present |
| `::highlight(*)` universal selector | rule dropped | rule dropped | parses, cascade verified |
| SVG textPath `side="right"` | ignored | ignored | mirrors layout |

Note: chromestatus.com lists the LoAF fields as "Enabled by default" in
milestone 157, but build 157.0.8103.15 does not emit them under workload;
they first appear in the 158 builds. The reason (later 157 build,
off-by-one listing, staged rollout) is not asserted - only the runtime
evidence is.

Two-value `text-overflow` (`"L" "R"`) is NOT supported in any tested
build; only the single-string form shipped.

Feature entries: chromestatus.com/feature/6294595288825856,
5172548013916160, 5171478175809536, 5174965228929024, 5422782593761280.
