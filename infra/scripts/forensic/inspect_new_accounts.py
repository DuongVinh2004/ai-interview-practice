import sqlite3
import json
import sys
from datetime import datetime, timezone

sys.stdout.reconfigure(encoding='utf-8')
db_path = r'C:\Users\Duong Vinh\AppData\Roaming\9router\db\data.sqlite'
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

now_utc = datetime.now(timezone.utc)
print('Current UTC:', now_utc.isoformat())

cur.execute("SELECT id, email, name, priority, isActive, data, updatedAt FROM providerConnections WHERE provider='antigravity';")
rows = cur.fetchall()
print(f'Total antigravity accounts: {len(rows)}')

for r in rows:
    data = json.loads(r['data'])
    print('----------------------------------------')
    print(f"Account: {r['email']} | Name: {r['name']} | ID: {r['id'][:8]} | Priority: {r['priority']} | Active: {r['isActive']}")
    print(f"  testStatus: {data.get('testStatus')} | backoffLevel: {data.get('backoffLevel')} | errorCode: {data.get('errorCode')}")
    print(f"  lastError: {data.get('lastError')} | lastErrorAt: {data.get('lastErrorAt')}")
    print(f"  lastUsedAt: {data.get('lastUsedAt')} | consecutiveUseCount: {data.get('consecutiveUseCount')}")
    print(f"  lastRefreshAt: {data.get('lastRefreshAt')} | expiresAt: {data.get('expiresAt')}")
    locks = {k: v for k, v in data.items() if k.startswith('modelLock_')}
    if locks:
        print('  Locks:', locks)

# Check recent requests in usageHistory
cur.execute("SELECT id, timestamp, provider, model, connectionId, status FROM usageHistory WHERE provider='antigravity' ORDER BY id DESC LIMIT 15;")
uh_rows = cur.fetchall()
print('\n=== Recent 15 Antigravity Usage Records ===')
for u in uh_rows:
    print(dict(u))

# Check logs table if exists
cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='logs';")
if cur.fetchone():
    cur.execute("SELECT id, timestamp, level, scope, message FROM logs ORDER BY id DESC LIMIT 10;")
    log_rows = cur.fetchall()
    print('\n=== Recent 10 System Logs ===')
    for l in log_rows:
        print(dict(l))

conn.close()
