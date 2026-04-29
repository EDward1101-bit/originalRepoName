import asyncio
import httpx

async def main():
    async with httpx.AsyncClient() as client:
        # Check backend users API if it is running
        try:
            res = await client.get("http://localhost:8000/api/users")
            print("API:", res.json())
        except Exception as e:
            print("API error:", e)

asyncio.run(main())
