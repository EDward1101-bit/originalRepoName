from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from api.auth import AuthVerifyRequest, AuthVerifyResponse, SyncUserRequest
from config import settings


class TestHealthEndpoints:
    """Test cases for health check endpoints."""

    @patch('api.health.user_sync')
    def test_health_check_healthy(self, mock_user_sync, test_client):
        """Test health check when services are healthy."""
        mock_user_sync.health_check = AsyncMock(return_value={"prosody": True})

        response = test_client.get("/health")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["prosody"] is True

    @patch('api.health.user_sync')
    def test_health_check_degraded(self, mock_user_sync, test_client):
        """Test health check when Prosody is down."""
        mock_user_sync.health_check = AsyncMock(return_value={"prosody": False})

        response = test_client.get("/health")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "degraded"
        assert data["prosody"] is False

    def test_root_endpoint(self, test_client):
        """Test root endpoint."""
        response = test_client.get("/")

        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "XMPP Chat API"
        assert data["status"] == "running"

    @patch('services.prosody.prosody_client')
    def test_prosody_health_healthy(self, mock_prosody_client, test_client):
        """Test Prosody-specific health check when healthy."""
        mock_prosody_client.health_check = AsyncMock(return_value=True)

        response = test_client.get("/health/prosody")

        assert response.status_code == 200
        data = response.json()
        assert data["prosody"] is True
        assert data["status"] == "healthy"

    @patch('services.prosody.prosody_client')
    def test_prosody_health_unhealthy(self, mock_prosody_client, test_client):
        """Test Prosody-specific health check when unhealthy."""
        mock_prosody_client.health_check = AsyncMock(return_value=False)

        response = test_client.get("/health/prosody")

        assert response.status_code == 200
        data = response.json()
        assert data["prosody"] is False
        assert data["status"] == "unhealthy"


class TestUserEndpoints:
    """Test cases for user management endpoints."""

    @patch('api.users.user_sync')
    def test_create_user_success(self, mock_user_sync, test_client, sample_user_data):
        """Test successful user creation."""
        mock_user_sync.create_user = AsyncMock(return_value={
            "success": True,
            "username": "testuser"
        })

        response = test_client.post("/api/users/", json=sample_user_data)

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["username"] == "testuser"

    @patch('api.users.user_sync')
    def test_create_user_failure(self, mock_user_sync, test_client, sample_user_data):
        """Test user creation failure."""
        mock_user_sync.create_user = AsyncMock(side_effect=Exception("User already exists"))

        response = test_client.post("/api/users/", json=sample_user_data)

        assert response.status_code == 400
        data = response.json()
        assert "User already exists" in data["detail"]

    @patch('api.users.user_sync')
    def test_list_users_success(self, mock_user_sync, test_client):
        """Test successful user listing."""
        mock_users = [
            {"username": "user1", "active": True},
            {"username": "user2", "active": True}
        ]
        mock_user_sync.get_prosody_users = AsyncMock(return_value=mock_users)

        response = test_client.get("/api/users/")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        assert data[0]["username"] == "user1"

    @patch('api.users.user_sync')
    def test_list_users_failure(self, mock_user_sync, test_client):
        """Test user listing failure."""
        mock_user_sync.get_prosody_users = AsyncMock(side_effect=Exception("Database error"))

        response = test_client.get("/api/users/")

        assert response.status_code == 500
        data = response.json()
        assert "Database error" in data["detail"]

    @patch('api.users.prosody_client')
    def test_get_user_success(self, mock_prosody_client, test_client):
        """Test successful user retrieval."""
        mock_user = {"username": "testuser", "active": True}
        mock_prosody_client.get_user = AsyncMock(return_value=mock_user)

        response = test_client.get("/api/users/testuser")

        assert response.status_code == 200
        data = response.json()
        assert data["username"] == "testuser"
        assert data["active"] is True

    @patch('api.users.prosody_client')
    def test_get_user_not_found(self, mock_prosody_client, test_client):
        """Test get user when user doesn't exist."""
        mock_prosody_client.get_user = AsyncMock(return_value=None)

        response = test_client.get("/api/users/nonexistent")

        assert response.status_code == 404
        data = response.json()
        assert data["detail"] == "User not found"

    @patch('api.users.user_sync')
    def test_delete_user_success(self, mock_user_sync, test_client):
        """Test successful user deletion."""
        mock_user_sync.delete_user = AsyncMock(return_value=True)

        response = test_client.delete("/api/users/testuser")

        assert response.status_code == 200
        data = response.json()
        assert data["deleted"] is True
        assert data["username"] == "testuser"

    @patch('api.users.user_sync')
    def test_delete_user_not_found(self, mock_user_sync, test_client):
        """Test delete user when user doesn't exist."""
        mock_user_sync.delete_user = AsyncMock(return_value=False)

        response = test_client.delete("/api/users/nonexistent")

        assert response.status_code == 404
        data = response.json()
        assert data["detail"] == "User not found"


