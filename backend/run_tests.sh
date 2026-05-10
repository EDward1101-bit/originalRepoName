#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

VENV_PATH="../.venv"

# Check if venv exists, if not, create it
if [ ! -d "$VENV_PATH" ]; then
    echo "Creating virtual environment in $VENV_PATH..."
    python3 -m venv "$VENV_PATH"
fi

# Define path to pip and pytest within the venv
PIP_PATH="$VENV_PATH/bin/pip"
PYTEST_PATH="$VENV_PATH/bin/pytest"

echo "Installing dependencies..."
"$PIP_PATH" install -r requirements.txt

echo "Running tests..."
# Run pytest
"$PYTEST_PATH" -v tests/
