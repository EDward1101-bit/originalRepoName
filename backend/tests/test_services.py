import pytest
from unittest.mock import AsyncMock, MagicMock, patch
import httpx

from services.prosody import ProsodyClient
from services.user_sync import UserSync, UserCreate
from services.supabase import get_supabase_client, get_service_client, settings as supabase_settings
from services.get_online_users import OnlineUserClient, get_online_users_xmpp


class TestProsodyClient:
    """Test cases for ProsodyClient."""

    @pytest.fixture
    def client(self):
        """Create a ProsodyClient instance for testing."""
        return ProsodyClient(base_url="http://test-prosody:5280")

    @pytest.mark.asyncio
    async def test_health_check_success(self, client):
        """Test successful health check."""
        with patch.object(client.client, 'get') as mock_get:
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_get.return_value = mock_response

            result = await client.health_check()
            assert result is True
            mock_get.assert_called_once_with("http://test-prosody:5280/health")

    @pytest.mark.asyncio
    async def test_health_check_failure(self, client):
        """Test health check when service is down."""
        with patch.object(client.client, 'get') as mock_get:
            mock_get.side_effect = httpx.RequestError("Connection failed")

            result = await client.health_check()
            assert result is False

    @pytest.mark.asyncio
    async def test_get_users_success(self, client):
        """Test successful users retrieval."""
        mock_users = [{"username": "user1"}, {"username": "user2"}]
        
        with patch.object(client.client, 'get') as mock_get:
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = {"users": mock_users}
            mock_get.return_value = mock_response

            result = await client.get_users()
            assert result == mock_users
            mock_get.assert_called_once_with("http://test-prosody:5280/users")

    @pytest.mark.asyncio
    async def test_get_users_http_error(self, client):
        """Test get_users with HTTP error."""
        with patch.object(client.client, 'get') as mock_get:
            mock_get.side_effect = httpx.HTTPStatusError(
                "Server error", request=MagicMock(), response=MagicMock(status_code=500)
            )

            with pytest.raises(httpx.HTTPStatusError):
                await client.get_users()

    @pytest.mark.asyncio
    async def test_get_user_success(self, client):
        """Test successful user retrieval."""
        mock_user = {"username": "testuser", "active": True}
        
        with patch.object(client.client, 'get') as mock_get:
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = mock_user
            mock_get.return_value = mock_response

            result = await client.get_user("testuser")
            assert result == mock_user
            mock_get.assert_called_once_with("http://test-prosody:5280/users/testuser")

    @pytest.mark.asyncio
    async def test_get_user_not_found(self, client):
        """Test get_user when user doesn't exist."""
        with patch.object(client.client, 'get') as mock_get:
            mock_response = MagicMock()
            mock_response.status_code = 404
            mock_get.return_value = mock_response

            result = await client.get_user("nonexistent")
            assert result is None

    @pytest.mark.asyncio
    async def test_get_user_http_error(self, client):
        """Test get_user with HTTP error."""
        with patch.object(client.client, 'get') as mock_get:
            mock_get.side_effect = httpx.HTTPError("Connection error")

            result = await client.get_user("testuser")
            assert result is None

    @pytest.mark.asyncio
    async def test_create_user_success(self, client):
        """Test successful user creation."""
        mock_response_data = {"success": True, "username": "testuser"}
        
        with patch.object(client.client, 'post') as mock_post:
            mock_response = MagicMock()
            mock_response.status_code = 201
            mock_response.json.return_value = mock_response_data
            mock_post.return_value = mock_response

            result = await client.create_user("testuser", "password123")
            assert result == mock_response_data
            mock_post.assert_called_once_with(
                "http://test-prosody:5280/users/testuser",
                json={"password": "password123"},
            )

    @pytest.mark.asyncio
    async def test_create_user_http_error(self, client):
        """Test create_user with HTTP error."""
        with patch.object(client.client, 'post') as mock_post:
            mock_post.side_effect = httpx.HTTPStatusError(
                "User exists", request=MagicMock(), response=MagicMock(status_code=409)
            )

            with pytest.raises(httpx.HTTPStatusError):
                await client.create_user("existinguser", "password")

    @pytest.mark.asyncio
    async def test_delete_user_success(self, client):
        """Test successful user deletion."""
        with patch.object(client.client, 'delete') as mock_delete:
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_delete.return_value = mock_response

            result = await client.delete_user("testuser")
            assert result is True
            mock_delete.assert_called_once_with("http://test-prosody:5280/users/testuser")

    @pytest.mark.asyncio
    async def test_delete_user_failure(self, client):
        """Test delete_user when user doesn't exist."""
        with patch.object(client.client, 'delete') as mock_delete:
            mock_response = MagicMock()
            mock_response.status_code = 404
            mock_delete.return_value = mock_response

            result = await client.delete_user("nonexistent")
            assert result is False

    @pytest.mark.asyncio
    async def test_check_auth_success(self, client):
        """Test successful authentication check."""
        with patch.object(client.client, 'post') as mock_post:
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = {"exists": True}
            mock_post.return_value = mock_response

            result = await client.check_auth("testuser")
            assert result is True
            mock_post.assert_called_once_with(
                "http://test-prosody:5280/auth",
                json={"username": "testuser", "host": "localhost"},
            )

    @pytest.mark.asyncio
    async def test_check_auth_not_exists(self, client):
        """Test authentication check when user doesn't exist."""
        with patch.object(client.client, 'post') as mock_post:
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = {"exists": False}
            mock_post.return_value = mock_response

            result = await client.check_auth("nonexistent")
            assert result is False

    @pytest.mark.asyncio
    async def test_check_auth_http_error(self, client):
        """Test check_auth with HTTP error."""
        with patch.object(client.client, 'post') as mock_post:
            mock_post.side_effect = httpx.HTTPError("Connection error")

            result = await client.check_auth("testuser")
            assert result is False

    @pytest.mark.asyncio
    async def test_close(self, client):
        """Test client cleanup."""
        with patch.object(client.client, 'aclose') as mock_aclose:
            await client.close()
            mock_aclose.assert_called_once()