class TestAuthEndpoints:
    """Test cases for authentication endpoints."""

    def test_verify_credentials_success(self, test_client):
        """Test successful credential verification."""
        mock_supabase = MagicMock()
        mock_user_response = MagicMock()
        mock_user_response.data = [{"id": "user123", "username": "testuser"}]
        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_user_response

        mock_auth_response = MagicMock()
        mock_auth_response.user = MagicMock()
        mock_supabase.auth.sign_in_with_password.return_value = mock_auth_response

        with patch('services.supabase.get_supabase_client', return_value=mock_supabase):
            request_data = {"username": "testuser", "password": "password123"}
            response = test_client.post("/api/auth/verify", json=request_data)

            assert response.status_code == 200
            data = response.json()
            assert data["valid"] is True
            assert data["user_id"] == "user123"

    def test_verify_credentials_user_not_found(self, test_client):
        """Test credential verification when user doesn't exist."""
        mock_supabase = MagicMock()
        mock_user_response = MagicMock()
        mock_user_response.data = []
        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_user_response

        with patch('services.supabase.get_supabase_client', return_value=mock_supabase):
            request_data = {"username": "nonexistent", "password": "password123"}
            response = test_client.post("/api/auth/verify", json=request_data)

            assert response.status_code == 200
            data = response.json()
            assert data["valid"] is False
            assert data["user_id"] is None

    def test_verify_credentials_invalid_password(self, test_client):
        """Test credential verification with invalid password."""
        mock_supabase = MagicMock()
        mock_user_response = MagicMock()
        mock_user_response.data = [{"id": "user123", "username": "testuser"}]
        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_user_response

        mock_auth_response = MagicMock()
        mock_auth_response.user = None  # Failed auth
        mock_supabase.auth.sign_in_with_password.return_value = mock_auth_response

        with patch('services.supabase.get_supabase_client', return_value=mock_supabase):
            request_data = {"username": "testuser", "password": "wrongpassword"}
            response = test_client.post("/api/auth/verify", json=request_data)

            assert response.status_code == 200
            data = response.json()
            assert data["valid"] is False
            assert data["user_id"] is None

    def test_verify_credentials_exception(self, test_client):
        """Test credential verification with exception."""
        mock_supabase = MagicMock()
        mock_supabase.table.side_effect = Exception("Database error")

        with patch('services.supabase.get_supabase_client', return_value=mock_supabase):
            request_data = {"username": "testuser", "password": "password123"}
            response = test_client.post("/api/auth/verify", json=request_data)

            assert response.status_code == 200
            data = response.json()
            assert data["valid"] is False
            assert data["user_id"] is None

    @pytest.mark.asyncio
    async def test_sync_user_success(self, async_client, mock_user_sync):
        """Test successful user sync to Prosody."""
        mock_user_sync.sync_user_to_prosody.return_value = True

        with patch('services.user_sync.user_sync', mock_user_sync):
            request_data = {"username": "testuser", "password": "password123"}
            response = await async_client.post("/api/auth/sync-user", json=request_data)

            assert response.status_code == 200
            data = response.json()
            assert data["synced"] is True
            assert data["username"] == "testuser"

    @pytest.mark.asyncio
    async def test_sync_user_failure(self, async_client, mock_user_sync):
        """Test user sync failure."""
        mock_user_sync.sync_user_to_prosody.side_effect = Exception("Sync failed")

        with patch('services.user_sync.user_sync', mock_user_sync):
            request_data = {"username": "testuser", "password": "password123"}
            response = await async_client.post("/api/auth/sync-user", json=request_data)

            assert response.status_code == 400
            data = response.json()
            assert "Sync failed" in data["detail"]

    def test_check_user_exists_success(self, test_client):
        """Test successful user existence check."""
        mock_supabase = MagicMock()
        mock_response = MagicMock()
        mock_response.data = [{"id": "user123", "username": "testuser", "email": "test@example.com"}]
        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_response

        with patch('services.supabase.get_supabase_client', return_value=mock_supabase):
            response = test_client.get("/api/auth/users/testuser")

            assert response.status_code == 200
            data = response.json()
            assert data["exists"] is True
            assert data["user"]["username"] == "testuser"

    def test_check_user_exists_not_found(self, test_client):
        """Test user existence check when user doesn't exist."""
        mock_supabase = MagicMock()
        mock_response = MagicMock()
        mock_response.data = []
        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_response

        with patch('services.supabase.get_supabase_client', return_value=mock_supabase):
            response = test_client.get("/api/auth/users/nonexistent")

            assert response.status_code == 200
            data = response.json()
            assert data["exists"] is False
            assert "user" not in data

    def test_check_user_exists_exception(self, test_client):
        """Test user existence check with exception."""
        mock_supabase = MagicMock()
        mock_supabase.table.side_effect = Exception("Database error")

        with patch('services.supabase.get_supabase_client', return_value=mock_supabase):
            response = test_client.get("/api/auth/users/testuser")

            assert response.status_code == 500
            data = response.json()
            assert "Database error" in data["detail"]


