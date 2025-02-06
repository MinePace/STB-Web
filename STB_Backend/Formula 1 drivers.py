import sqlite3

# Pad naar beide databasebestanden
db1_path = "C:/Users/joeyz/Documents/GitHub/STB-Web/STB_Backend/Data.db"    # Doel-database
db2_path = "C:/Users/joeyz/Documents/GitHub/STB-Web/STB_Backend/Data2.db"   # Bron-database

def copy_data_with_id(table_name):
    """Kopieert data van een specifieke tabel van Data2.db naar Data.db en behoudt de Id-waarden."""
    try:
        # Verbind met beide databases
        conn1 = sqlite3.connect(db1_path)  # Doel
        conn2 = sqlite3.connect(db2_path)  # Bron
        cursor1 = conn1.cursor()
        cursor2 = conn2.cursor()

        # Haal kolomnamen op inclusief Id
        cursor2.execute(f"PRAGMA table_info({table_name});")
        columns = [col[1] for col in cursor2.fetchall()]  # Neem Id mee

        # Data ophalen uit de bron-database
        cursor2.execute(f"SELECT {', '.join(columns)} FROM {table_name};")
        rows = cursor2.fetchall()

        # Voeg data toe aan de doel-database (inclusief Id)
        if rows:
            placeholders = ", ".join(["?"] * len(columns))
            insert_query = f"INSERT INTO {table_name} ({', '.join(columns)}) VALUES ({placeholders});"
            cursor1.executemany(insert_query, rows)
            conn1.commit()
            print(f"{len(rows)} records toegevoegd aan {table_name} met Id-behoud.")

        # Reset de ID-reeks zodat nieuwe records verder tellen vanaf de hoogste Id
        cursor1.execute(f"SELECT MAX(Id) FROM {table_name};")
        max_id = cursor1.fetchone()[0]
        if max_id:
            cursor1.execute(f"UPDATE sqlite_sequence SET seq = {max_id} WHERE name = '{table_name}';")
            conn1.commit()
            print(f"ID-sequence van {table_name} geüpdatet tot {max_id}.")

        # Sluit de verbindingen
        conn1.close()
        conn2.close()

    except sqlite3.Error as e:
        print(f"Fout bij kopiëren van {table_name}: {e}")

# Tabellen die we willen kopiëren
tables = ["Users", "Tracks", "Races", "RaceResults"]

# Data overzetten
for table in tables:
    copy_data_with_id(table)

print("Data-overdracht met behoud van Id's voltooid!")
