# Testing Guide

This directory contains comprehensive tests for the XMPP Chat backend application.

## Test Structure

```
tests/
├── __init__.py          # Test package initialization
├── conftest.py          # Shared fixtures and configuration
├── test_models.py       # Tests for Pydantic models
├── test_services.py     # Tests for business logic services
├── test_api.py          # Tests for FastAPI endpoints
├── test_integration.py  # Integration tests for workflows
└── README.md           # This file
```

## Running Tests

### Run All Tests
```bash
pytest
```

On Windows (any terminal), prefer:
```bash
python -m pytest
```

### Run with Coverage
```bash
pytest --cov=. --cov-report=html
```

### Run Specific Test Categories
```bash
# Unit tests only
pytest -m unit

# Integration tests only
pytest -m integration

# Slow tests only
pytest -m slow

# External service tests
pytest -m external
```

### Run Specific Files
```bash
pytest tests/test_models.py
pytest tests/test_services.py
pytest tests/test_api.py
pytest tests/test_integration.py
```

### Run with Verbose Output
```bash
pytest -v
```

### Run with Duration Timing
```bash
pytest --durations=10
```

## Test Categories

### Unit Tests (`@pytest.mark.unit`)
- Test individual components in isolation
- Mock all external dependencies
- Fast and reliable
- Examples: Model validation, service methods

### Integration Tests (`@pytest.mark.integration`)
- Test multiple components working together
- Mock external services but test internal integration
- Slower but more realistic
- Examples: Complete user creation flow

### Slow Tests (`@pytest.mark.slow`)
- Tests that take longer to run
- Performance testing
- Concurrent request handling
- Examples: Load testing, database operations

### External Tests (`@pytest.mark.external`)
- Tests that require external services
- May fail if services aren't available
- Marked as external to allow skipping
- Examples: Real Prosody/Supabase connections

## Test Fixtures

### Common Fixtures
- `test_client`: FastAPI TestClient for sync testing
- `async_client`: httpx AsyncClient for async testing
- `mock_supabase`: Mocked Supabase client
- `mock_prosody_client`: Mocked Prosody XMPP client
- `mock_user_sync`: Mocked user synchronization service
- `sample_user_data`: Sample user data for testing
- `sample_message_data`: Sample message data for testing

### Environment Variables
Tests use mocked dependencies and don't require real environment variables. However, for integration tests marked with `@pytest.mark.external`, you may need to set:

```bash
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
PROSODY_URL=http://localhost:5280
```

## Coverage

The project aims for high test coverage. Current coverage targets:
- Models: 100%
- Services: 90%+
- API endpoints: 85%+
- Overall: 85%+

View detailed coverage reports:
```bash
pytest --cov=. --cov-report=html
# Open htmlcov/index.html in your browser
```

## Best Practices

### Writing Tests
1. **One assertion per test** when possible
2. **Descriptive test names** that explain what is being tested
3. **Use fixtures** for common setup/teardown
4. **Mock external dependencies** to ensure tests are reliable
5. **Test both success and failure** scenarios

### Test Organization
- Group related tests in classes
- Use descriptive docstrings
- Mark tests with appropriate markers
- Keep test files focused on specific areas

### Async Testing
- Use `@pytest.mark.asyncio` for async functions
- Use `async_client` fixture for async API testing
- Mock async services with `AsyncMock`

## Debugging Tests

### Running with Debugger
```bash
pytest --pdb
```

### Stop on First Failure
```bash
pytest -x
```

### Run Specific Test
```bash
pytest tests/test_services.py::TestProsodyClient::test_health_check_success
```

### Print Output
```bash
pytest -s
```

## Continuous Integration

Tests run automatically in CI/CD pipeline:
- All tests must pass for PR to be mergeable
- Coverage reports are uploaded to Codecov
- Tests run with both Python 3.12

## Troubleshooting

### Common Issues

1. **ImportError**: Make sure you're in the backend directory
2. **Async fixture errors**: Ensure `@pytest.mark.asyncio` is used
3. **Mock not working**: Check patch paths and import locations
4. **Database connection errors**: Tests should use mocks, not real DB

### Running Tests Locally

If you encounter issues running tests locally:

```bash
# Install test dependencies
pip install -r requirements.txt

# Run from backend directory
cd backend
pytest

# If still having issues, try:
python -m pytest
```

## Contributing

When adding new features:
1. Write tests before or alongside implementation
2. Aim for high coverage on new code
3. Use appropriate test markers
4. Update this README if adding new test categories
5. Ensure all tests pass before submitting PR

## Test Data

Tests use consistent sample data:
- Username: `testuser`
- Email: `test@example.com`
- Password: `password123`
- Full Name: `Test User`

This ensures predictable test behavior and easier debugging.
