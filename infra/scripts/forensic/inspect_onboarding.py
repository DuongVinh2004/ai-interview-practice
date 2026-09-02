import re
import sys

sys.stdout.reconfigure(encoding='utf-8')
fpath = r"C:\Users\Duong Vinh\AppData\Roaming\npm\node_modules\9router\app\.next-cli-build\server\chunks\2283.js"
with open(fpath, "r", encoding="utf-8", errors="ignore") as f:
    code = f.read()

for m in re.finditer(r'(?:loadCodeAssist|onboard|antigravity.*token|daily-cloudcode)', code):
    s = max(0, m.start() - 100)
    e = min(len(code), m.end() + 200)
    print(code[s:e])
    print("-" * 50)
