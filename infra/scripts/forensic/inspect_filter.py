import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

fpath = r"C:\Users\Duong Vinh\AppData\Roaming\npm\node_modules\9router\app\.next-cli-build\server\chunks\2283.js"
with open(fpath, "r", encoding="utf-8", errors="ignore") as f:
    code = f.read()

idx = code.find("q=p.fallbackStrategy||l.fallbackStrategy||")
if idx != -1:
    print("=== AVAILABLE CONNECTIONS FILTERING ===")
    print(code[idx - 1500 : idx])
