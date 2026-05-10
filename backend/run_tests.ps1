$ErrorActionPreference = "Stop"

Set-Location -Path $PSScriptRoot

$venvPath = "..\.venv"

# Check if venv exists, if not, create it
if (-not (Test-Path -Path $venvPath)) {
    Write-Host "Creating virtual environment in $venvPath..."
    python -m venv $venvPath
}

# Define path to pip and pytest within the venv
$pipPath = Join-Path $venvPath "Scripts\pip.exe"
$pytestPath = Join-Path $venvPath "Scripts\pytest.exe"
if (-not (Test-Path -Path $pipPath)) {
    $pipPath = Join-Path $venvPath "bin/pip"
}
if (-not (Test-Path -Path $pytestPath)) {
    $pytestPath = Join-Path $venvPath "bin/pytest"
}

Write-Host "Installing dependencies..."
& $pipPath install -r requirements.txt

Write-Host "Running tests..."
# Run pytest
& $pytestPath -v tests/
