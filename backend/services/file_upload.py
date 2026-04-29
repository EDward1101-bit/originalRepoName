import asyncio
from slixmpp import ClientXMPP
import aiohttp

class FileUploadService(ClientXMPP):
    def __init__(self, jid, password, upload_service, file_path):
        super().__init__(jid, password)
        self.upload_service = "upload.localhost"  # e.g., "upload.localhost"
        self.file_path = file_path
        
        # Register the HTTP Upload plugin
        self.register_plugin('xep_0363') 
        
        self.add_event_handler("session_start", self.start_upload)

    async def start_upload(self, event):
        self.send_presence()
        await self.get_roster()

        try:
            # 1. Request the "Slot" from Prosody
            # This triggers the IQ stanza exchange
            filename = "test_file.txt"
            size = 1024 # Example size in bytes
            
            print(f"Requesting slot from {self.upload_service}...")
            slot = await self.plugin['xep_0363'].get_upload_slot(
                self.upload_service, 
                filename, 
                size
            )

            # 2. Extract the URLs
            put_url = slot['put']
            get_url = slot['get']
            print(f"Upload URL: {put_url}")

            # 3. Perform the HTTP PUT
            async with aiohttp.ClientSession() as session:
                with open(self.file_path, 'rb') as f:
                    async with session.put(put_url, data=f) as resp:
                        if resp.status in (200, 201):
                            print(f"Success! File available at: {get_url}")
                        else:
                            print(f"Upload failed: {resp.status}")

        except Exception as e:
            print(f"Error: {e}")
        finally:
            self.disconnect()

async def main():
    # Use 'prosody' as the host if running inside the Docker network
    xmpp = FileUploadService(
        "admin@localhost", 
        "your_password", 
        "upload.localhost", 
        "local_file_to_send.txt"
    )
    
    # Force connection to the 'prosody' container name
    xmpp.connect(address=('localhost', 5222)) 
    await xmpp.process(forever=False)

if __name__ == "__main__":
    asyncio.run(main())
