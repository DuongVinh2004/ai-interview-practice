import os
import re

for logpath in [r"C:\Users\Duong Vinh\AppData\Roaming\9router\log.txt", r"C:\Users\Duong Vinh\AppData\Roaming\9router\logs\mitm.log"]:
    if os.path.exists(logpath):
        print("=== Log file:", logpath)
        with open(logpath, "r", encoding="utf-8", errors="ignore") as f:
            lines = f.readlines()
            for l in lines[-40:]:
                if any(x in l for x in ["accdunggemini", "5f642b3b", "d4fe5ca6", "403", "AUTH"]):
                    print(l.strip())
