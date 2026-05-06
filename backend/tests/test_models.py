import pytest
from pydantic import ValidationError

from models.user import HealthResponse, UserCreateRequest, UserResponse


class TestUserCreateRequest:
    """Test cases for UserCreateRequest model."""

    def test_valid_user_create_request(self, sample_user_data):
        """Test creating a valid UserCreateRequest."""
        user = UserCreateRequest(**sample_user_data)
        assert user.username == sample_user_data["username"]
        assert user.password == sample_user_data["password"]
        assert user.email == sample_user_data["email"]
        assert user.full_name == sample_user_data["display_name"]

    def test_user_create_request_minimal_data(self):
        """Test creating UserCreateRequest with only required fields."""
        user = UserCreateRequest(username="testuser", password="testpass")
        assert user.username == "testuser"
        assert user.password == "testpass"
        assert user.email is None
        assert user.full_name is None

    def test_user_create_request_invalid_empty_username(self):
        """Test that empty username raises validation error."""
        with pytest.raises(ValidationError) as exc_info:
            UserCreateRequest(username="", password="testpass")
        assert "username" in str(exc_info.value)

    def test_user_create_request_invalid_empty_password(self):
        """Test that empty password raises validation error."""
        with pytest.raises(ValidationError) as exc_info:
            UserCreateRequest(username="testuser", password="")
        assert "password" in str(exc_info.value)

    def test_user_create_request_invalid_email_format(self):
        """Test that invalid email format raises validation error."""
        with pytest.raises(ValidationError) as exc_info:
            UserCreateRequest(
                username="testuser",
                password="testpass",
                email="invalid-email"
            )
        assert "email" in str(exc_info.value)

    def test_user_create_request_valid_email_formats(self):
        """Test that various valid email formats are accepted."""
        valid_emails = [
            "test@example.com",
            "user.name@domain.co.uk",
            "user+tag@example.org",
            "user123@test-domain.com",
        ]
        
        for email in valid_emails:
            user = UserCreateRequest(
                username="testuser",
                password="testpass",
                email=email
            )
            assert user.email == email

    def test_user_create_request_serialization(self, sample_user_data):
        """Test that model serialization works correctly."""
        user = UserCreateRequest(**sample_user_data)
        user_dict = user.model_dump()
        
        assert user_dict["username"] == sample_user_data["username"]
        assert user_dict["password"] == sample_user_data["password"]
        assert user_dict["email"] == sample_user_data["email"]
        assert user_dict["full_name"] == sample_user_data["display_name"]

    def test_user_create_request_json_serialization(self, sample_user_data):
        """Test that JSON serialization works correctly."""
        user = UserCreateRequest(**sample_user_data)
        user_json = user.model_dump_json()
        
        assert "testuser" in user_json
        assert "test@example.com" in user_json


class TestUserResponse:
    """Test cases for UserResponse model."""

    def test_valid_user_response(self):
        """Test creating a valid UserResponse."""
        user = UserResponse(
            id="123",
            username="testuser",
            email="test@example.com",
            full_name="Test User"
        )
        assert user.id == "123"
        assert user.username == "testuser"
        assert user.email == "test@example.com"
        assert user.full_name == "Test User"

    def test_user_response_minimal_data(self):
        """Test creating UserResponse with only required fields."""
        user = UserResponse(id="123", username="testuser")
        assert user.id == "123"
        assert user.username == "testuser"
        assert user.email is None
        assert user.full_name is None

    def test_user_response_invalid_empty_id(self):
        """Test that empty id raises validation error."""
        with pytest.raises(ValidationError) as exc_info:
            UserResponse(id="", username="testuser")
        assert "id" in str(exc_info.value)

    def test_user_response_invalid_empty_username(self):
        """Test that empty username raises validation error."""
        with pytest.raises(ValidationError) as exc_info:
            UserResponse(id="123", username="")
        assert "username" in str(exc_info.value)

    def test_user_response_serialization(self):
        """Test that model serialization works correctly."""
        user = UserResponse(
            id="123",
            username="testuser",
            email="test@example.com",
            full_name="Test User"
        )
        user_dict = user.model_dump()
        
        assert user_dict["id"] == "123"
        assert user_dict["username"] == "testuser"
        assert user_dict["email"] == "test@example.com"
        assert user_dict["full_name"] == "Test User"


class TestHealthResponse:
    """Test cases for HealthResponse model."""

    def test_valid_healthy_response(self):
        """Test creating a valid healthy response."""
        health = HealthResponse(status="healthy", prosody=True)
        assert health.status == "healthy"
        assert health.prosody is True

    def test_valid_unhealthy_response(self):
        """Test creating a valid unhealthy response."""
        health = HealthResponse(status="degraded", prosody=False)
        assert health.status == "degraded"
        assert health.prosody is False

    def test_health_response_serialization(self):
        """Test that model serialization works correctly."""
        health = HealthResponse(status="healthy", prosody=True)
        health_dict = health.model_dump()
        
        assert health_dict["status"] == "healthy"
        assert health_dict["prosody"] is True

    def test_health_response_json_serialization(self):
        """Test that JSON serialization works correctly."""
        health = HealthResponse(status="healthy", prosody=True)
        health_json = health.model_dump_json()
        
        assert "healthy" in health_json
        assert "true" in health_json.lower()

    @pytest.mark.parametrize("status,prosody", [
        ("healthy", True),
        ("degraded", False),
        ("unhealthy", False),
        ("maintenance", True),
    ])
    def test_health_response_various_statuses(self, status, prosody):
        """Test health response with various status values."""
        health = HealthResponse(status=status, prosody=prosody)
        assert health.status == status
        assert health.prosody == prosody
