<#
    One-time setup for the Diabetic Retinopathy platform.

        - Python 3.11 venv for the AI service (TensorFlow has no 3.13/3.14 wheels)
        - installs AI dependencies
        - creates a runnable model file if none exists
        - installs frontend node modules
        - compiles the Spring Boot backend

    Usage:  powershell -ExecutionPolicy Bypass -File .\setup.ps1
#>

$root = $PSScriptRoot

$ErrorActionPreference = 'Stop'

Write-Host "== Setup: Diabetic Retinopathy platform ==" -ForegroundColor Cyan

# ---------------------------------------------------------------
# 1. Python 3.11 for the AI service
# ---------------------------------------------------------------

$python311 = & py -3.11 -c "import sys; print(sys.executable)" 2>$null

if (-not $python311) {
    Write-Host "Python 3.11 not found. TensorFlow needs 3.9 - 3.12." -ForegroundColor Red
    Write-Host "Install it from python.org, then run this script again." -ForegroundColor Red
    exit 1
}

Write-Host "Python 3.11  : $python311" -ForegroundColor Green

$venv = Join-Path $root 'ai-service\venv'

if (-not (Test-Path $venv)) {
    Write-Host "Creating venv..." -ForegroundColor Yellow
    & $python311 -m venv $venv
}

$venvPython = Join-Path $venv 'Scripts\python.exe'

Write-Host "Installing AI dependencies (this downloads TensorFlow, ~500MB)..." -ForegroundColor Yellow

& $venvPython -m pip install --upgrade pip --quiet
& $venvPython -m pip install -r (Join-Path $root 'ai-service\requirements.txt') --quiet

# ---------------------------------------------------------------
# 2. Model file
# ---------------------------------------------------------------

$model = Join-Path $root 'ai-service\models\dr_model.keras'

if (-not (Test-Path $model)) {

    Write-Host "No trained model found - creating a placeholder so the" -ForegroundColor Yellow
    Write-Host "pipeline can run. Train the real one with train.py." -ForegroundColor Yellow

    Push-Location (Join-Path $root 'ai-service')
    & $venvPython bootstrap_model.py
    Pop-Location
}
else {
    Write-Host "Model        : $model" -ForegroundColor Green
}

# ---------------------------------------------------------------
# 3. Frontend
# ---------------------------------------------------------------

Write-Host "Installing frontend packages..." -ForegroundColor Yellow

Push-Location (Join-Path $root 'frontend')

if (-not (Test-Path 'node_modules')) {
    npm install
}

if (-not (Test-Path '.env')) {
    Copy-Item '.env.example' '.env'
}

Pop-Location

# ---------------------------------------------------------------
# 4. Backend
# ---------------------------------------------------------------

Write-Host "Compiling backend..." -ForegroundColor Yellow

Push-Location (Join-Path $root 'backend')
& '.\mvnw.cmd' -q -DskipTests compile
Pop-Location

Write-Host ""
Write-Host "Setup complete. Start everything with: .\run-all.ps1" -ForegroundColor Cyan
