import sqlite3
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')
db_path = r'C:\Users\Duong Vinh\AppData\Roaming\9router\db\data.sqlite'
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

cur.execute("SELECT id, timestamp, connectionId, model, status, data FROM requestDetails WHERE connectionId IN ('5f642b3b-d24a-446a-a3a8-48b479ca4fba', 'd4fe5ca6-e62d-450f-90e6-cf91b2c45d3c') OR status='error' ORDER BY id DESC LIMIT 5;")
rows = cur.fetchall()
for r in rows:
    print(f"ID: {r['id']} | Connection: {r['connectionId']} | Status: {r['status']}")
    try:
        d = json.loads(r['data'])
        print("Request/Response Data:", json.dumps(d.get('response'), indent=2, ensure_ascii=False))
    except Exception as e:
        print(r['data'])

conn.close()
