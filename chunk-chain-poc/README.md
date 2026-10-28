# chunk-chain-poc

"Publish without a server": split a file into text chunks, post them as a chained set of
plain text posts, share the FIRST link. Anyone with the link rebuilds the file in their
browser and downloads it. Browser-only client (no build step, one ES module).

> Controlled-environment demo: the relay in `server.mjs` is a LOCAL simulated text-post
> store standing in for a real destination. No external site is touched. A real deployment
> needs a destination that explicitly permits publishing file chunks as text at this volume
> (assessed separately; Nostr relays are the lead candidate class, policies unverified).

## Run

```bash
node server.mjs   # simulated relay + studio UI on http://localhost:4291
```

Open the page, **Generate 50MB demo content** (or pick any file), **Split and publish chain**,
copy the start-of-chain link, paste it in step 2, **Rebuild and download**. The chaos
checkbox kills 5 random single replicas first to exercise the failover path.

Headless verification: `node verify.mjs` (50MB full flow + fault injection),
`node verify2.mjs` (replica-fill path).

## Design

- File -> 48KB raw chunks -> base64 (~64KB, fits a 70KB text-post cap) -> one post per chunk
  per replica (default 2 replicas).
- A manifest carries name, size, whole-file sha256, and per-chunk {post ids, sha256, length}.
  **The manifest itself is chained** (120 entries per part, each part pointing at the next):
  at 50MB the manifest is ~120KB and exceeds a single post - a real constraint found by
  running, not by reading specs.
- The share link is the manifest part-0 post. Reconstruction walks the manifest chain,
  fetches every chunk with replica failover, verifies each chunk's hash and the whole-file
  hash, then offers the rebuilt file as a download.
- Reader-consented re-replication caveat: reposting a lost chunk creates a NEW post id, so a
  static manifest cannot point at it. Revival means publishing a new chain with a new share
  link (or adding a mutable pointer layer). Documented because it shapes the real product.

## Verified (Oct 28, 2026, local, Chrome canary 158 + Node 22)

| Check | Result |
| --- | --- |
| 50MB deterministic content -> chain -> rebuild | 52,428,800 bytes, sha256 `8792e336...59b6c6` exact, 1067 chunks x2 replicas, published ~10s, rebuilt ~10s (loopback) |
| 5 single-replica deletions before rebuild | all filled from surviving replicas (`replicaFills: 5`), bytes exact |
| Both replicas of one chunk deleted | rebuild correctly fails, names the unrecoverable chunk |
| Replica-fill path (6MB, 2 single deletions) | `replicaFills: 2`, byte-identical |

Loopback timings are not network benchmarks. 50MB as text posts is ~2200 posts; on a real
destination, volume, rate limits and abuse policy are the binding constraints, not speed.
