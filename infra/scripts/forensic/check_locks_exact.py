import sqlite3
import json
from datetime import datetime, timezone

db_path = r"C:\Users\Duong Vinh\AppData\Roaming\9router\db\data.sqlite"
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

now_utc = datetime.now(timezone.utc)
print("Now UTC:", now_utc.isoformat())

cur.execute("SELECT id, email, priority, isActive, data FROM providerConnections WHERE provider='antigravity';")
rows = cur.fetchall()

for r in rows:
    data = json.loads(r['data'])
    print(f"\nAccount: {r['email']} (Priority: {r['priority']}, Active: {r['isActive']})")
    locks = {k: v for k, v in data.items() if k.startswith("modelLock_")}
    for k, v in locks.items():
        if v:
            lock_time = datetime.fromisoformat(v.replace("Z", "+00:00"))
            is_locked = lock_time > now_utc
            diff_secs = (lock_time - now_utc).total_seconds()
            print(f"    - {k}: {v} -> is_locked={is_locked} (diff_secs={diff_secs:.1f}s)")
        else:
            print(f"    - {k}: None")

conn.close()
