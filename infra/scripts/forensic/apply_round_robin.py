import sqlite3
import json
import shutil
import os
import sys
from datetime import datetime, timezone

sys.stdout.reconfigure(encoding='utf-8')

DB_PATH = r"C:\Users\Duong Vinh\AppData\Roaming\9router\db\data.sqlite"
ALIASES_PATH = r"C:\Users\Duong Vinh\AppData\Roaming\9router\mitm\aliases.json"
BACKUP_DIR = r"C:\Users\Duong Vinh\AppData\Roaming\9router\db\backups"

os.makedirs(BACKUP_DIR, exist_ok=True)
timestamp_str = datetime.now().strftime("%Y%m%d_%H%M%S")

# 1. Backup
db_backup = os.path.join(BACKUP_DIR, f"data_backup_{timestamp_str}.sqlite")
shutil.copy2(DB_PATH, db_backup)
print(f"[1] SQLite backup created: {db_backup}")

if os.path.exists(ALIASES_PATH):
    aliases_backup = os.path.join(BACKUP_DIR, f"aliases_backup_{timestamp_str}.json")
    shutil.copy2(ALIASES_PATH, aliases_backup)
    print(f"[1b] Aliases backup created: {aliases_backup}")

conn = sqlite3.connect(DB_PATH)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

# 2. Update Settings
cur.execute("SELECT id, data FROM settings WHERE id=1;")
settings_row = cur.fetchone()
if settings_row:
    settings_data = json.loads(settings_row['data'])

    # Configure providerStrategies for antigravity
    if "providerStrategies" not in settings_data:
        settings_data["providerStrategies"] = {}

    settings_data["providerStrategies"]["antigravity"] = {
        "fallbackStrategy": "round-robin",
        "stickyRoundRobinLimit": 1
    }
    settings_data["stickyRoundRobinLimit"] = 1
    settings_data["fallbackStrategy"] = "round-robin"

    # Configure mitmAlias for antigravity
    if "mitmAlias" not in settings_data:
        settings_data["mitmAlias"] = {}

    gemini_target = "ag/gemini-3.7-flash-high"
    opus_target = "ag/claude-opus-4-6-thinking"
    sonnet_target = "ag/claude-sonnet-4-6"

    settings_data["mitmAlias"]["antigravity"] = {
        "claude-opus-4-6-thinking": opus_target,
        "claude-sonnet-4-6": sonnet_target,
        "gemini-3.1-pro-high": gemini_target,
        "gemini-3.1-pro-low": gemini_target,
        "gemini-3.1-pro-agent": gemini_target,
        "gemini-3.7-flash-high": gemini_target,
        "gemini-3.7-flash": gemini_target,
        "gemini-3.7-flash-preview": gemini_target,
        "gemini-3.7-pro": gemini_target,
        "gemini-3.7-pro-high": gemini_target,
        "gemini-3-flash": gemini_target,
        "gemini-2.5-flash": gemini_target,
        "gemini-pro-agent": gemini_target,
        "gemini-3-flash-agent": gemini_target,
        "gemini-3.7-flash-agent": gemini_target,
        "gemini-3.7-flash-high-agent": gemini_target,
        "gemini-3.6-flash-high": gemini_target,
        "gemini-3.6-flash-medium": gemini_target,
        "gemini-3.6-flash-low": gemini_target,
        "gemini-3.5-flash-low": gemini_target,
        "gemini-3.5-flash-extra-low": gemini_target,
        "gpt-oss-120b-medium": gemini_target
    }

    cur.execute("UPDATE settings SET data=? WHERE id=1;", (json.dumps(settings_data),))
    print("[2] Table 'settings' updated successfully with antigravity round-robin (sticky limit = 1) and model mapping.")

# 3. Update KV Table for mitmAlias
cur.execute("SELECT scope, key, value FROM kv WHERE scope='mitmAlias' AND key='antigravity';")
kv_row = cur.fetchone()
if kv_row:
    cur.execute("UPDATE kv SET value=? WHERE scope='mitmAlias' AND key='antigravity';", (json.dumps(settings_data["mitmAlias"]["antigravity"]),))
    print("[3] Table 'kv' (scope=mitmAlias, key=antigravity) updated successfully.")

# 4. Clean up providerConnections (unlock all models, reset errors, ensure active)
cur.execute("SELECT id, email, priority, isActive, data FROM providerConnections WHERE provider='antigravity';")
accounts = cur.fetchall()

print(f"[4] Found {len(accounts)} antigravity accounts:")
for acc in accounts:
    acc_id = acc['id']
    email = acc['email']
    data = json.loads(acc['data'])

    # Remove all modelLock_*
    keys_to_delete = [k for k in data.keys() if k.startswith("modelLock_")]
    for k in keys_to_delete:
        del data[k]

    # Clear error flags
    data["errorCode"] = None
    data["lastError"] = None
    data["lastErrorAt"] = None
    data["backoffLevel"] = 0
    data["testStatus"] = "active"

    cur.execute("""
        UPDATE providerConnections
        SET data=?, isActive=1, updatedAt=?
        WHERE id=?
    """, (json.dumps(data), datetime.now(timezone.utc).isoformat(), acc_id))
    print(f"    - Cleaned & activated account: {email} (Priority: {acc['priority']})")

conn.commit()
conn.close()

# 5. Update aliases.json in MITM folder
if os.path.exists(ALIASES_PATH):
    try:
        with open(ALIASES_PATH, "r", encoding="utf-8") as f:
            aliases_file_data = json.load(f)
    except:
        aliases_file_data = {}

    aliases_file_data["antigravity"] = settings_data["mitmAlias"]["antigravity"]

    with open(ALIASES_PATH, "w", encoding="utf-8") as f:
        json.dump(aliases_file_data, f, indent=2)
    print(f"[5] Updated {ALIASES_PATH} successfully.")

print("\n--- ALL CONFIGURATIONS APPLIED SUCCESSFULLY ---")
