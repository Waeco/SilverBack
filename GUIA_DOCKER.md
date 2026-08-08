# Guia para pasar SilverBack a Docker

Basada en el ultimo commit de la rama `silverback-docker` del repositorio, adaptada a tu
proyecto actual y a tus credenciales de MySQL (**root / root**, BD `silverback_db`).

> **Requisitos:** Docker Desktop instalado y corriendo (icono estable, "Engine running").

---

## Archivos incluidos en esta guia

| Archivo | Proposito |
|---|---|
| `docker-compose.yml` | Orquesta los 4 contenedores (mysql, backend, fastapi, frontend) |
| `backend/Dockerfile` | Imagen de Python 3.11 para backend + FastAPI |
| `backend/requirements.txt` | Dependencias Python |
| `frontend/Dockerfile.dev` | Imagen de Node 20 para el frontend en modo dev (hot-reload) |
| `.env` | Credenciales (MySQL root/root, FatSecret, Wger, SMTP) |
| `backend/.dockerignore`, `frontend/.dockerignore` | Evitan copiar basura a la imagen |
| `iniciar_docker.ps1` | Script de inicio con un solo comando |

## Cambios realizados al codigo

1. **`backend/configuracion_bd.py`** ahora lee variables de entorno con valores por defecto
   locales, para que funcione igual en Docker y sin Docker:
   ```
   DB_HOST=mysql      # dentro de Docker, "mysql" es el nombre del servicio
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=root
   DB_NAME=silverback_db
   ```
   Sin Docker sigue usando `localhost` por defecto (no rompes tu flujo actual).

2. **`frontend/vite.config.js`**: `host: true` (0.0.0.0), `open: false` y
   `watch.usePolling: true` para que el hot-reload funcione dentro del contenedor.

3. **`backend/configuracion_bd.py`**: se agrego tolerancia al error `1060`
   (columna duplicada) al re-ejecutar `base_de_datos.sql`, para que los reinicios
   no fallen.

### Arranque robusto (evita errores al primer `docker compose up`)

En Docker, MySQL tarda unos segundos en aceptar conexiones incluso despues de que el
contenedor reporte `healthy`. Ademas, en una BD recien creada el script SQL debe
respetar el orden de creacion de tablas con FK. Se agrego a `backend/configuracion_bd.py`:

- **`esperar_mysql()`**: reintenta la conexion a MySQL hasta 30 veces (cada 3 seg)
  antes de inicializar la base de datos. Sin esto el backend fallaba con
  `Can't connect to MySQL server on 'mysql:3306' (111)` al arrancar.
- **`inicializar_pool()`**: reintenta hasta 5 veces crear el pool por si MySQL apenas
  arranco.
- **`ejecutar_script_sql()` multi-pase**: si un `CREATE TABLE` con FK se ejecuta antes
  de la tabla referenciada (ej. `detalles_rutina` -> `ejercicios`), la sentencia se
  reintenta en pasadas posteriores hasta 5 veces en vez de abortar todo.
  Tambien tolera los errores de estado `1062` (duplicado en seed), `1060` (columna ya
  agregada) y `1146` (tabla dependiente aun no creada en la misma pasada).

Estos cambios no afectan el uso sin Docker: si tu MySQL local ya esta listo,
`esperar_mysql()` conecta al primer intento.

---

## PASO 1 — Detener MySQL local (importante)

Tu MySQL local (`MYSQL80`) ocupa el puerto **3306**, y el contenedor de MySQL usa el
mismo puerto. Debes detenerlo:

```powershell
net stop MYSQL80
```

> Si NO quieres detenerlo, edita `docker-compose.yml` y cambia el mapeo del servicio
> `mysql` a otro puerto (ej. `"3307:3306"`). Los contenedores internos no se enteran,
> solo cambia por cual puerto accedes tu desde Windows.

## PASO 2 — Levantar los contenedores

Desde la raiz del proyecto:

```powershell
.\iniciar_docker.ps1
```

O manualmente:

```powershell
docker compose up -d --build
```

Esto construye las imagenes y levanta en orden: `mysql` -> `backend` + `fastapi` -> `frontend`.

