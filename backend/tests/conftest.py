import asyncio
import sys
from pathlib import Path
from typing import AsyncGenerator, Generator
from unittest.mock import AsyncMock, MagicMock

import pytest
import pytest_asyncio
from fastapi.testclient import TestClient
from httpx import AsyncClient

backend_root = Path(__file__).resolve().parents[1]
if str(backend_root) not in sys.path:
    sys.path.insert(0, str(backend_root))

from main import app


@pytest.fixture(scope="session")
def event_loop() -> Generator[asyncio.AbstractEventLoop, None, None]:
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
def test_client() -> TestClient:
    """Create a test client for FastAPI app."""
    return TestClient(app)


@pytest_asyncio.fixture
async def async_client() -> AsyncGenerator[AsyncClient, None]:
    """Create an async test client for FastAPI app."""
    async with AsyncClient(app=app, base_url="http://test") as client:
        yield client


@pytest.fixture
def mock_supabase():
    """Mock Supabase client."""
    mock_client = MagicMock()
    mock_client.auth = MagicMock()
    mock_client.table = MagicMock()
    mock_client.from_ = MagicMock()
    return mock_client


@pytest.fixture
def mock_prosody_client():
    """Mock Prosody XMPP client."""
    mock_client = AsyncMock()
    mock_client.health_check.return_value = True
    mock_client.create_user.return_value = {"success": True}
    mock_client.get_user.return_value = {"username": "testuser", "active": True}
    mock_client.delete_user.return_value = {"success": True}
    mock_client.get_online_users.return_value = ["user1", "user2"]
    return mock_client


@pytest.fixture
def mock_user_sync():
    """Mock user synchronization service."""
    mock_sync = AsyncMock()
    mock_sync.health_check.return_value = {"prosody": True}
    mock_sync.create_user.return_value = {"success": True, "username": "testuser"}
    mock_sync.get_prosody_users.return_value = [
        {"username": "user1", "active": True},
        {"username": "user2", "active": True},
    ]
    mock_sync.delete_user.return_value = True
    return mock_sync


@pytest.fixture
def sample_user_data():
    """Sample user data for testing."""
    return {
        "username": "testuser",
        "email": "test@example.com",
        "password": "securepassword123",
    }


@pytest.fixture
def sample_message_data():
    """Sample message data for testing."""
    return {
        "id": "msg_123",
        "from": "user1@localhost",
        "to": "user2@localhost",
        "body": "Hello, this is a test message!",
        "timestamp": "2024-01-01T12:00:00Z",
        "type": "chat",
    }
