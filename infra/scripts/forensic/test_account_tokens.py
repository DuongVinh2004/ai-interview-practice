import sqlite3
import json
import urllib.request
import urllib.error
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

db_path = r'C:\Users\Duong Vinh\AppData\Roaming\9router\db\data.sqlite'
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

cur.execute("SELECT email, data FROM providerConnections WHERE email LIKE '%accdunggemini%';")
rows = cur.fetchall()

for r in rows:
    email = r['email']
    d = json.loads(r['data'])
    token = d.get('accessToken')
    project_id = d.get('projectId', 'aicode-consumers')
    print(f"\n=== Testing API call for {email} ===")

    url = "https://cloudcode-pa.googleapis.com/v1internal:generateCode"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "User-Agent": "antigravity"
    }
    payload = {
        "project": project_id,
        "model": "gemini-3.7-flash-high",
        "request": {
            "contents": [{"role": "user", "parts": [{"text": "ping"}]}]
        }
    }

    req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, context=ctx) as resp:
            print("Status:", resp.status)
            print("Response:", resp.read().decode('utf-8')[:300])
    except urllib.error.HTTPError as e:
        print("HTTP Error:", e.code, e.reason)
        print("Error Body:", e.read().decode('utf-8'))
    except Exception as e:
        print("Error:", e)

conn.close()
