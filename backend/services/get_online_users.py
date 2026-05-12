from typing import Any

from slixmpp import ClientXMPP
from config import settings


class OnlineUserClient(ClientXMPP):
    def __init__(self, jid: str, password: str, server: str) -> None:
        super().__init__(jid, password)
        self.online_users: list[str] = []
        self.server = server
        self.add_event_handler("session_start", self.session_start)

    async def session_start(self, event: Any) -> None:
        # Query the server for online users
        # This uses service discovery to find users
        self.disconnect()

    def handle_presence(self, presence: Any) -> None:
        # This would need to be implemented to track presences
        pass


async def get_online_users_xmpp(server: str = settings.server_hostname, port: int = 5222) -> list[Any]:
    # This is a simplified version
    # In a real implementation, you'd need to properly query the server
    return []
