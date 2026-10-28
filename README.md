# mdlinks

A tiny command-line tool that finds broken relative links in Markdown files. No dependencies, Node 18+.

```sh
node mdlinks.mjs docs/      # check a folder
node mdlinks.mjs README.md  # check one file
```

It skips web URLs, `#anchors` and fenced code blocks, and exits with code 1 if it finds a broken link, so it can run in CI.

## Limits
- It checks that the target file exists. It does not check that a `#heading` anchor exists.
- Reference-style links (`[text][id]`) are not read.

Malformed percent escapes in relative targets are reported as broken links, not fatal parser errors, so the scan continues to the remaining links.

## Test
`npm test`

## Article proof-of-concept labs

This repo also hosts runnable companions to technical articles. Each lab lives in its own folder with its own README:

- `chrome-channel-delta-lab/` - measured deltas for five browser features across Chrome 156-158 builds (Playwright harness, probe scripts, results JSONs, figures).
- `outbox-pattern-demo/` - transactional outbox pattern: three crash scenarios on node:sqlite, five assertions (`./run-demo.sh`, Node 22).
