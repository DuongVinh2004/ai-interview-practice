import sqlite3
import json
from datetime import datetime, timezone
import functools
import time

db_path = r"C:\Users\Duong Vinh\AppData\Roaming\9router\db\data.sqlite"

def js_sort_oldest(a, b):
    a_last = a.get("lastUsedAt")
    b_last = b.get("lastUsedAt")
    if a_last or b_last:
        if a_last:
            if b_last:
                t_a = datetime.fromisoformat(a_last.replace("Z", "+00:00")).timestamp()
                t_b = datetime.fromisoformat(b_last.replace("Z", "+00:00")).timestamp()
                return -1 if t_a < t_b else (1 if t_a > t_b else 0)
            return 1 # a has lastUsedAt, b doesn't -> b comes first (return 1)
        return -1 # a doesn't have lastUsedAt, b does -> a comes first (return -1)
    return (a.get("priority") or 999) - (b.get("priority") or 999)

def js_sort_recent(a, b):
    a_last = a.get("lastUsedAt")
    b_last = b.get("lastUsedAt")
    if a_last or b_last:
        if a_last:
            if b_last:
                t_a = datetime.fromisoformat(a_last.replace("Z", "+00:00")).timestamp()
                t_b = datetime.fromisoformat(b_last.replace("Z", "+00:00")).timestamp()
                return -1 if t_b < t_a else (1 if t_b > t_a else 0)
            return -1 # a has lastUsedAt, b doesn't -> a comes first (return -1)
        return 1 # a doesn't have lastUsedAt, b does -> b comes first (return 1)
    return (a.get("priority") or 999) - (b.get("priority") or 999)

# Clean DB state first for testing
conn = sqlite3.connect(db_path)
cur = conn.cursor()
cur.execute("SELECT id, data FROM providerConnections WHERE provider='antigravity';")
for r in cur.fetchall():
    d = json.loads(r[1])
    d.pop('lastUsedAt', None)
    d.pop('consecutiveUseCount', None)
    cur.execute("UPDATE providerConnections SET data=? WHERE id=?", (json.dumps(d), r[0]))
conn.commit()
conn.close()

def simulate_request(req_num):
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    cur.execute("SELECT data FROM settings WHERE id=1;")
    settings_data = json.loads(cur.fetchone()['data'])
    p = settings_data.get("providerStrategies", {}).get("antigravity", {})
    q = p.get("fallbackStrategy", "fill-first")
    sticky_limit = p.get("stickyRoundRobinLimit", 1)

    cur.execute("SELECT * FROM providerConnections WHERE provider='antigravity' AND isActive=1;")
    rows = cur.fetchall()

    # map row to object as in 9Router function h()
    connections = []
    for r in rows:
        d = json.loads(r['data'])
        obj = {**d, 'id': r['id'], 'email': r['email'], 'priority': r['priority'], 'isActive': bool(r['isActive'])}
        connections.append(obj)

    # sort recent
    sorted_recent = sorted(connections, key=functools.cmp_to_key(js_sort_recent))
    c = sorted_recent[0] if sorted_recent else None
    e = c.get("consecutiveUseCount", 0) if c else 0

    if c and c.get("lastUsedAt") and e < sticky_limit:
        b = c
        new_count = e + 1
    else:
        sorted_oldest = sorted(connections, key=functools.cmp_to_key(js_sort_oldest))
        b = sorted_oldest[0]
        new_count = 1

    # update in DB
    now_iso = datetime.now(timezone.utc).isoformat()
    cur.execute("SELECT data FROM providerConnections WHERE id=?", (b['id'],))
    current_data = json.loads(cur.fetchone()[0])
    current_data['lastUsedAt'] = now_iso
    current_data['consecutiveUseCount'] = new_count

    cur.execute("UPDATE providerConnections SET data=? WHERE id=?", (json.dumps(current_data), b['id']))
    conn.commit()
    conn.close()

    return b['email'], b['priority']

print("=== Simulating 12 consecutive requests ===")
for i in range(1, 13):
    email, prio = simulate_request(i)
    print(f"Request #{i:2d} -> Account: {email:<25} (Priority: {prio})")
    time.sleep(0.02)
