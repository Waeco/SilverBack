# ─── SilverBack - Script de inicio con auto-reinicio ─────────────────────
# Usa un loop While para reiniciar el servidor si se cae inesperadamente.
# Para detener: Ctrl+C (cierra el proceso manualmente).

$Directorio = Split-Path $MyInvocation.MyCommand.Path
Set-Location $Directorio

Write-Host "╔══════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║         SilverBack - Servidor de Producción         ║" -ForegroundColor Cyan
Write-Host "║   (Auto-reinicio ante caídas)                      ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Verificar Python
$Python = Get-Command python -ErrorAction SilentlyContinue
if (-not $Python) {
    Write-Host "[ERROR] Python no encontrado. Instálalo y agrégalo al PATH." -ForegroundColor Red
    exit 1
}

# Verificar que el frontend compilado existe
if (-not (Test-Path "frontend/dist/index.html")) {
    Write-Host "[FRONTEND] No se encontró frontend/dist. Ejecutando npm run build..." -ForegroundColor Yellow
    Set-Location frontend
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Falló el build del frontend." -ForegroundColor Red
        exit 1
    }
    Set-Location $Directorio
}

# Iniciar servidor FastAPI (ejercicios/rutinas) en segundo plano
$FastApiJob = Start-Job -ScriptBlock {
    $dir = $using:Directorio
    Set-Location $dir
    python backend/fastapi_app.py
}

Write-Host "[FASTAPI] Servidor de ejercicios/rutinas iniciado (puerto 8001)" -ForegroundColor Green

# Iniciar servidor principal con loop de auto-reinicio
$Intentos = 0
$MaxIntentos = 10

while ($true) {
    Write-Host "[SERVIDOR] Iniciando servidor principal (intento $($Intentos + 1))..." -ForegroundColor Yellow
    
    $Process = Start-Process -FilePath "python" -ArgumentList "backend/servidor.py" -NoNewWindow -PassThru
    
    # Esperar a que el proceso termine (se cae o Ctrl+C)
    $Process.WaitForExit()
    
    $Codigo = $Process.ExitCode
    $Intentos++
    
    if ($Intentos -ge $MaxIntentos) {
        Write-Host "[ERROR] Demasiados reinicios. Abortando." -ForegroundColor Red
        break
    }
    
    Write-Host "[SERVIDOR] Servidor detenido (código: $Codigo). Reiniciando en 2 segundos..." -ForegroundColor Yellow
    Start-Sleep -Seconds 2
}

# Limpiar job de FastAPI
Stop-Job $FastApiJob -ErrorAction SilentlyContinue
Remove-Job $FastApiJob -ErrorAction SilentlyContinue
