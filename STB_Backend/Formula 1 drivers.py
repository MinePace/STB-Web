import requests

API_URL = "http://localhost:5110/api/driver/updateDiscord"

# 📝 Your list of drivers & Discord IDs
drivers = [
    {"driverName": "ray", "discordId": "1158822965719351307"},
    # Add more here...
]

for entry in drivers:
    payload = {
        "driverName": entry["driverName"],
        "discordId": entry["discordId"]
    }

    try:
        response = requests.put(API_URL, json=payload)

        if response.status_code == 200:
            print(f"✅ Updated {entry['driverName']} → Discord {entry['discordId']}")
        else:
            print(f"❌ Failed for {entry['driverName']}: HTTP {response.status_code}")
            print(response.text)

    except Exception as e:
        print(f"🔥 Error updating {entry['driverName']}: {e}")
