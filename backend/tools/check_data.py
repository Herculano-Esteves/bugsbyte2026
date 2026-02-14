import sqlite3

# Path to your database
DB_PATH = "backend/transport.db"

def check_counts():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    print("📊 DATABASE SUMMARY:")
    print("-" * 30)
    
    # 1. Check Stops count by Agency
    # We can use the 'prefix' we added (cp_, flix_, cmet_, stcp_) to count
    agencies = [('CP', 'cp_%'), ('FlixBus', 'flix_%'), ('CarrisMet', 'cmet_%'), ('STCP', 'stcp_%')]
    
    for name, pattern in agencies:
        cursor.execute("SELECT COUNT(*) FROM stops WHERE stop_id LIKE ?", (pattern,))
        count = cursor.fetchone()[0]
        print(f"{name:10} | Stops: {count:,}")

    # 2. Check total schedules
    cursor.execute("SELECT COUNT(*) FROM stop_times")
    total_times = cursor.fetchone()[0]
    print("-" * 30)
    print(f"Total Arrival/Departure records: {total_times:,}")
    
    conn.close()

if __name__ == "__main__":
    check_counts()