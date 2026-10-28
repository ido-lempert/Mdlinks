# outbox-pattern-demo

Runnable proof for the article "The dashboard that lied: dual writes, one crash, and the
outbox pattern". Three scenarios, five assertions: the naive dual-write bug, the
transactional-outbox fix, and duplicate delivery absorbed by an idempotent consumer.

Honest shortcut, also disclosed in the article: the "queue" is an events table in the same
SQLite file - a zero-dependency stand-in broker. The crash windows are real process kills
at the marked points. Frameable, the company in the article, is fictional; the failure
mode is a composite, not a report about a real product or incident.

## Run

Requires Node 22 (verified on v22.23.4, Linux). No dependencies to install -
node:sqlite and type-stripping are built in (both experimental in this version):

    ./run-demo.sh

Expected: five PASS lines across the three phases and a final ALL PHASES PASS.
demo-transcript.txt holds a captured passing run.

- Phase A: naive endpoint commits, then dies before the queue write - divergence reproduced.
- Phase B: endpoint commits tale + outbox row in one transaction, dies right after COMMIT;
  the row survives, a relay drains it, the dashboard converges.
- Phase C: relay dies after queueing but before marking; the redelivery hits the consumer's
  processed-event ledger and is skipped (duplicatesSkipped=1).
