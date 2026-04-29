import asyncio
import logging
import slixmpp

logging.basicConfig(level=logging.ERROR)

class EchoBot(slixmpp.ClientXMPP):
    def __init__(self, jid, password):
        super().__init__(jid, password)
        self.add_event_handler("session_start", self.start)
        self.add_event_handler("presence", self.on_presence)

    async def start(self, event):
        self.send_presence()
        self.get_roster()
        print("Connected and sent presence")
        await asyncio.sleep(2)
        self.disconnect()

    def on_presence(self, pres):
        print(f"Received presence from: {pres['from']}, type: {pres['type']}")

if __name__ == '__main__':
    xmpp = EchoBot('testuser@localhost', 'password')
    xmpp.register_plugin('xep_0030') # Service Discovery
    xmpp.register_plugin('xep_0199') # XMPP Ping
    xmpp.connect(('localhost', 5222))
    xmpp.process(forever=False)
