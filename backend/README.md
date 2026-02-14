# BugsByte2026 Backend

This is the backend for the BugsByte2026 hackathon project, built with FastAPI.

## Prerequisites

- Python 3.9+
- A virtual environment (recommended)

## Setup

1.  **Navigate to the project root:**
    ```bash
    cd bugsbyte2026
    ```

2.  **Create a virtual environment:**
    ```bash
    python3 -m venv .venv
    ```

3.  **Activate the virtual environment:**
    -   Linux/Mac: `source .venv/bin/activate`
    -   Windows: `.venv\Scripts\activate`

4.  **Install dependencies:**
    ```bash
    pip install -r backend/requirements.txt
    ```
    *Note: You might need to install `pydantic-settings` manually if it's not picked up immediately, though it is in the requirements.*

## Running the Server for LAN Access

To make the server accessible to the Expo app on your local network:

1.  **Navigate to the backend directory:**
    ```bash
    cd backend
    ```

2.  **Run the server:**
    ```bash
    # If using the venv directly without activation
    ../.venv/bin/python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
    
    # If venv is activated
    uvicorn main:app --host 0.0.0.0 --port 8000 --reload
    ```

3.  **Find your IP:**
    The server startup logs will print:
    `Server accessible at: http://<YOUR_LAN_IP>:8000`

    Use this IP in your Expo app configuration.

## API Documentation

Once running, visit:
-   **Swagger UI:** http://localhost:8000/docs
-   **ReDoc:** http://localhost:8000/redoc

## Project Structure

-   `app/api`: API route definitions.
-   `app/logic`: Business logic (bridges API and Data).
-   `app/parsers`: Modules for fetching data (Airports, Flights, etc.).
-   `app/data`: Mock database layer.
-   `app/models`: Pydantic schemas.

## Database Reset (SQLite)

The project uses a local SQLite database (`bugsbyte.db`). To reset it (delete all data and recreate tables):

1.  **Open an interactive Python shell from the `backend/` directory:**
    ```bash
    cd backend
    python3
    ```

2.  **Run the reset command:**
    ```python
    from app.database.connection import reset_database
    reset_database()
    exit()
    ```

    *Warning: This will permanently delete `bugsbyte.db` and all stored tickets.*

## Testing

The project uses `pytest` for testing.

1.  **Install test dependencies:**
    ```bash
    pip install pytest
    ```

2.  **Run tests (from the `backend/` directory):**
    ```bash
    cd backend
    python3 -m pytest
    ```

3.  **Run with verbose output:**
    ```bash
    python3 -m pytest -v
    ```

**What is tested:**
-   Database initialization and reset logic.
-   Ticket CRUD operations (Create, Read, Delete).
-   Timezone conversion logic (UTC handling).

