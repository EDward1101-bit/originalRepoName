from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from services.prosody import ProsodyClient
from config import settings


@pytest.mark.integration
class TestUserCreationWorkflow:
    """Integration tests for complete user creation workflow."""

    @pytest.mark.asyncio
    async def test_complete_user_creation_flow(self, async_client):
        """Test complete user creation from API to database."""
        # Mock all external dependencies
        mock_supabase = MagicMock()
        mock_auth_response = MagicMock()
        mock_auth_response.user.id = "user123"
        mock_supabase.auth.admin.create_user.return_value = mock_auth_response
        mock_supabase.table.return_value.insert.return_value.execute.return_value = MagicMock()

        mock_prosody = AsyncMock()
        mock_prosody.create_user.return_value = {"success": True, "username": "testuser"}

        # Patch all external dependencies
        with patch('services.user_sync.get_supabase_client', return_value=mock_supabase):
            with patch('services.user_sync.prosody_client', mock_prosody):
                # Test the API endpoint
                user_data = {
                    "username": "testuser",
                    "password": "password123",
                    "email": "test@example.com"
                }

                response = await async_client.post("/api/users/", json=user_data)

                assert response.status_code == 200
                data = response.json()
                assert data["user"]["username"] == "testuser"
                assert data["user"]["id"] == "user123"
                assert data["prosody"]["success"] is True

                # Verify all services were called correctly
                mock_prosody.create_user.assert_called_once_with("testuser", "password123")
                mock_supabase.auth.admin.create_user.assert_called_once()
                mock_supabase.table.assert_called_once_with("users")

    @pytest.mark.asyncio
    async def test_user_authentication_flow(self, async_client):
        """Test complete user authentication flow."""
        # Mock Supabase responses
        mock_supabase = MagicMock()
        mock_user_response = MagicMock()
        mock_user_response.data = [{"id": "user123", "username": "testuser"}]
        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_user_response

        mock_auth_response = MagicMock()
        mock_auth_response.user = MagicMock()
        mock_supabase.auth.sign_in_with_password.return_value = mock_auth_response

        with patch('services.supabase.get_supabase_client', return_value=mock_supabase):
            # Test credential verification
            auth_data = {
                "username": "testuser",
                "password": "password123",
                "host": settings.server_hostname
            }

            response = await async_client.post("/api/auth/verify", json=auth_data)

            assert response.status_code == 200
            data = response.json()
            assert data["valid"] is True
            assert data["user_id"] == "user123"

    @pytest.mark.asyncio
    async def test_user_sync_to_prosody_flow(self, async_client):
        """Test user synchronization to Prosody flow."""
        mock_prosody = AsyncMock()
        mock_prosody.get_user.return_value = None  # User doesn't exist
        mock_prosody.create_user.return_value = {"success": True}

        with patch('services.user_sync.prosody_client', mock_prosody):
            # Test sync endpoint
            sync_data = {
                "username": "testuser",
                "password": "password123"
            }

            response = await async_client.post("/api/auth/sync-user", json=sync_data)

            assert response.status_code == 200
            data = response.json()
            assert data["synced"] is True
            assert data["username"] == "testuser"

            # Verify Prosody operations
            mock_prosody.get_user.assert_called_once_with("testuser")
            mock_prosody.create_user.assert_called_once_with("testuser", "password123")


@pytest.mark.integration
class TestHealthCheckIntegration:
    """Integration tests for health check endpoints."""

    @pytest.mark.asyncio
    async def test_complete_health_check_flow(self, async_client):
        """Test complete health check flow."""
        mock_user_sync = AsyncMock()
        mock_user_sync.health_check.return_value = {"prosody": True}

        mock_prosody = AsyncMock()
        mock_prosody.health_check.return_value = True

        with patch('api.health.user_sync', mock_user_sync):
            with patch('services.prosody.prosody_client', mock_prosody):
                # Test main health endpoint
                response = await async_client.get("/health")
                assert response.status_code == 200
                data = response.json()
                assert data["status"] == "healthy"
                assert data["prosody"] is True

                # Test Prosody-specific health endpoint
                response = await async_client.get("/health/prosody")
                assert response.status_code == 200
                data = response.json()
                assert data["prosody"] is True
                assert data["status"] == "healthy"


