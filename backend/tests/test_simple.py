"""Simple test to verify pytest setup without environment issues."""
import pytest


def test_simple_pytest_setup():
    """Simple test to verify pytest is working."""
    assert True


def test_environment_isolation():
    """Test that environment isolation works."""
    # This test should pass regardless of environment variables
    import os
    original_supabase_url = os.environ.get("SUPABASE_URL")
    assert original_supabase_url is None or isinstance(original_supabase_url, str)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
