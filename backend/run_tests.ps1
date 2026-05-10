$ErrorActionPreference = "Stop"

$venvPath = "..\.venv"

# Check if venv exists, if not, create it
if (-not (Test-Path -Path $venvPath)) {
    Write-Host "Creating virtual environment in $venvPath..."
    python -m venv $venvPath
}

# Define path to pip and pytest within the venv
$pipPath = Join-Path $venvPath "Scripts\pip.exe"
$pytestPath = Join-Path $venvPath "Scripts\pytest.exe"

# Install dependencies if pytest doesn't exist
if (-not (Test-Path -Path $pytestPath)) {
    Write-Host "Installing dependencies..."
    & $pipPath install -r requirements.txt
    & $pipPath install pytest pytest-asyncio httpx respx
}

Write-Host "Running tests..."
# Run pytest
& $pytestPath -v tests/
