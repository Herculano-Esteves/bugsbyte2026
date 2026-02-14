import pytest
import os
import sqlite3
from app.database import connection
from app.database.connection import create_tables

TEST_DB_NAME = "test_bugsbyte.db"
TEST_DB_PATH = os.path.join(os.path.dirname(__file__), TEST_DB_NAME)

@pytest.fixture(scope="function")
def db_conn():
    """
    Fixture that creates a temporary test database,
    yields a connection to it, and cleans up afterwards.
    This ensures strict isolation between tests.
    """
    # 1. Setup: Override the DB_PATH in the connection module
    original_db_path = connection.DB_PATH
    connection.DB_PATH = TEST_DB_PATH
    
    # 2. Init DB: Remove old test db if exists (just in case)
    if os.path.exists(TEST_DB_PATH):
        os.remove(TEST_DB_PATH)
        
    conn = sqlite3.connect(TEST_DB_PATH)
    conn.row_factory = sqlite3.Row
    create_tables(conn) # Initialize schema
    
    yield conn
    
    # 3. Teardown: Close connection and remove file
    conn.close()
    if os.path.exists(TEST_DB_PATH):
        try:
            os.remove(TEST_DB_PATH)
        except PermissionError:
            pass # Windows file lock potential issue, unlikely in Linux but good practice

    # Restore original path
    connection.DB_PATH = original_db_path
