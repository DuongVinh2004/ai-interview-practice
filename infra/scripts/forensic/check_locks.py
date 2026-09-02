import sqlite3
import json
from datetime import datetime

db_path = r"C:\Users\Duong Vinh\AppData\Roaming\9router\db\data.sqlite"
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

cur.execute("SELECT id, email, priority, isActive, data FROM providerConnections WHERE provider='antigravity';")
rows = cur.fetchall()

print(f"Current Time UTC: {datetime.utcnow().isoformat()}Z")
for r in rows:
    data = json.loads(r['data'])
    print(f"\nAccount: {r['email']} (ID: {r['id']}, Priority: {r['priority']}, Active: {r['isActive']})")
    locks = {k: v for k, v in data.items() if k.startswith("modelLock_")}
    print("  ModelLocks:", locks)
    for k, v in locks.items():
        if v:
            try:
                lock_time = datetime.fromisoformat(v.replace("Z", "+00:00"))
                is_locked = lock_time.timestamp() > datetime.utcnow().timestamp()
                print(f"    - {k}: {v} (Locked right now? {is_locked})")
            except Exception as e:
                print(f"    - {k}: {v} (parse error: {e})")

cur.execute("SELECT data FROM settings WHERE id=1;")
settings_data = json.loads(cur.fetchone()['data'])
print("\nSettings strategy config:")
print("  stickyRoundRobinLimit:", settings_data.get("stickyRoundRobinLimit"))
print("  providerStrategies:", json.dumps(settings_data.get("providerStrategies", {}), indent=4))
print("  fallbackStrategy (root):", settings_data.get("fallbackStrategy"))

conn.close()
