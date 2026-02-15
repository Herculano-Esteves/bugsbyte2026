import os
import re
from openai import OpenAI
from fastapi import HTTPException
from pathlib import Path

# All valid commands the AI can use
VALID_COMMANDS = [
    "OPEN_SCANNER",
    "OPEN_GALLERY",
    "GO_HOME",
    "GO_INFLIGHT",
    "GO_SEARCH",
    "GO_PROFILE",
    "GO_TRANSPORTS",
    "GO_BOARDING_PASS",
    "GO_LOGIN",
    "GO_REGISTER",
    "NONE",
]

# Regex to extract the first [COMMAND] from the response
COMMAND_PATTERN = re.compile(r"^\[([A-Z_]+)\](.*)$", re.DOTALL)


def parse_ai_response(raw_text: str) -> dict:
    """
    Parse the AI's raw text response into a structured object.
    Expected format: [COMMAND]message text
    Returns: { "command": "COMMAND" or null, "message": "clean text" }
    """
    raw_text = raw_text.strip()

    match = COMMAND_PATTERN.match(raw_text)
    if match:
        command = match.group(1).strip()
        message = match.group(2).strip()

        # Validate command
        if command not in VALID_COMMANDS:
            command = "NONE"

        # If NONE, command is null in the response
        if command == "NONE":
            return {"command": None, "message": message}

        return {"command": command, "message": message}

    # No command found — treat entire text as message
    return {"command": None, "message": raw_text}


class AIService:
    _client = None
    _api_key = None

    @classmethod
    def _get_api_key(cls):
        """
        Try to read API key from various locations.
        """
        # 1. Check environment variable
        api_key = os.getenv("NVIDIA_API_KEY")
        if api_key:
            return api_key

        # 2. Check backend/apikey.txt
        backend_key_path = Path("apikey.txt")
        if backend_key_path.exists():
            return backend_key_path.read_text().strip()

        # 3. Check frontend/flight-companion/apikey.txt (relative)
        frontend_key_path = Path("../frontend/flight-companion/apikey.txt")
        if frontend_key_path.exists():
            return frontend_key_path.read_text().strip()

        return None

    @classmethod
    def _get_context(cls):
        """
        Read AI context/system prompt from aicontext.txt
        """
        frontend_context_path = Path("../frontend/flight-companion/aicontext.txt")
        if frontend_context_path.exists():
            content = frontend_context_path.read_text().strip()
            if content:
                return content

        return ""

    @classmethod
    def get_client(cls):
        if cls._client is None:
            cls._api_key = cls._get_api_key()
            if not cls._api_key:
                print("Warning: API Key not found in apikey.txt or environment.")
                return None

            cls._client = OpenAI(
                base_url="https://integrate.api.nvidia.com/v1",
                api_key=cls._api_key,
            )
        return cls._client

    @classmethod
    def get_response(cls, user_message: str) -> dict:
        """
        Send a message to the AI and return a parsed response with command + text.
        Returns: { "command": str|None, "message": str }
        """
        client = cls.get_client()
        if not client:
            raise HTTPException(
                status_code=500,
                detail="AI Service not configured (missing API Key)",
            )

        # Refresh context on each request
        system_context = cls._get_context()

        messages = []
        if system_context:
            messages.append({"role": "system", "content": system_context})

        messages.append({"role": "user", "content": user_message})

        try:
            completion = client.chat.completions.create(
                model="stepfun-ai/step-3.5-flash",
                messages=messages,
                temperature=0.2,
                top_p=0.9,
                max_tokens=4096,
                stream=False,
            )
            raw_text = completion.choices[0].message.content or ""
            return parse_ai_response(raw_text)
        except Exception as e:
            print(f"AI Error: {e}")
            raise HTTPException(status_code=500, detail=f"AI Error: {str(e)}")
