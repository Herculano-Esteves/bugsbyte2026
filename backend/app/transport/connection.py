"""
Transport database connection — isolated from the main bugsbyte.db pool.

Provides a lightweight connection factory with read-only pragmas tuned
for the 2.7 GB transport.db (WAL mode, limited cache).
"""

import os
import sqlite3
from contextlib import contextmanager
from typing import Generator

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TRANSPORT_DB_PATH = os.path.join(BASE_DIR, "transport.db")


def _make_connection() -> sqlite3.Connection:
    """Create a new read-optimised SQLite connection."""
    conn = sqlite3.connect(TRANSPORT_DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode = WAL;")
    conn.execute("PRAGMA synchronous = NORMAL;")
    # Cap memory: ~32 MB page cache (negative = KB)
    conn.execute("PRAGMA cache_size = -32768;")
    conn.execute("PRAGMA query_only = ON;")
    return conn


# Module-level singleton — one long-lived connection for reads.
# SQLite WAL mode supports concurrent readers safely.
_conn: sqlite3.Connection | None = None


def get_transport_db() -> sqlite3.Connection:
    """Return the shared transport DB connection (lazy-init)."""
    global _conn
    if _conn is None:
        if not os.path.exists(TRANSPORT_DB_PATH):
            raise FileNotFoundError(
                f"Transport database not found at {TRANSPORT_DB_PATH}. "
                "Run tools/transportdata.py first."
            )
        _conn = _make_connection()
    return _conn


@contextmanager
def transport_cursor() -> Generator[sqlite3.Cursor, None, None]:
    """Context manager yielding a cursor on the transport DB."""
    conn = get_transport_db()
    cursor = conn.cursor()
    try:
        yield cursor
    finally:
        cursor.close()


def close_transport_db() -> None:
    """Explicitly close the shared connection (shutdown hook)."""
    global _conn
    if _conn is not None:
        _conn.close()
        _conn = None
