import sqlite3
import json
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

db_path = r"C:\Users\Duong Vinh\AppData\Roaming\9router\db\data.sqlite"
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

cur.execute("SELECT name FROM sqlite_master WHERE type='table';")
tables = [r[0] for r in cur.fetchall()]
print("Tables in DB:", tables)

for t in tables:
    if t == 'logs':
        cur.execute("SELECT COUNT(*) FROM logs;")
        print(f"\n--- TABLE {t} (Count: {cur.fetchone()[0]}) ---")
        continue

    print(f"\n==================== TABLE: {t} ====================")
    cur.execute(f"PRAGMA table_info({t});")
    cols = [c[1] for c in cur.fetchall()]
    print("Columns:", cols)
    cur.execute(f"SELECT * FROM {t};")
    rows = cur.fetchall()
    print(f"Total rows: {len(rows)}")
    for r in rows:
        d = dict(r)
        for k, v in d.items():
            if isinstance(v, str) and (v.startswith('{') or v.startswith('[')):
                try:
                    d[k] = json.loads(v)
                except:
                    pass
        print(json.dumps(d, indent=2, ensure_ascii=False))

conn.close()
