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
  forced style/layout workload, full `toJSON()` key dumps. Writes a
  timestamped JSON under `research/` (not committed at top level).
- `npm run draw` - minimal verified `drawElementImage` example
  (canvas `content="drawable"` + child `drawable` attribute), pixel-verified.
- `npm run shots` - visual before/after screenshots
  (fig-*.png committed here; shots2.mjs for text-overflow, shots3.mjs for textPath).
- `npm run errcheck` - captures the verbatim `drawElementImage`
  exception messages on beta 157 (results-errcheck.json).
- `npm run cascade` - verifies the `::highlight(*)` cascade in both
  source orders on canary 158 (results-cascade.json).

Raw outputs from the author's runs: results-round1.json (five builds
incl. the Playwright bundled-chromium control), results-deep.json,
results-errcheck.json, results-cascade.json. LoAF probe output is
per-run under `research/`; the article's quoted 150-170ms
`forcedStyleDuration` range comes from the author's October 28 loaf
runs and is a noisy single-machine figure. The reviewer's independent
loaf reruns are archived in senior-evidence (rerun-loaf.log,
rerun-loaf-all-run2.log).

Provenance: results-*.json are the author's measurements. senior-evidence/
is NOT author output - it archives an independent reviewer's rerun logs
(rerun-*.log) and their own chromestatus captures (cs-*.json.clean), kept
separate so the two sources are never conflated. Two of the author's
scripts are deliberately separate tests: errcheck.mjs captures the
verbatim exception contract (negative path), and draw-element2.mjs is the
positive render control (pixel-verified).

## Setup from a fresh clone

```sh
npm ci                          # playwright 1.64.1 (pinned in package-lock)
npx playwright install chromium # bundled control row

# Chrome for Testing rows (official feed; pick the versions above):
for v in 157.0.8103.15 158.0.8117.2 158.0.8127.2; do
  curl -LO "https://storage.googleapis.com/chrome-for-testing-public/$v/linux64/chrome-linux64.zip"
  mkdir -p "browsers/$v" && unzip -q chrome-linux64.zip -d "browsers/$v"
done

# Stable row needs a system Chrome: /usr/bin/google-chrome (channel: 'chrome').
```

The scripts create their `research/` output directory themselves; each run
writes a timestamped JSON there. The committed results-*.json at the top
level are the author's October 28, 2026 runs.

## Headline findings (Oct 28, 2026)

| Feature | 156 stable | 157 beta | 158 dev/canary |
| --- | --- | --- | --- |
| `text-overflow: <string>` | dropped (computes `clip`) | works | works |
| HTML-in-canvas `drawElementImage` | absent | present, renders | present, renders |
| LoAF `styleDuration`/`layoutDuration` + script `forcedStyleDuration` | absent | absent (see note) | present |
| `::highlight(*)` universal selector | rule dropped | rule dropped | parses, cascade verified |
| SVG textPath `side="right"` | ignored | ignored | reverses text direction along the path |

The beta / dev / canary columns are prerelease builds; presence there
is not a stable-shipping claim. The 156 stable column is branded Chrome,
the other builds are Chrome for Testing plus the Playwright control.

Note: the chromestatus M157 roadmap groups the LoAF fields under its
"Enabled by default" bucket (the planned shipping mode for the milestone),
while the feature's own detail page still reads Proposed, unreleased, with
a future-tense rollout plan. Build 157.0.8103.15 does not emit the fields
under workload; they first appear in the 158 builds. A later 157 build may
still ship them. The reason (later 157 build, off-by-one listing, staged
rollout) is not asserted - only the runtime evidence is.

Two-value `text-overflow` (`"L" "R"`) is NOT supported in any tested
build; only the single-string form is supported in any tested build.

Feature entries: chromestatus.com/feature/6294595288825856,
5172548013916160, 5171478175809536, 5174965228929024, 5422782593761280.
