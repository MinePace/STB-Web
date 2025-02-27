import sqlite3

# Path to SQLite database
db_path = "C:/Users/joeyz/Documents/GitHub/STB-Web/STB_Backend/Data.db"

# Connect to the database
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Step 1: Fetch unique driver names from RaceResults
cursor.execute("SELECT DISTINCT Driver FROM RaceResults;")
drivers = cursor.fetchall()  # List of tuples

# Step 2: Insert driver names into Drivers if they don't already exist
for (driver_name,) in drivers:
    cursor.execute("SELECT COUNT(*) FROM Drivers WHERE Name = ?;", (driver_name,))
    exists = cursor.fetchone()[0]

    if exists == 0:  # If driver does not exist, insert it
        cursor.execute("INSERT INTO Drivers (Name) VALUES (?);", (driver_name,))

# Commit changes and close connection
conn.commit()
conn.close()

print("Driver names transferred successfully.")
