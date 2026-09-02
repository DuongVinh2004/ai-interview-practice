import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

fpath = r"C:\Users\Duong Vinh\AppData\Roaming\9router\runtime\mitm\server.js"
with open(fpath, "r", encoding="utf-8", errors="ignore") as f:
    code = f.read()

print("Length of mitm/server.js:", len(code))
for m in re.finditer(r'(?:alias|mitmAlias|aliases\.json|modelMapping)', code, re.IGNORECASE):
    s = max(0, m.start() - 100)
    e = min(len(code), m.end() + 150)
    print(code[s:e])
    print("-" * 50)
