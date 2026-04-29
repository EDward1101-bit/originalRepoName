import asyncio
import logging
from slixmpp import ClientXMPP

logging.basicConfig(level=logging.INFO)

class EchoBot(ClientXMPP):
    def __init__(self, jid, password):
        super().__init__(jid, password)
        self.add_event_handler("session_start", self.start)
        self.add_event_handler("presence", self.on_presence)
        self.add_event_handler("roster_update", self.on_roster)

    async def start(self, event):
        print("Connected! Sending presence...")
        self.send_presence()
        self.get_roster()
        await asyncio.sleep(5)
        self.disconnect()

    def on_presence(self, pres):
        print(f"PRESENCE: from={pres['from']}, type={pres['type']}")

    def on_roster(self, iq):
        print(f"ROSTER: {iq}")

if __name__ == '__main__':
    # Try connecting as one of the users
    xmpp = EchoBot('andreibadoi75@localhost', 'password') # We need a real password though.
    # Since we don't have the password, we can't easily connect.
