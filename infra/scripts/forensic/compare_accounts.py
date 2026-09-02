import sqlite3
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')
db_path = r'C:\Users\Duong Vinh\AppData\Roaming\9router\db\data.sqlite'
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

cur.execute("SELECT id, email, name, priority, isActive, data FROM providerConnections WHERE provider='antigravity';")
rows = cur.fetchall()

for r in rows:
    data = json.loads(r['data'])
    print(f"=== {r['email']} (Priority: {r['priority']}, Active: {r['isActive']}) ===")
    print(f"  projectId: {data.get('projectId')}")
    print(f"  testStatus: {data.get('testStatus')}")
    print(f"  errorCode: {data.get('errorCode')}")
    print(f"  lastError: {data.get('lastError')}")
    print(f"  lastErrorAt: {data.get('lastErrorAt')}")
    print(f"  modelLocks: {[k for k in data.keys() if k.startswith('modelLock_')]}")
    print(f"  lastRefreshAt: {data.get('lastRefreshAt')}")
    print(f"  expiresAt: {data.get('expiresAt')}")
    print(f"  has_accessToken: {bool(data.get('accessToken'))}")
    print(f"  has_refreshToken: {bool(data.get('refreshToken'))}")

conn.close()