## PASO 3 — Primera ejecucion (inicializa la BD automaticamente)

El backend, al arrancar, ejecuta por si mismo `base_de_datos.sql` (crea la base
`silverback_db`, las tablas y los datos de prueba) y aplica las migraciones. No
tienes que hacer nada manual.

Verifica que todo este sano:

```powershell
docker compose ps
docker compose logs backend
```

Debes ver algo como:
```
[Servidor] Script SQL ... ejecutado correctamente.
[Servidor] Servidor iniciado en http://localhost:8000
```

## PASO 4 — Abrir la aplicacion

| Servicio | URL |
|---|---|
| Frontend (Vite) | http://localhost:5173 |
| Backend API | http://localhost:8000 |
| FastAPI (ejercicios/rutinas) | http://localhost:8001 |

Los usuarios de prueba del seed siguen siendo los mismos de siempre (admin, nutriologo, atleta).

---

## (Opcional) Migrar tus datos actuales al contenedor MySQL

Si ya tienes datos reales en tu MySQL local y quieres llevarlos al contenedor:

1. **Exportar** desde tu MySQL local (antes de detenerlo):
   ```powershell
   cmd /c '"C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqldump.exe" -u root -proot --databases silverback_db > "C:\Users\esaua\SilverBackv4\SilverBack\respaldo_docker.sql"'
   ```
2. **Importar** al contenedor:
   ```powershell
   docker compose exec -T mysql mysql -u root -proot < respaldo_docker.sql
   ```

> Si prefieres empezar de cero, no hagas nada: la BD del contenedor se crea sola
> con los datos de prueba del seed.

---

## Comandos utiles del dia a dia

```powershell
# Ver logs en vivo de un servicio
docker compose logs -f backend        # o: fastapi, frontend, mysql

# Detener todo (sin borrar datos)
docker compose down

# Detener y borrar la BD del contenedor (¡pierdes datos!)
docker compose down -v

# Reiniciar solo el backend tras editar codigo Python
docker compose restart backend fastapi

# Entrar al contenedor de MySQL
docker compose exec mysql mysql -u root -proot silverback_db

# Reconstruir desde cero tras cambiar Dockerfile
docker compose up -d --build --force-recreate
```

El frontend y los backends tienen hot-reload: editas codigo en tu editor y se
actualizan solos (no hace falta reiniciar).

---

## Solucion de problemas

| Sintoma | Causa | Solucion |
|---|---|---|
| `mysql` no queda healthy | Puerto 3306 ocupado por MySQL local | `net stop MYSQL80` y `docker compose restart mysql` |
| `backend` se reinicia en loop | No conecta a la BD (aun creandose) | Espera a que `mysql` diga `healthy` (el compose ya espera por si solo) |
| `Can't connect to MySQL server on 'mysql:3306' (111)` | MySQL aun no acepta conexiones externas al arrancar | Ya corregido con `esperar_mysql()`: el backend reintenta hasta 90 seg antes de rendirse |
| El frontend no abre en 5173 | Docker Desktop apagado | Abre Docker Desktop y espera "Engine running" |
| El navegador no carga (ERR_CONNECTION_REFUSED) | Contenedores caidos | `docker compose up -d` y revisa `docker compose ps` |
| Recaptcha en login | El sistema requiere reCAPTCHA v2 para login y registro | Define `RECAPTCHA_SECRET_KEY` en `.env`; sin llave el servidor rechaza por seguridad |
| Quieres volver a tu flujo sin Docker | MySQL local detenido | `net start MYSQL80` y usa `.\iniciar_servidor.ps1` como antes |

---

## Nota sobre la version

Esta guia documenta el estado **actual** del proyecto con Docker: los 4 contenedores
(mysql, backend, fastapi, frontend) incluyen ya chat/mensajes, notificaciones, captcha,
verificacion de correo por codigo de 6 digitos, citas con videollamada/presencial y
rutinas con dia/equipo. Tambien incluye la tolerancia a errores (`1060`, `1062`, `1146`)
del ejecutor SQL y el seed idempotente para que los reinicios no dupliquen datos.
