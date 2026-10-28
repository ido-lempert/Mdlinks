# idempotency-keys-demo

Companion demo for the article "The coupon that was claimed twice". Zero-dependency Node.

```bash
node server.mjs      # demo API on :4290 (naive + idempotent claim endpoints)
node scenarios.mjs   # four narrated scenarios -> demo-transcript.txt
```

Scenarios (real runs, transcript included): naive endpoint + lost response + blind retry = duplicate claim; same failure with an Idempotency-Key = stored result replayed, one claim; double-click mid-flight = 409, one claim; key reuse with a different payload = 422. Single-process in-memory store - proves the protocol semantics, not multi-replica atomicity. See the article's "What it costs" section.
