#!/usr/bin/env python3
"""Clean up temporary files created during testing."""
import os


def main():
    """Clean up temporary files."""
    print("🧹 Cleaning up temporary files...")

    # Files to remove
    files_to_remove = [
        "clean_test.py",
        "test_isolated.py",
        "simple_test.py",
        "verify_pytest.py",
        "temp_rename_env.py",
        "restore_env.py",
        "run_tests.py"
    ]

    removed_count = 0
    for file in files_to_remove:
        if os.path.exists(file):
            os.remove(file)
            removed_count += 1
            print(f"✅ Removed: {file}")

    if removed_count > 0:
        print(f"🧹 Removed {removed_count} temporary files")
    else:
        print("ℹ️  No temporary files to remove")

    print("✅ Cleanup completed!")
    return True


if __name__ == "__main__":
    main()
