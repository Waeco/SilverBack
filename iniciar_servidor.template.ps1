# Configura aquí tus claves API reales o deja vacío para modo simulado
$env:FATSECRET_CLIENT_ID = 'TU_CLIENTE_ID'
$env:FATSECRET_CLIENT_SECRET = 'TU_CLIENTE_SECRET'
$env:WGER_API_KEY = 'TU_API_KEY'

Write-Host "FatSecret API real: $($env:FATSECRET_CLIENT_ID ? 'SI' : 'NO (simulado)')"
Write-Host "Wger API real: $($env:WGER_API_KEY ? 'SI' : 'NO (simulado)')"

Set-Location -LiteralPath "C:\Users\esaua\SilverBack"
Write-Host "Iniciando servidor en puerto 8000..."
python "backend/servidor.py"
