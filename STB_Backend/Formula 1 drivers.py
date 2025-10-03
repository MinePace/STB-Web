
import sqlite3
import os
from contextlib import closing

DB_PATH = os.path.join(r"C:\Users\joeyz\Documents\GitHub\STB-Web\STB_Backend\Data\Data.db")

def table_exists(cur, name: str) -> bool:
    cur.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND lower(name)=lower(?)", (name,))
    return cur.fetchone() is not None

def col_exists(cur, table: str, col: str) -> bool:
    cur.execute(f"PRAGMA table_info({table});")
    return any(r[1].lower() == col.lower() for r in cur.fetchall())

def detect_text_col(cur) -> str:
    if col_exists(cur, "RaceResults", "Teams"):
        return "Teams"
    if col_exists(cur, "RaceResults", "Team"):
        return "Team"
    raise RuntimeError("Could not find RaceResults.Teams or RaceResults.Team")

def main():
    if not os.path.exists(DB_PATH):
        print(f"[ERROR] DB not found: {DB_PATH}")
        return 1

    with closing(sqlite3.connect(DB_PATH)) as conn:
        conn.execute("PRAGMA foreign_keys = ON;")
        cur = conn.cursor()

        if not (table_exists(cur, "Teams") and table_exists(cur, "RaceResults")):
            print("[ERROR] Missing Teams or RaceResults table")
            return 2

        text_col = detect_text_col(cur)
        print(f"[INFO] Using RaceResults.{text_col} as text column")

        if not col_exists(cur, "RaceResults", "TeamId"):
            cur.execute("ALTER TABLE RaceResults ADD COLUMN TeamId INTEGER")
            print("[INFO] Added RaceResults.TeamId")

        # ---- Diagnostics: show problematic rows (TeamId NULL) with their normalized keys ----
        print("\n[DIAG] Distinct team strings where TeamId IS NULL:")
        cur.execute(f"""
            SELECT {text_col} AS team_text,
                   COUNT(*) AS cnt,
                   LOWER(TRIM({text_col})) AS norm_key
            FROM RaceResults
            WHERE TeamId IS NULL
              AND {text_col} IS NOT NULL
              AND TRIM({text_col}) <> ''
            GROUP BY {text_col}
            ORDER BY cnt DESC, {text_col}
        """)
        rows = cur.fetchall()
        if not rows:
            print("  (none)")
        else:
            for team_text, cnt, norm in rows:
                print(f"  '{team_text}'  x{cnt}  -> key='{norm}'")

        # ---- Diagnostics: what normalized keys exist in Teams ----
        print("\n[DIAG] Normalized keys present in Teams:")
        cur.execute("""
            SELECT name, LOWER(TRIM(name)) AS norm_key
            FROM Teams
            ORDER BY name
        """)
        keys = cur.fetchall()
        for name, key in keys[:50]:  # cap output
            print(f"  Teams.name='{name}' -> key='{key}'")
        if len(keys) > 50:
            print(f"  ... ({len(keys)-50} more)")

        # ---- Fix: set RaceResults.TeamId by normalized match (case/whitespace-insensitive) ----
        print("\n[FIX] Assigning TeamId by normalized (LOWER/TRIM) match without changing text...")
        cur.execute(f"""
            UPDATE RaceResults AS rr
               SET TeamId = (
                   SELECT t.id
                     FROM Teams t
                    WHERE LOWER(TRIM(t.name)) = LOWER(TRIM(rr.{text_col}))
                    LIMIT 1
               )
             WHERE rr.TeamId IS NULL
               AND rr.{text_col} IS NOT NULL
               AND TRIM(rr.{text_col}) <> ''
        """)
        print(f"[FIX] Rows updated: {cur.rowcount or 0}")

        conn.commit()
        print("\n[DONE] If some rows are still NULL, check the [DIAG] sections above for typos not in Teams.")

if __name__ == "__main__":
    raise SystemExit(main())
