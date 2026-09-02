import sqlite3
import json
from datetime import datetime, timezone
import time

db_path = r"C:\Users\Duong Vinh\AppData\Roaming\9router\db\data.sqlite"

def get_db():
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn

def simulate_9router_connection_selection(provider="antigravity", model="gemini-3.7-flash-high"):
    conn = get_db()
    cur = conn.cursor()

    # 1. Fetch settings
    cur.execute("SELECT data FROM settings WHERE id=1;")
    settings_data = json.loads(cur.fetchone()['data'])

    p = settings_data.get("providerStrategies", {}).get(provider, {})
    q = p.get("fallbackStrategy", settings_data.get("fallbackStrategy", "fill-first"))
    sticky_limit = p.get("stickyRoundRobinLimit", settings_data.get("stickyRoundRobinLimit", 3))

    # 2. Fetch connections
    cur.execute("SELECT * FROM providerConnections WHERE provider=? AND isActive=1;", (provider,))
    connections = [dict(r) for r in cur.fetchall()]
    for c in connections:
        c['data'] = json.loads(c['data'])

    # 3. Filter model locks
    now_utc = datetime.now(timezone.utc)
    available = []
    for c in connections:
        data = c['data']
        lock_val = data.get(f"modelLock_{model}") or data.get("modelLock___all")
        if lock_val:
            lock_time = datetime.fromisoformat(lock_val.replace("Z", "+00:00"))
            if lock_time > now_utc:
                continue # locked
        available.append(c)

    if not available:
        conn.close()
        return None, "All accounts unavailable/locked"

    selected = None
    if q == "round-robin":
        # 9Router algorithm:
        # Check consecutive use count of most recently used account
        def sort_recent(acc):
            last_used = acc['data'].get("lastUsedAt")
            if last_used:
                return (0, -datetime.fromisoformat(last_used.replace("Z", "+00:00")).timestamp())
            return (1, acc.get("priority", 999))

        def sort_oldest(acc):
            last_used = acc['data'].get("lastUsedAt")
            if last_used:
                return (0, datetime.fromisoformat(last_used.replace("Z", "+00:00")).timestamp())
            return (1, acc.get("priority", 999))

        # Check most recently used
        sorted_by_recent = sorted(available, key=sort_recent)
        most_recent = sorted_by_recent[0] if sorted_by_recent else None

        last_used_at = most_recent['data'].get("lastUsedAt") if most_recent else None
        consecutive_count = most_recent['data'].get("consecutiveUseCount", 0) if most_recent else 0

        if most_recent and last_used_at and consecutive_count < sticky_limit:
            selected = most_recent
            new_consecutive = (selected['data'].get("consecutiveUseCount", 0)) + 1
        else:
            sorted_by_oldest = sorted(available, key=sort_oldest)
            selected = sorted_by_oldest[0]
            new_consecutive = 1

        # Update connection in DB
        selected['data']['lastUsedAt'] = datetime.now(timezone.utc).isoformat()
        selected['data']['consecutiveUseCount'] = new_consecutive

        cur.execute("UPDATE providerConnections SET data=? WHERE id=?",
                    (json.dumps(selected['data']), selected['id']))
        conn.commit()
    else:
        # Priority / fill-first
        sorted_by_priority = sorted(available, key=lambda x: x.get("priority", 999))
        selected = sorted_by_priority[0]

    conn.close()
    return selected['email'], f"Strategy={q}, StickyLimit={sticky_limit}"

print("=== Simulating 8 successive requests through 9Router Round-Robin ===")
for i in range(1, 9):
    email, info = simulate_9router_connection_selection()
    print(f"Request #{i}: Routed to -> {email} ({info})")
    time.sleep(0.01)
