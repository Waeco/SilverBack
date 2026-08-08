# ============================================================
# SilverBack - Iniciar con Docker Desktop
# ============================================================
Write-Host "========================================"
Write-Host "  SilverBack - Docker"
Write-Host "========================================"

# 1) Verificar que Docker Desktop este corriendo
$dockerInfo = docker info 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "[!] Docker Desktop no esta corriendo."
    Write-Host "    Abre Docker Desktop y espera a que diga 'Engine running'."
    exit 1
}
Write-Host "[1/4] Docker Desktop: OK"

# 2) Verificar conflicto de puerto 3306 con MySQL local
$puerto3306 = Get-NetTCPConnection -LocalPort 3306 -State Listen -ErrorAction SilentlyContinue
if ($puerto3306) {
    Write-Host "[!] El puerto 3306 esta ocupado por MySQL local."
    Write-Host "    Opciones:"
    Write-Host "      a) Detener MySQL local:    net stop MYSQL80"
    Write-Host "      b) Cambiar el mapeo a 3307 (edita docker-compose.yml, mysql -> ports)."
    Write-Host ""
    $resp = Read-Host "¿Detener MySQL local ahora? (s/n)"
    if ($resp -eq 's') {
        net stop MYSQL80
        Start-Sleep -Seconds 2
    } else {
        Write-Host "[!] Abortando para evitar conflicto de puertos."
        exit 1
    }
}

# 3) Levantar contenedores
Write-Host "[2/4] Construyendo y levantando contenedores..."
docker compose up -d --build

# 4) Esperar a que MySQL este sano y mostrar URLs
Write-Host "[3/4] Esperando a que MySQL este listo..."
$espera = 0
do {
    Start-Sleep -Seconds 3
    $espera += 3
    $salud = docker inspect --format '{{.State.Health.Status}}' silverback_mysql 2>&1
} while ($salud -notmatch 'healthy' -and $espera -lt 60)

if ($salud -match 'healthy') {
    Write-Host "      MySQL: sano"
} else {
    Write-Host "      [!] MySQL aun no reporta healthy (verifica con: docker compose logs mysql)"
}

Write-Host "[4/4] Listo!"
Write-Host ""
Write-Host "  Frontend:  http://localhost:5173"
Write-Host "  Backend:   http://localhost:8000"
Write-Host "  FastAPI:   http://localhost:8001"
Write-Host ""
Write-Host "Logs en vivo:  docker compose logs -f"
Write-Host "Detener todo:  docker compose down"
Write-Host "Borrar datos:  docker compose down -v   (cuidado, borra la BD)"
