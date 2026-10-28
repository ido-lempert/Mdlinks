# outbox-pattern-demo

Runnable proof for the article "The dashboard that lied: dual writes, one crash, and the
outbox pattern". Four scenarios, eight assertions: the naive dual-write bug, the
transactional-outbox fix, duplicate delivery absorbed by an idempotent consumer, and
two concurrent consumers applying 50 events exactly once.

Honest shortcuts, also disclosed in the article: the "queue" is an events table in the same
SQLite file - a zero-dependency stand-in broker. The crash windows are the processes
self-terminating at injected points via process.exit(1) - abrupt, but not an externally
delivered SIGKILL or power loss. Concurrent access relies on PRAGMA busy_timeout = 5000,
a finite wait that covers this demo's contention, not a general guarantee. Frameable, the company in the article, is fictional and the outage story is
invented; the dual-write failure mode it illustrates is real and well documented.
It is not a report about any real product, customer, or incident.

## Run

Requires Node 22 (verified on v22.23.4, Linux). No dependencies to install -
node:sqlite and type-stripping are built in (both experimental in this version):

    git clone https://github.com/ido-lempert/Mdlinks.git
    cd Mdlinks/outbox-pattern-demo
    ./run-demo.sh

Expected: eight PASS lines across the four phases and a final ALL PHASES PASS.
demo-transcript.txt holds a captured passing run.

- Phase A: naive endpoint commits, then dies before the queue write - divergence reproduced.
- Phase B: endpoint commits tale + outbox row in one transaction, dies right after COMMIT;
  the row survives, a relay drains it, the dashboard converges.
- Phase C: relay exits after queueing but before marking; the redelivery hits the consumer's
  processed-event ledger (checked inside the same BEGIN IMMEDIATE transaction as the
  insert) and is skipped: duplicatesSkipped=1, and the projection's deliberately
  non-idempotent applied_count stays 1 instead of 2.
- Phase D: two consumers run concurrently against 50 events; both exit 0, each event's
  effect is applied exactly once (per event ID - not an ordering or general exactly-once
  claim), and the 50 losing attempts are clean ledger skips. Scoped to local SQLite with
  busy_timeout = 5000; heavier contention can still time out.
