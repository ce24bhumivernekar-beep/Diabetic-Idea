<#
    Starts the whole Diabetic Retinopathy pipeline in three windows:

        MongoDB (service)  <-  Spring Boot API :8080  ->  FastAPI AI :8000
                                       ^
                                React dev server :5173

    Usage:  powershell -ExecutionPolicy Bypass -File .\run-all.ps1
#>

$root = $PSScriptRoot

Write-Host "== Diabetic Retinopathy platform ==" -ForegroundColor Cyan

# ---------------------------------------------------------------
# 1. MongoDB
# ---------------------------------------------------------------

$mongo = Get-Service -Name 'MongoDB' -ErrorAction SilentlyContinue

if ($null -eq $mongo) {
    Write-Host "MongoDB service not found. Install MongoDB Server or start mongod manually." -ForegroundColor Yellow
}
elseif ($mongo.Status -ne 'Running') {
    Write-Host "Starting MongoDB service..." -ForegroundColor Yellow
    Start-Service -Name 'MongoDB'
}
else {
    Write-Host "MongoDB      : running" -ForegroundColor Green
}

# ---------------------------------------------------------------
# 2. AI service (FastAPI, port 8000)
# ---------------------------------------------------------------

$venvPython = Join-Path $root 'ai-service\venv\Scripts\python.exe'

if (-not (Test-Path $venvPython)) {
    Write-Host "Python venv missing. Run setup.ps1 first." -ForegroundColor Red
    exit 1
}

if (-not (Test-Path (Join-Path $root 'ai-service\models\dr_model.keras'))) {
    Write-Host "Model file missing. Run setup.ps1 (or ai-service\bootstrap_model.py)." -ForegroundColor Red
    exit 1
}

Write-Host "AI service   : starting on http://localhost:8000" -ForegroundColor Green

Start-Process -FilePath 'powershell' -ArgumentList @(
    '-NoExit', '-Command',
    "Set-Location '$root\ai-service'; & '$venvPython' -m uvicorn app:app --host 127.0.0.1 --port 8000"
)

# ---------------------------------------------------------------
# 3. Backend (Spring Boot, port 8080)
# ---------------------------------------------------------------

Write-Host "Backend API  : starting on http://localhost:8080" -ForegroundColor Green

Start-Process -FilePath 'powershell' -ArgumentList @(
    '-NoExit', '-Command',
    "Set-Location '$root\backend'; .\mvnw.cmd -DskipTests spring-boot:run"
)

# ---------------------------------------------------------------
# 4. Frontend (Vite, port 5173)
# ---------------------------------------------------------------

Write-Host "Frontend     : starting on http://localhost:5173" -ForegroundColor Green

Start-Process -FilePath 'powershell' -ArgumentList @(
    '-NoExit', '-Command',
    "Set-Location '$root\frontend'; npm run dev"
)

Write-Host ""
Write-Host "All three services are starting in separate windows." -ForegroundColor Cyan
Write-Host "Pipeline check: http://localhost:8080/api/health" -ForegroundColor Cyan
Write-Host "Open the app  : http://localhost:5173" -ForegroundColor Cyan
