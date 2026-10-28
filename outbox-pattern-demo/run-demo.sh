#!/bin/bash
# Outbox pattern demo: real processes, real crashes, file-backed SQLite.
cd "$(dirname "$0")"
DB=demo.db; rm -f $DB $DB-wal $DB-shm
TSX="node --experimental-strip-types --no-warnings"
seed() { $TSX -e "import {openDb} from './src/db.ts'; const db=openDb('$DB'); db.prepare(\"INSERT OR REPLACE INTO tales(id,title,status) VALUES('tale-1','Launch tale','draft')\").run(); console.log('seeded tale-1 as draft')"; }
pass() { echo "PASS: $1"; }; fail() { echo "FAIL: $1"; EXIT=1; }
EXIT=0

echo "=== PHASE A: naive dual-write, crash between DB commit and queue publish ==="
seed
$TSX src/api-naive.ts $DB tale-1 --crash-between
R=$($TSX src/verify.ts $DB tale-1)
echo "state: $R"
echo "$R" | grep -q '"dbStatus":"published","dashboardStatus":null' \
  && pass "divergence reproduced: DB says published, dashboard never heard about it" \
  || fail "expected DB/dashboard divergence"

echo; echo "=== PHASE B: outbox, API crashes AFTER commit; relay drains later ==="
rm -f $DB $DB-wal $DB-shm; seed
$TSX src/api-outbox.ts $DB tale-1 --crash-after-commit
R=$($TSX src/verify.ts $DB tale-1); echo "after API crash: $R"
echo "$R" | grep -q '"outboxPending":1' && pass "outbox row survived the crash, pending relay" || fail "outbox row missing after crash"
$TSX src/relay.ts $DB
$TSX src/consumer.ts $DB
R=$($TSX src/verify.ts $DB tale-1); echo "after relay+consumer: $R"
echo "$R" | grep -q '"dbStatus":"published","dashboardStatus":"published","outboxPending":0' \
  && pass "system converged without any data loss" || fail "system did not converge"

echo; echo "=== PHASE C: relay dies mid-publish; duplicate delivered; consumer dedupes ==="
rm -f $DB $DB-wal $DB-shm; seed
$TSX src/api-outbox.ts $DB tale-1 >/dev/null
$TSX src/relay.ts $DB --die-mid-publish
$TSX src/relay.ts $DB            # relay retries the same outbox row -> duplicate event in queue
C=$($TSX src/consumer.ts $DB); echo "consumer: $C"
echo "$C" | grep -q 'duplicatesSkipped=1' && pass "duplicate delivery skipped by idempotency ledger" || fail "duplicate not skipped"
R=$($TSX src/verify.ts $DB tale-1); echo "final: $R"
echo "$R" | grep -q '"dashboardStatus":"published"' && pass "dashboard correct despite duplicate" || fail "dashboard wrong after duplicate"

echo; [ $EXIT -eq 0 ] && echo "ALL PHASES PASS" || echo "SOME PHASES FAILED"
exit $EXIT
