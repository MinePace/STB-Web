import sqlite3
import os
from contextlib import closing

DB_PATH = r"C:\Users\joeyz\Documents\GitHub\STB-Web\STB_Backend\Data\Data.db"

def main():
    if not os.path.exists(DB_PATH):
        print(f"[ERROR] Database not found: {DB_PATH}")
        return 1

    with closing(sqlite3.connect(DB_PATH)) as conn:
        conn.execute("PRAGMA foreign_keys = OFF;")
        cur = conn.cursor()

        # Check if column exists
        cur.execute("PRAGMA table_info(RaceResults);")
        cols = [r[1] for r in cur.fetchall()]
        if "TeamId" not in cols:
            print("[INFO] RaceResults.TeamId column does not exist — nothing to remove.")
            return 0

        print("[INFO] Removing column 'TeamId' from RaceResults...")

        # 1️⃣ Get the current schema (minus TeamId)
        cur.execute("PRAGMA table_info(RaceResults);")
        columns = [r[1] for r in cur.fetchall() if r[1].lower() != "teamid"]
        column_list = ", ".join(columns)

        # 2️⃣ Rename the old table
        cur.execute("ALTER TABLE RaceResults RENAME TO RaceResults_old;")

        # 3️⃣ Recreate the new RaceResults table (without TeamId)
        # Extract schema from old table definition
        cur.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='RaceResults_old';")
        create_sql = cur.fetchone()[0]

        # Remove the TeamId column definition from the CREATE TABLE statement
        import re
        create_sql_new = re.sub(r",?\s*\"?TeamId\"?\s+\w+(\s+NOT\s+NULL)?(\s+DEFAULT\s+\S+)?", "", create_sql)
        create_sql_new = create_sql_new.replace("RaceResults_old", "RaceResults")

        conn.executescript(create_sql_new)
        print("[INFO] New RaceResults table created.")

        # 4️⃣ Copy all data except TeamId
        conn.execute(f"INSERT INTO RaceResults ({column_list}) SELECT {column_list} FROM RaceResults_old;")
        print("[INFO] Data copied successfully.")

        # 5️⃣ Drop old table
        conn.execute("DROP TABLE RaceResults_old;")
        conn.execute("PRAGMA foreign_keys = ON;")
        conn.commit()

        print("[SUCCESS] Column 'TeamId' removed successfully!")

if __name__ == "__main__":
    raise SystemExit(main())
