"""
Verify the transport database — prints counts for locations table
and sample entries.
"""

import sqlite3
import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, "transport.db")


def check_data():
    if not os.path.exists(DB_PATH):
        print(f"❌ Database not found at {DB_PATH}")
        return

    size_mb = os.path.getsize(DB_PATH) / (1024 * 1024)
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    print(f"📊 DATABASE: {DB_PATH}")
    print(f"   Size: {size_mb:,.2f} MB")
    print("=" * 50)

    # ── Locations ───────────────────────────────────────────────────────
    print("\n📍 LOCATIONS")
    print("-" * 35)
    
    # Check if table exists
    c.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='locations'")
    if not c.fetchone():
        print("   ❌ locations table does not exist!")
        conn.close()
        return

    # Count by provider
    print(f"   {'Provider':12} {'Count':>8}")
    c.execute("SELECT provider, COUNT(*) FROM locations GROUP BY provider ORDER BY provider")
    total_locs = 0
    for provider, count in c.fetchall():
        print(f"   {provider:12} {count:>8,}")
        total_locs += count
    
    print(f"   {'TOTAL':12} {total_locs:>8,}")

    # ── Sample Data ─────────────────────────────────────────────────────
    print("\n🔍 SAMPLE LOCATIONS")
    print("-" * 35)
    c.execute("SELECT name, provider, lat, lon FROM locations LIMIT 5")
    for row in c.fetchall():
        print(f"   {row[1]:10} | {row[0][:30]:<30} | {row[2]:.4f}, {row[3]:.4f}")

    conn.close()
    print("\n" + "=" * 50)
    print("Done.")


if __name__ == "__main__":
    check_data()