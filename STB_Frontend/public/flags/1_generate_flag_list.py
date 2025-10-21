import os
import json

# Path to your flags folder (adjust if needed)
FLAGS_FOLDER = os.path.dirname(os.path.abspath(__file__))
OUTPUT_FILE = os.path.join(FLAGS_FOLDER, "1_manifest.json")

def generate_manifest():
    # Make sure folder exists
    if not os.path.isdir(FLAGS_FOLDER):
        print(f"❌ Folder not found: {FLAGS_FOLDER}")
        return

    # List all .png files (case-insensitive)
    flag_files = [
        f for f in os.listdir(FLAGS_FOLDER)
        if f.lower().endswith(".png")
    ]

    # Sort alphabetically for consistency
    flag_files.sort()

    # Write to manifest.json
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(flag_files, f, indent=2)

    print(f"✅ Generated {OUTPUT_FILE} with {len(flag_files)} entries.")

if __name__ == "__main__":
    generate_manifest()
