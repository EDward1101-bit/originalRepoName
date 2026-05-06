#!/usr/bin/env python3
"""Basic test to verify pytest setup."""
import pytest


def test_basic_pytest():
    """Basic test to verify pytest is working."""
    assert True


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
