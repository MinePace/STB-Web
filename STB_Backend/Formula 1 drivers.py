import sqlite3

# Databasebestand
db_path = "C:/Users/joeyz/Desktop/STB Project/STB_Backend/Data.db"  # Pas dit aan naar het pad van je databasebestand

def update_rounds():
    try:
        # Verbinden met de database
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # Update query uitvoeren
        update_query = """
        UPDATE RaceResults
        SET Round = 4
        WHERE Id BETWEEN 608 AND 619
          AND Round = 5;
        """
        cursor.execute(update_query)

        # Wijzigingen bevestigen
        conn.commit()

        # Controleer de wijzigingen
        select_query = "SELECT * FROM RaceResults WHERE Id BETWEEN 608 AND 619;"
        cursor.execute(select_query)
        rows = cursor.fetchall()

        # Toon de gewijzigde records
        print("Updated records:")
        for row in rows:
            print(row)

    except sqlite3.Error as e:
        print(f"An error occurred: {e}")
    finally:
        if conn:
            conn.close()

# Script uitvoeren
if __name__ == "__main__":
    update_rounds()
