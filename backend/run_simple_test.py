#!/usr/bin/env python3
"""Simple test runner to verify pytest setup."""
import subprocess
import sys
import os


def main():
    """Run simple pytest test."""
    print("🧪 Running simple pytest test...")
    
    try:
        # Change to backend directory
        backend_dir = os.path.dirname(os.path.abspath(__file__))
        os.chdir(backend_dir)
        
        # Run pytest on simple test
        result = subprocess.run([
            sys.executable, "-m", "pytest", 
            "tests/test_simple.py::test_simple_pytest_setup", 
            "-v"
        ], capture_output=True, text=True)
        
        print(f"Exit code: {result.returncode}")
        print(f"Output:\n{result.stdout}")
        
        if result.stderr:
            print(f"Errors:\n{result.stderr}")
        
        return result.returncode == 0
        
    except Exception as e:
        print(f"Error running test: {e}")
        return False


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