class TestUserSync:
    """Test cases for UserSync."""

    @pytest.fixture
    def sample_user_create(self):
        """Sample UserCreate instance for testing."""
        return UserCreate(
            username="testuser",
            password="password123",
            email="test@example.com",
        )

    @pytest.mark.asyncio
    async def test_create_user_success(self, sample_user_create):
        """Test successful user creation."""
        mock_supabase = MagicMock()
        mock_auth_response = MagicMock()
        mock_auth_response.user.id = "user123"
        mock_supabase.auth.admin.create_user.return_value = mock_auth_response
        mock_supabase.table.return_value.insert.return_value.execute.return_value = MagicMock()

        with patch('services.user_sync.get_supabase_client', return_value=mock_supabase):
            mock_prosody = AsyncMock()
            mock_prosody.create_user.return_value = {"success": True}
            with patch('services.user_sync.prosody_client', mock_prosody):

                result = await UserSync.create_user(sample_user_create)

                assert result["user"]["username"] == "testuser"
                assert result["user"]["id"] == "user123"
                assert result["prosody"]["success"] is True
                assert result["auth"]["id"] == "user123"

    @pytest.mark.asyncio
    async def test_create_user_without_email(self):
        """Test user creation without email (generates default)."""
        user_create = UserCreate(
            username="testuser",
            password="password123"
        )

        mock_supabase = MagicMock()
        mock_auth_response = MagicMock()
        mock_auth_response.user.id = "user123"
        mock_supabase.auth.admin.create_user.return_value = mock_auth_response
        mock_supabase.table.return_value.insert.return_value.execute.return_value = MagicMock()

        with patch('services.user_sync.get_supabase_client', return_value=mock_supabase):
            mock_prosody = AsyncMock()
            mock_prosody.create_user.return_value = {"success": True}
            with patch('services.user_sync.prosody_client', mock_prosody):

                result = await UserSync.create_user(user_create)

                # Check that default email was used
                mock_supabase.auth.admin.create_user.assert_called_once()
                call_args = mock_supabase.auth.admin.create_user.call_args[0][0]
                assert call_args["email"] == "testuser@localhost"

    @pytest.mark.asyncio
    async def test_create_user_supabase_failure(self, sample_user_create):
        """Test user creation when Supabase auth fails."""
        mock_supabase = MagicMock()
        mock_supabase.auth.admin.create_user.return_value = MagicMock(user=None)

        with patch('services.user_sync.get_supabase_client', return_value=mock_supabase):
            mock_prosody = AsyncMock()
            mock_prosody.create_user.return_value = {"success": True}
            with patch('services.user_sync.prosody_client', mock_prosody):

                with pytest.raises(Exception, match="Failed to create user in Supabase Auth"):
                    await UserSync.create_user(sample_user_create)

    @pytest.mark.asyncio
    async def test_delete_user_success(self):
        """Test successful user deletion."""
        mock_supabase = MagicMock()
        mock_supabase.table.return_value.delete.return_value.eq.return_value.execute.return_value = MagicMock()

        with patch('services.user_sync.get_supabase_client', return_value=mock_supabase):
            mock_prosody = AsyncMock()
            mock_prosody.delete_user.return_value = True
            with patch('services.user_sync.prosody_client', mock_prosody):

                result = await UserSync.delete_user("testuser")

                assert result is True
                mock_prosody.delete_user.assert_called_once_with("testuser")
                mock_supabase.table.assert_called_once_with("users")

    @pytest.mark.asyncio
    async def test_sync_user_to_prosody_existing_user(self):
        """Test syncing user that already exists in Prosody."""
        mock_prosody = AsyncMock()
        mock_prosody.get_user.return_value = {"username": "testuser"}
        with patch('services.user_sync.prosody_client', mock_prosody):

            result = await UserSync.sync_user_to_prosody("testuser", "password")

            assert result is True
            mock_prosody.get_user.assert_called_once_with("testuser")
            mock_prosody.create_user.assert_not_called()

    @pytest.mark.asyncio
    async def test_sync_user_to_prosody_new_user(self):
        """Test syncing new user to Prosody."""
        mock_prosody = AsyncMock()
        mock_prosody.get_user.return_value = None
        mock_prosody.create_user.return_value = {"success": True}
        with patch('services.user_sync.prosody_client', mock_prosody):

            result = await UserSync.sync_user_to_prosody("testuser", "password")

            assert result is True
            mock_prosody.get_user.assert_called_once_with("testuser")
            mock_prosody.create_user.assert_called_once_with("testuser", "password")

    @pytest.mark.asyncio
    async def test_get_prosody_users(self):
        """Test getting Prosody users."""
        mock_users = [{"username": "user1"}, {"username": "user2"}]

        mock_prosody = AsyncMock()
        mock_prosody.get_users.return_value = mock_users
        with patch('services.user_sync.prosody_client', mock_prosody):

            result = await UserSync.get_prosody_users()

            assert result == mock_users
            mock_prosody.get_users.assert_called_once()

    @pytest.mark.asyncio
    async def test_health_check(self):
        """Test health check functionality."""
        mock_prosody = AsyncMock()
        mock_prosody.health_check.return_value = True
        with patch('services.user_sync.prosody_client', mock_prosody):

            result = await UserSync.health_check()

            assert result == {"prosody": True}
            mock_prosody.health_check.assert_called_once()


