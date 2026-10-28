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
$TSX src/api-naive.ts $DB tale-1 --crash-between; AC=$?
[ $AC -ne 0 ] && pass "naive process really crashed (exit code $AC)" || fail "naive process exited 0 - crash not exercised"
Q=$($TSX -e "import {openDb} from './src/db.ts'; const db=openDb('$DB'); console.log((db.prepare('SELECT COUNT(*) c FROM events').get()).c)")
[ "$Q" = "0" ] && pass "queue empty after crash: the event was never published" || fail "events table has $Q rows after crash"
R=$($TSX src/verify.ts $DB tale-1)
echo "state: $R"
echo "$R" | grep -q '"dbStatus":"published","dashboardStatus":null' \
  && pass "divergence reproduced: DB says published, dashboard never heard about it" \
  || fail "expected DB/dashboard divergence"

echo; echo "=== PHASE B: outbox, API crashes AFTER commit; relay drains later ==="
rm -f $DB $DB-wal $DB-shm; seed
$TSX src/api-outbox.ts $DB tale-1 --crash-after-commit; BC=$?
[ $BC -eq 1 ] && echo "  (API exited 1 at the injected crash point, as designed)" || fail "API crash exit code was $BC, expected 1"
R=$($TSX src/verify.ts $DB tale-1); echo "after API crash: $R"
echo "$R" | grep -q '"outboxPending":1' && pass "outbox row survived the crash, pending relay" || fail "outbox row missing after crash"
$TSX src/relay.ts $DB
$TSX src/consumer.ts $DB
R=$($TSX src/verify.ts $DB tale-1); echo "after relay+consumer: $R"
echo "$R" | grep -q '"dbStatus":"published","dashboardStatus":"published","appliedCount":1,"outboxPending":0' \
  && pass "system converged without any data loss" || fail "system did not converge"

echo; echo "=== PHASE C: relay dies mid-publish; duplicate delivered; consumer dedupes ==="
rm -f $DB $DB-wal $DB-shm; seed
$TSX src/api-outbox.ts $DB tale-1 >/dev/null
$TSX src/relay.ts $DB --die-mid-publish; RC=$?
[ $RC -eq 1 ] && echo "  (relay exited 1 at the injected crash point, as designed)" || fail "relay crash exit code was $RC, expected 1"
$TSX src/relay.ts $DB            # relay retries the same outbox row -> duplicate event in queue
C=$($TSX src/consumer.ts $DB); echo "consumer: $C"
echo "$C" | grep -q 'duplicatesSkipped=1' && pass "duplicate delivery skipped by idempotency ledger" || fail "duplicate not skipped"
R=$($TSX src/verify.ts $DB tale-1); echo "final: $R"
echo "$R" | grep -q '"dashboardStatus":"published","appliedCount":1' && pass "dashboard correct despite duplicate; effect applied exactly once (applied_count=1, a non-idempotent counter would read 2 without the ledger)" || fail "dashboard wrong or duplicate effect applied"

echo; echo "=== PHASE D: two concurrent consumers, 50 events - lock-wait, no crash, exactly-once ==="
rm -f $DB $DB-wal $DB-shm; seed >/dev/null
$TSX -e "import {openDb} from './src/db.ts'; const db=openDb('$DB'); for (let i=1;i<=50;i++) db.prepare(\"INSERT INTO events(id,type,payload) VALUES(?,?,?)\").run('ev-'+i, 'tale.published', JSON.stringify({taleId:'tale-r-'+i})); console.log('seeded 50 events')"
$TSX src/consumer.ts $DB > /tmp/consumer1.log 2>&1 & C1=$!
$TSX src/consumer.ts $DB > /tmp/consumer2.log 2>&1 & C2=$!
wait $C1; R1=$?; wait $C2; R2=$?
cat /tmp/consumer1.log /tmp/consumer2.log
A=$(grep -h -o 'applied=[0-9]*' /tmp/consumer1.log /tmp/consumer2.log | awk -F= '{s+=$2} END {print s}')
D=$(grep -h -o 'duplicatesSkipped=[0-9]*' /tmp/consumer1.log /tmp/consumer2.log | awk -F= '{s+=$2} END {print s}')
{ [ $R1 -eq 0 ] && [ $R2 -eq 0 ] && [ "$A" = "50" ] && [ "$D" = "50" ]; } \
  && pass "concurrent consumers: both exited 0 (busy_timeout, no lock crash), 50 events applied exactly once, 50 duplicate attempts skipped cleanly" \
  || fail "concurrency regression: exit $R1/$R2 applied=$A dupes=$D"

echo; [ $EXIT -eq 0 ] && echo "ALL PHASES PASS" || echo "SOME PHASES FAILED"
exit $EXIT
