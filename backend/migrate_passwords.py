"""
One-time migration script to hash existing plain-text passwords with bcrypt.

Usage:
    python migrate_passwords.py
"""

import sqlite3
import bcrypt
from app.database.connection import DB_PATH


def migrate():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    cursor.execute("SELECT id, password FROM users")
    users = cursor.fetchall()

    migrated = 0
    skipped = 0

    for user in users:
        password = user["password"]

        # Skip passwords that are already bcrypt hashes ($2b$, $2a$, $2y$)
        if password.startswith(("$2b$", "$2a$", "$2y$")):
            skipped += 1
            continue

        hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt())
        cursor.execute(
            "UPDATE users SET password = ? WHERE id = ?",
            (hashed.decode("utf-8"), user["id"]),
        )
        migrated += 1

    conn.commit()
    conn.close()

    print(f"Migration complete: {migrated} password(s) hashed, {skipped} already hashed.")


if __name__ == "__main__":
    migrate()