class TestAuthModels:
    """Test cases for authentication models."""

    def test_auth_verify_request_valid(self):
        """Test valid AuthVerifyRequest creation."""
        request = AuthVerifyRequest(
            username="testuser",
            password="password123",
            host=settings.server_hostname
        )
        assert request.username == "testuser"
        assert request.password == "password123"
        assert request.host == settings.server_hostname

    def test_auth_verify_request_default_host(self):
        """Test AuthVerifyRequest with default host."""
        request = AuthVerifyRequest(
            username="testuser",
            password="password123"
        )
        assert request.host == settings.server_hostname

    def test_auth_verify_response_valid(self):
        """Test valid AuthVerifyResponse creation."""
        response = AuthVerifyResponse(
            valid=True,
            user_id="user123"
        )
        assert response.valid is True
        assert response.user_id == "user123"

    def test_auth_verify_response_invalid(self):
        """Test AuthVerifyResponse for invalid auth."""
        response = AuthVerifyResponse(
            valid=False,
            user_id=None
        )
        assert response.valid is False
        assert response.user_id is None

    def test_sync_user_request_valid(self):
        """Test valid SyncUserRequest creation."""
        request = SyncUserRequest(
            username="testuser",
            password="password123"
        )
        assert request.username == "testuser"
        assert request.password == "password123"


@pytest.mark.asyncio
class TestAsyncAPIEndpoints:
    """Test cases for async API endpoints."""

    async def test_async_health_check(self, async_client, mock_user_sync):
        """Test async health check endpoint."""
        mock_user_sync.health_check.return_value = {"prosody": True}

        with patch('api.health.user_sync', mock_user_sync):
            response = await async_client.get("/health")

            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "healthy"

    async def test_async_create_user(self, async_client, mock_user_sync, sample_user_data):
        """Test async user creation."""
        mock_user_sync.create_user.return_value = {
            "success": True,
            "username": "testuser"
        }

        with patch('api.users.user_sync', mock_user_sync):
            response = await async_client.post("/api/users/", json=sample_user_data)

            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True
