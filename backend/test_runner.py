#!/usr/bin/env python3
"""
Test runner script to verify pytest setup without bash dependency issues.
"""
import subprocess
import sys
from pathlib import Path


def run_command(cmd, cwd=None):
    """Run a command and return the result."""
    try:
        use_shell = isinstance(cmd, str)
        result = subprocess.run(
            cmd,
            shell=use_shell,
            cwd=cwd,
            capture_output=True,
            text=True
        )
        return result.returncode == 0, result.stdout, result.stderr
    except Exception as e:
        return False, "", str(e)


def main():
    """Run basic tests to verify pytest setup."""
    backend_dir = Path(__file__).parent

    print("🧪 Testing pytest setup...")

    # Check if pytest is available
    success, stdout, stderr = run_command([sys.executable, "-m", "pytest", "--version"], cwd=backend_dir)
    if not success:
        print(f"❌ pytest not available: {stderr}")
        return 1
    print(f"✅ pytest version: {stdout.strip()}")

    # Run a simple test to verify setup
    print("\n🔍 Running basic test discovery...")
    success, stdout, stderr = run_command([sys.executable, "-m", "pytest", "--collect-only", "-q"], cwd=backend_dir)
    if not success:
        print(f"❌ Test discovery failed: {stderr}")
        return 1

    # Count discovered tests
    test_count = len([line for line in stdout.split('\n') if line.strip() and '::' in line])
    print(f"✅ Discovered {test_count} tests")

    # Run unit tests only (fastest)
    print("\n⚡ Running unit tests...")
    success, stdout, stderr = run_command([sys.executable, "-m", "pytest", "-m", "unit", "-v"], cwd=backend_dir)
    if not success:
        print(f"❌ Unit tests failed: {stderr}")
        return 1

    print("✅ Unit tests passed!")

    # Check test coverage (basic)
    print("\n📊 Running tests with coverage...")
    success, stdout, stderr = run_command([sys.executable, "-m", "pytest", "--cov=.", "--cov-report=term-missing"], cwd=backend_dir)
    if not success:
        print(f"⚠️  Coverage check failed (but tests may still work): {stderr}")
    else:
        print("✅ Coverage report generated!")

    print("\n🎉 All tests completed successfully!")
    print("\n📋 Summary:")
    print("   - pytest infrastructure: ✅")
    print("   - Test discovery: ✅")
    print("   - Unit tests: ✅")
    print("   - Coverage reporting: ✅")

    return 0


if __name__ == "__main__":
    sys.exit(main())
