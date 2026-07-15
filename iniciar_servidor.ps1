$env:FATSECRET_CLIENT_ID = 'd830d7b2feda4aaa8d5012d79762c937'
$env:FATSECRET_CLIENT_SECRET = '82999d9f80654b61854d48f04ad414b6'
$env:WGER_API_KEY = '5b73ac1e4a5f429b70a5f6a383da76f236666f3b'

Write-Host "FatSecret API real: activada"
Write-Host "Wger API real: activada"

$directorio = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $directorio

Write-Host "Iniciando servidor FastAPI (ejercicios/rutinas) en puerto 8001..."
$jobFast = Start-Job -ScriptBlock {
  Set-Location -LiteralPath $using:directorio
  py -m uvicorn backend.fastapi_app:app --host 0.0.0.0 --port 8001 --reload
}

Start-Sleep -Seconds 2

Write-Host "Iniciando servidor principal en puerto 8000..."
py "backend/servidor.py"

# Limpiar job al salir
Remove-Job -Job $jobFast -Force -ErrorAction SilentlyContinue