class TestUserCreate:
    """Test cases for UserCreate model."""

    def test_valid_user_create(self):
        """Test creating a valid UserCreate instance."""
        user = UserCreate(
            username="testuser",
            password="password123",
            email="test@example.com",
        )
        assert user.username == "testuser"
        assert user.password == "password123"
        assert user.email == "test@example.com"

    def test_user_create_minimal(self):
        """Test creating UserCreate with only required fields."""
        user = UserCreate(username="testuser", password="password123")
        assert user.username == "testuser"
        assert user.password == "password123"
        assert user.email is None


class TestSupabaseService:
    """Test cases for Supabase service."""

    def test_supabase_settings_defaults(self):
        """Test SupabaseSettings default values."""
        # Temporarily clear all environment variables
        with patch.dict('os.environ', {'PYTEST_TESTING': 'true'}, clear=True):
            # Import and create settings in clean environment
            from services.supabase import SupabaseSettings
            settings = SupabaseSettings()
            assert settings.supabase_url == ""
            assert settings.supabase_anon_key == ""
            assert settings.supabase_service_key is None

    @patch('services.supabase.create_client')
    def test_get_supabase_client(self, mock_create_client):
        """Test getting Supabase client."""
        mock_client = MagicMock()
        mock_create_client.return_value = mock_client
        
        # Clear cache and test client creation
        get_supabase_client.cache_clear()
        client = get_supabase_client()
        
        mock_create_client.assert_called_once()
        assert client == mock_client

    @patch('services.supabase.create_client')
    def test_get_supabase_client_cached(self, mock_create_client):
        """Test that Supabase client is cached."""
        mock_client = MagicMock()
        mock_create_client.return_value = mock_client
        
        # Clear cache and test client creation
        get_supabase_client.cache_clear()
        client1 = get_supabase_client()
        client2 = get_supabase_client()
        
        # Should only create client once due to caching
        mock_create_client.assert_called_once()
        assert client1 == client2

    @patch('services.supabase.create_client')
    def test_get_service_client_with_key(self, mock_create_client):
        """Test service client creation when service key is set."""
        mock_client = MagicMock()
        mock_create_client.return_value = mock_client

        get_service_client.cache_clear()
        with patch.object(supabase_settings, "supabase_service_key", "service-key"):
            with patch.object(supabase_settings, "supabase_url", "https://example.com"):
                client = get_service_client()

        mock_create_client.assert_called_once_with("https://example.com", "service-key")
        assert client == mock_client

    @patch('services.supabase.create_client')
    def test_get_service_client_without_key(self, mock_create_client):
        """Test service client creation when service key is missing."""
        get_service_client.cache_clear()
        with patch.object(supabase_settings, "supabase_service_key", None):
            client = get_service_client()

        mock_create_client.assert_not_called()
        assert client is None


class TestOnlineUsersService:
    """Test cases for online users utilities."""

    @pytest.mark.asyncio
    async def test_get_online_users_xmpp_returns_empty_list(self):
        """Test that default XMPP online users returns empty list."""
        result = await get_online_users_xmpp()
        assert result == []

    def test_online_user_client_initialization(self):
        """Test OnlineUserClient initializes with expected state."""
        def init_stub(self, jid, password):
            self.boundjid = MagicMock()
            self.boundjid.server = None
            self._run_out_filters = MagicMock()
            self._run_out_filters.cancel = MagicMock()
            return None

        with patch('services.get_online_users.ClientXMPP.__init__', autospec=True, side_effect=init_stub) as mock_init:
            with patch('services.get_online_users.ClientXMPP.add_event_handler') as mock_handler:
                client = OnlineUserClient("user@localhost", "password", "localhost")

        mock_init.assert_called_once_with(client, "user@localhost", "password")
        mock_handler.assert_called_once_with("session_start", client.session_start)
        assert client.server == "localhost"
        assert client.online_users == []
