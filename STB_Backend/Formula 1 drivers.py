import sqlite3
import os
#9LRDUDL5P2PS2498XUJ46LAF
# Adjust this to your actual .db file path
db_path = os.path.join(r"C:\Users\joeyz\Documents\GitHub\STB-Web\STB_Backend\Data\Data.db")

if not os.path.exists(db_path):
    print(f"[ERROR] Database file not found: {db_path}")
else:
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        cursor.execute('DELETE FROM "__EFMigrationsLock";')
        conn.commit()

        print("[DB] Cleared migration lock successfully.")
    except sqlite3.Error as e:
        print(f"[ERROR] SQLite error: {e}")
    finally:
        if conn:
            conn.close()