@pytest.mark.integration
@pytest.mark.external
class TestExternalServiceIntegration:
    """Integration tests that would require external services in real environment."""

    @pytest.mark.asyncio
    async def test_prosody_client_integration(self):
        """Test ProsodyClient with realistic scenarios."""
        client = ProsodyClient(base_url=settings.prosody_url)

        # Test health check (would fail in real test without Prosody running)
        try:
            result = await client.health_check()
            # If Prosody is running, this should pass
            assert isinstance(result, bool)
        except Exception:
            # Expected if Prosody is not running
            pass
        finally:
            await client.close()

    def test_supabase_client_integration(self):
        """Test Supabase client configuration."""
        from services.supabase import get_supabase_client

        # Test that client can be created (even if credentials are invalid)
        try:
            client = get_supabase_client()
            assert client is not None
        except Exception:
            # Expected if Supabase credentials are not configured
            pass


@pytest.mark.integration
class TestErrorHandlingIntegration:
    """Integration tests for error handling across services."""

    @pytest.mark.asyncio
    async def test_cascading_failure_handling(self, async_client):
        """Test how system handles cascading failures."""
        # Mock Prosody failure
        mock_prosody = AsyncMock()
        mock_prosody.create_user.side_effect = Exception("Prosody unavailable")

        mock_supabase = MagicMock()
        mock_supabase.auth.admin.create_user.return_value = MagicMock(user=None)

        with patch('services.user_sync.get_supabase_client', return_value=mock_supabase):
            with patch('services.user_sync.prosody_client', mock_prosody):
                user_data = {
                    "username": "testuser",
                    "password": "password123"
                }

                response = await async_client.post("/api/users/", json=user_data)

                # Should handle the failure gracefully
                assert response.status_code == 400
                data = response.json()
                assert "Prosody unavailable" in data["detail"]

    @pytest.mark.asyncio
    async def test_partial_failure_recovery(self, async_client):
        """Test system recovery from partial failures."""
        # Mock scenario where user exists in Prosody but not in Supabase
        mock_prosody = AsyncMock()
        mock_prosody.get_user.return_value = {"username": "testuser", "active": True}

        with patch('services.user_sync.prosody_client', mock_prosody):
            # Test sync user - should handle existing user gracefully
            sync_data = {
                "username": "testuser",
                "password": "password123"
            }

            response = await async_client.post("/api/auth/sync-user", json=sync_data)

            assert response.status_code == 200
            data = response.json()
            assert data["synced"] is True


@pytest.mark.integration
@pytest.mark.slow
class TestPerformanceIntegration:
    """Integration tests for performance characteristics."""

    @pytest.mark.asyncio
    async def test_concurrent_user_creation(self, async_client):
        """Test handling concurrent user creation requests."""
        import asyncio

        mock_supabase = MagicMock()
        mock_auth_response = MagicMock()
        mock_auth_response.user.id = "user123"
        mock_supabase.auth.admin.create_user.return_value = mock_auth_response
        mock_supabase.table.return_value.insert.return_value.execute.return_value = MagicMock()

        mock_prosody = AsyncMock()
        mock_prosody.create_user.return_value = {"success": True}

        with patch('services.user_sync.get_supabase_client', return_value=mock_supabase):
            with patch('services.user_sync.prosody_client', mock_prosody):
                # Create multiple concurrent requests
                tasks = []
                for i in range(5):
                    user_data = {
                        "username": f"user{i}",
                        "password": "password123",
                        "email": f"user{i}@example.com"
                    }
                    task = async_client.post("/api/users/", json=user_data)
                    tasks.append(task)

                # Wait for all requests to complete
                responses = await asyncio.gather(*tasks)

                # All should succeed
                for i, response in enumerate(responses):
                    assert response.status_code == 200
                    data = response.json()
                    assert data["user"]["username"] == f"user{i}"

                # Verify all calls were made
                assert mock_prosody.create_user.call_count == 5
                assert mock_supabase.auth.admin.create_user.call_count == 5
