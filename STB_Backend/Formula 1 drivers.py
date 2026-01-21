import base64
import json

# ===== SETTINGS =====
INPUT_FILE = r"C:\Users\joeyz\Downloads\PokePathSave.txt"
OUTPUT_FILE = r"C:\Users\joeyz\Downloads\save_edited.txt"
NEW_GOLD_AMOUNT = 50000000      # ← change this
# ====================

# Read Base64 save
with open(INPUT_FILE, "r", encoding="utf-8") as f:
    save_base64 = f.read().strip()

# Decode Base64 → JSON
decoded_bytes = base64.b64decode(save_base64)
save_data = json.loads(decoded_bytes.decode("utf-8"))

# Edit gold
old_gold = save_data["player"]["gold"]
save_data["player"]["gold"] = NEW_GOLD_AMOUNT

print(f"Gold changed: {old_gold} → {NEW_GOLD_AMOUNT}")

# Encode JSON → Base64
new_json = json.dumps(save_data, separators=(",", ":"))
new_base64 = base64.b64encode(new_json.encode("utf-8")).decode("utf-8")

# Write new save
with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
    f.write(new_base64)

print(f"Edited save written to: {OUTPUT_FILE}")
