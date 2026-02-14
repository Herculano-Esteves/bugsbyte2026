import socket
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    APP_NAME: str = "BugsByteBackend"
    VERSION: str = "0.1.0"
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    DEBUG: bool = True

    @property
    def local_ip(self) -> str:
        """Dynamically determines the local LAN IP address."""
        try:
            # Connect to a public DNS server to determine the outgoing IP
            # (doesn't actually send data)
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            ip = s.getsockname()[0]
            s.close()
            return ip
        except Exception:
            return "127.0.0.1"

settings = Settings()
