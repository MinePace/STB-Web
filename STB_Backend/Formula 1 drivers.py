import pandas as pd
from sqlalchemy import create_engine

# Define the database connection (for SQLite)
DATABASE_PATH = "C:/Users/joeyz/Documents/GitHub/STB-Web/STB_Backend/Data.db"
engine = create_engine(f"sqlite:///{DATABASE_PATH}")

# Load CSV file
CSV_FILE_PATH = "C:/Users/joeyz/Documents/GitHub/STB-Web/STB_Backend/STB Season 21 - Tier 1 - Results2.csv"  # Change this to your actual CSV file path

# Read CSV into Pandas DataFrame
df = pd.read_csv(CSV_FILE_PATH)

# Insert data into the database
df.to_sql("RaceResults", con=engine, if_exists="append", index=False)

print("Data inserted successfully!")
