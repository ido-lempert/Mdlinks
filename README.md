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

## Test
`npm test`
