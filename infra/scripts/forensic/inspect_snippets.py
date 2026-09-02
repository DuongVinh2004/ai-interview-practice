import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

fpath = r"C:\Users\Duong Vinh\AppData\Roaming\npm\node_modules\9router\app\.next-cli-build\server\chunks\2283.js"
with open(fpath, "r", encoding="utf-8", errors="ignore") as f:
    code = f.read()

# Let's search around round-robin, providerStrategies, stickyRoundRobinLimit, fallbackStrategy
for match in re.finditer(r'(?:providerStrategies|fallbackStrategy|stickyRoundRobinLimit|modelLock_|rotateStrategy)', code):
    start = max(0, match.start() - 200)
    end = min(len(code), match.end() + 300)
    print("--- SNIPPET ---")
    print(code[start:end])
    print()
