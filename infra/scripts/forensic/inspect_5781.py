import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

fpath = r"C:\Users\Duong Vinh\AppData\Roaming\npm\node_modules\9router\app\.next-cli-build\server\chunks\4884.js"
with open(fpath, "r", encoding="utf-8", errors="ignore") as f:
    code = f.read()

idx = code.find("5781:(a,b,c)")
if idx != -1:
    print(code[idx : idx + 2500])
