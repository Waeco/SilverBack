$env:FATSECRET_CLIENT_ID = 'd830d7b2feda4aaa8d5012d79762c937'
$env:FATSECRET_CLIENT_SECRET = '82999d9f80654b61854d48f04ad414b6'
$env:WGER_API_KEY = '5b73ac1e4a5f429b70a5f6a383da76f236666f3b'

Write-Host "========================================"
Write-Host "  SilverBack - Inicio rápido"
Write-Host "========================================"
Write-Host "FatSecret API: activada"
Write-Host "Wger API:      activada"
Write-Host ""
Write-Host "Backend:  http://localhost:8000"
Write-Host "Frontend: http://localhost:5173"
Write-Host "========================================"
Write-Host ""

$directorio = 'C:\Users\esaua\SilverBackv4\SilverBack'
Set-Location -LiteralPath $directorio

# Iniciar MySQL si está instalado pero detenido
$mysql = Get-Service -Name "MySQL" -ErrorAction SilentlyContinue
if ($mysql -and $mysql.Status -eq 'Stopped') {
    Write-Host "[0/3] Iniciando MySQL..."
    try {
        Start-Service -Name "MYSQL80" -ErrorAction Stop
        Start-Sleep -Seconds 3
        Write-Host "      MySQL iniciado correctamente."
    } catch {
        Write-Host "      [!] No se pudo iniciar MySQL automáticamente."
        Write-Host "      Ejecuta PowerShell como ADMINISTRADOR y luego: net start MYSQL80"
        Write-Host "      O inicia MySQL manualmente desde 'Services' (servicios.msc)."
    }
} elseif ($mysql -and $mysql.Status -eq 'Running') {
    Write-Host "[0/3] MySQL ya está en ejecución."
} elseif (-not $mysql) {
    Write-Host "[!] MySQL no está instalado. La autenticación y BD no estarán disponibles."
}

Write-Host "[1/3] Iniciando frontend..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$directorio\frontend'; npm run dev"

Start-Sleep -Seconds 2

Write-Host "[2/3] Iniciando backend..."
Write-Host "Presiona Ctrl+C para detener el servidor."
python "backend/servidor.py"
