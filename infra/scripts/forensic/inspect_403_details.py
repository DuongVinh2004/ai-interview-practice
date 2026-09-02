import sqlite3
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')
db_path = r'C:\Users\Duong Vinh\AppData\Roaming\9router\db\data.sqlite'
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

# Check full data for accdunggemini1 and accdunggemini2
cur.execute("SELECT id, email, name, data FROM providerConnections WHERE email LIKE '%accdunggemini%';")
for r in cur.fetchall():
    print(f"=== {r['email']} ===")
    d = json.loads(r['data'])
    # redact token
    if 'accessToken' in d:
        d['accessToken'] = d['accessToken'][:15] + '...'
    if 'refreshToken' in d:
        d['refreshToken'] = d['refreshToken'][:15] + '...'
    print(json.dumps(d, indent=2, ensure_ascii=False))

# Check logs table for 403 or these connection IDs
cur.execute("SELECT * FROM logs WHERE message LIKE '%5f642b3b%' OR message LIKE '%d4fe5ca6%' OR message LIKE '%403%' ORDER BY id DESC LIMIT 20;")
rows = cur.fetchall()
print("\n=== Relevant Logs ===")
for r in rows:
    print(dict(r))

conn.close()
