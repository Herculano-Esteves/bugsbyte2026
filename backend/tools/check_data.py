"""
Verify the transport database — prints counts for all tables,
route type breakdown, and calendar coverage.
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
    print(f"   Size: {size_mb:,.0f} MB")
    print("=" * 50)

    # ── Stops by agency ─────────────────────────────────────────────────
    print("\n🚏 STOPS")
    print("-" * 35)
    agencies = [("CP", "cp_%"), ("FlixBus", "flix_%"),
                ("CarrisMet", "cmet_%"), ("STCP", "stcp_%")]
    total_stops = 0
    for name, pattern in agencies:
        c.execute("SELECT COUNT(*) FROM stops WHERE stop_id LIKE ?", (pattern,))
        count = c.fetchone()[0]
        total_stops += count
        print(f"   {name:12} {count:>8,}")
    print(f"   {'TOTAL':12} {total_stops:>8,}")

    # ── Stop times ──────────────────────────────────────────────────────
    print("\n🕐 STOP_TIMES")
    print("-" * 35)
    c.execute("SELECT COUNT(*) FROM stop_times")
    print(f"   Total rows:      {c.fetchone()[0]:>12,}")
    c.execute("SELECT COUNT(DISTINCT trip_id) FROM stop_times")
    print(f"   Distinct trips:  {c.fetchone()[0]:>12,}")

    # ── Trips ───────────────────────────────────────────────────────────
    print("\n🚌 TRIPS")
    print("-" * 35)
    c.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='trips'")
    if c.fetchone():
        for name, pattern in agencies:
            c.execute("SELECT COUNT(*) FROM trips WHERE trip_id LIKE ?",
                      (pattern,))
            count = c.fetchone()[0]
            print(f"   {name:12} {count:>8,}")
        c.execute("SELECT COUNT(*) FROM trips")
        print(f"   {'TOTAL':12} {c.fetchone()[0]:>8,}")

        # Sample headsigns (may not exist in old schema)
        try:
            c.execute("SELECT agency_id, trip_headsign FROM trips "
                      "WHERE trip_headsign != '' LIMIT 5")
            rows = c.fetchall()
            if rows:
                print("\n   Sample headsigns:")
                for agency, hs in rows:
                    print(f"     {agency}: {hs}")
        except sqlite3.OperationalError:
            print("   ℹ  trip_headsign column not present (old schema)")
    else:
        print("   ⚠ trips table does not exist!")

    # ── Routes ──────────────────────────────────────────────────────────
    print("\n🛤  ROUTES")
    print("-" * 35)
    c.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='routes'")
    if c.fetchone():
        # Route type mapping (GTFS standard)
        type_names = {0: "Tram", 1: "Metro", 2: "Rail", 3: "Bus",
                      4: "Ferry", 5: "Cable", 6: "Gondola", 7: "Funicular"}
        c.execute("""
            SELECT agency_id, route_type, COUNT(*)
            FROM routes GROUP BY agency_id, route_type
            ORDER BY agency_id
        """)
        for agency, rtype, count in c.fetchall():
            rtype_int = int(rtype) if rtype else -1
            label = type_names.get(rtype_int, f"Type {rtype}")
            print(f"   {agency:12} {label:10} {count:>6,}")
    else:
        print("   ⚠ routes table does not exist!")

    # ── Calendar ────────────────────────────────────────────────────────
    print("\n📅 CALENDAR")
    print("-" * 35)
    c.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='calendar'")
    if c.fetchone():
        c.execute("SELECT COUNT(*) FROM calendar")
        print(f"   Service entries: {c.fetchone()[0]:>8,}")
        c.execute("SELECT MIN(start_date), MAX(end_date) FROM calendar")
        row = c.fetchone()
        if row[0]:
            print(f"   Date range:      {row[0]} → {row[1]}")
    else:
        print("   ⚠ calendar table does not exist!")

    c.execute("SELECT name FROM sqlite_master WHERE type='table' "
              "AND name='calendar_dates'")
    if c.fetchone():
        c.execute("SELECT COUNT(*) FROM calendar_dates")
        print(f"   Exceptions:      {c.fetchone()[0]:>8,}")
    else:
        print("   ⚠ calendar_dates table does not exist!")

    # ── Integrity checks ────────────────────────────────────────────────
    print("\n🔍 INTEGRITY")
    print("-" * 35)

    # Orphan trip_ids in stop_times (not in trips)
    c.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='trips'")
    if c.fetchone():
        c.execute("""
            SELECT COUNT(DISTINCT st.trip_id)
            FROM stop_times st
            LEFT JOIN trips t ON st.trip_id = t.trip_id
            WHERE t.trip_id IS NULL
        """)
        orphans = c.fetchone()[0]
        status = "✅" if orphans == 0 else "⚠"
        print(f"   {status} Orphan trip_ids in stop_times: {orphans:,}")

    conn.close()
    print("\n" + "=" * 50)
    print("Done.")


if __name__ == "__main__":
    check_data()