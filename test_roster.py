import asyncio
import httpx

async def main():
    async with httpx.AsyncClient() as client:
        # Check backend users API
        res = await client.get("http://localhost:8000/api/users")
        print("API:", res.json())

asyncio.run(main())
