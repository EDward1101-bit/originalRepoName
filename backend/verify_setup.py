#!/usr/bin/env python3
"""
Quick verification script for pytest setup.
"""
import importlib
import sys
from pathlib import Path


def check_import(module_name):
    """Check if a module can be imported."""
    try:
        importlib.import_module(module_name)
        return True, None
    except ImportError as e:
        return False, str(e)


def main():
    """Verify pytest setup."""
    print("🔍 Verifying pytest setup...")

    # Check required modules
    required_modules = [
        "pytest",
        "pytest_asyncio",
        "pytest_cov",
        "pytest_mock",
        "httpx",
        "respx",
        "fastapi",
        "pydantic",
        "supabase"
    ]

    print("\n📦 Checking dependencies:")
    all_good = True
    for module in required_modules:
        success, error = check_import(module)
        status = "✅" if success else "❌"
        print(f"   {status} {module}")
        if not success:
            print(f"      Error: {error}")
            all_good = False

    if not all_good:
        print("\n❌ Some dependencies are missing. Install with:")
        print("   pip install -r requirements.txt")
        return 1

    # Check test files exist
    print("\n📁 Checking test files:")
    test_files = [
        "tests/__init__.py",
        "tests/conftest.py",
        "tests/test_models.py",
        "tests/test_services.py",
        "tests/test_api.py",
        "tests/test_integration.py"
    ]

    backend_dir = Path(__file__).parent
    for test_file in test_files:
        file_path = backend_dir / test_file
        exists = file_path.exists()
        status = "✅" if exists else "❌"
        print(f"   {status} {test_file}")
        if not exists:
            all_good = False

    # Check configuration
    print("\n⚙️  Checking configuration:")
    config_files = [
        "pytest.ini",
        "pyproject.toml",
        "Makefile"
    ]

    for config_file in config_files:
        file_path = backend_dir / config_file
        exists = file_path.exists()
        status = "✅" if exists else "❌"
        print(f"   {status} {config_file}")
        if not exists:
            all_good = False

    if all_good:
        print("\n🎉 Setup verification successful!")
        print("\n🚀 Ready to run tests:")
        print("   python -m pytest")
        print("   python -m pytest -m unit")
        print("   python -m pytest --cov=. --cov-report=html")
        return 0
    else:
        print("\n❌ Setup verification failed!")
        return 1


if __name__ == "__main__":
    sys.exit(main())
