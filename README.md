# SilverBack — Plataforma de Nutrición Deportiva

Aplicación full-stack para conectar atletas con nutriólogos. Gestión de dietas, rutinas de ejercicio, citas, historial médico, mensajería y seguimiento de macros.

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Base de datos | MySQL 8.0 |
| Backend principal | Python 3.11 (http.server nativo) — puerto 8000 |
| Backend secundario | Python 3.11 (FastAPI + Uvicorn) — puerto 8001 |
| Frontend | React 18 + Vite + TailwindCSS + Framer Motion + SweetAlert2 |
| APIs externas | FatSecret (proxy OAuth 1.0a) + Wger (mirror local de ejercicios) + reCAPTCHA v2 |

---

## Requisitos

- **MySQL 8.0** instalado y funcionando (puerto 3306, usuario `root`, contraseña `root`)
- **Python 3.10+** con `pip`
- **Node.js 18+** con `npm`
- Alternativa recomendada: **Docker Desktop** (ver sección 3.5)

---

## 1. Base de Datos

### Iniciar MySQL

```powershell
# Si tienes MySQL como servicio:
net start MySQL80

# O manualmente (reemplaza la ruta según tu instalación):
& "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqld.exe" --console
```

### Crear BD, tablas y datos de prueba

```powershell
cmd /c '"C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root -proot < "base_de_datos.sql"'
```

Esto crea la base de datos `silverback_db` con 16 tablas:
- `usuarios` — Atletas, nutriólogos y admins
- `pacientes_perfil` — Perfil extendido de atletas (incluye `id_nutriologo_asignado`)
- `nutriologos_perfil` — Perfil extendido de nutriólogos
- `solicitudes_nutriologo` — Solicitudes de pacientes para ser asignados a un nutriólogo
- `comidas_diarias` — Registro de alimentos por fecha y tipo de comida
- `citas` — Citas con tipo (videollamada/presencial), hora, estado y notas
- `registro_habitos` — Resumen diario (peso, agua, calorías)
- `historial_medico` — Registros de peso, altura, enfermedades, alergias y notas
- `ejercicios` — Mirror local de ejercicios desde Wger (846+ en español)
- `planes_dieta` — Planes de dieta asignados por nutriólogos
- `detalles_dieta` — Alimentos dentro de un plan de dieta
- `planes_rutina` — Planes de rutina asignados por nutriólogos
- `detalles_rutina` — Ejercicios dentro de un plan de rutina
- `cache_alimentos` — Cache de búsquedas en FatSecret
- `mensajes` — Chat entre paciente y nutriólogo
- `notificaciones` — Notificaciones del sistema

> El seed es **idempotente**: comidas y citas de ejemplo solo se crean si el paciente 1 no tiene ninguna, y las dietas/rutinas reutilizan su plan activo conservando la `fecha_asignado` original.

### Usuarios de prueba (seed data)

| Rol | Correo | Contraseña |
|-----|--------|-----------|
| Atleta | juan@ejemplo.com | test1234 |
| Nutriólogo | maria@ejemplo.com | test1234 |
| Admin | admin@silverback.com | admin1234 |
| Admin (equipo) | pruebadmin@ejemplo.com | admin1234 |

---

## 2. Backend (Python)

### Instalar dependencias

```powershell
pip install mysql-connector-python requests fastapi uvicorn pydantic
```

### Configurar conexión a BD

`backend/configuracion_bd.py` lee variables de entorno con valores por defecto:

| Variable | Defecto | Uso |
|----------|---------|-----|
| `DB_HOST` | `localhost` (`mysql` en Docker) | Host de MySQL |
| `DB_PORT` | `3306` | Puerto |
| `DB_USER` | `root` | Usuario |
| `DB_PASSWORD` | `root` | Contraseña |
| `DB_NAME` | `silverback_db` | Base de datos |

### APIs externas

Configura tus claves en `iniciar_servidor.ps1` (con las variables de entorno `FATSECRET_CLIENT_ID`, `FATSECRET_CLIENT_SECRET`, `WGER_API_KEY`, `RECAPTCHA_SECRET_KEY`) o en `.env` si usas Docker.

- Sin credenciales de FatSecret → devuelve 10 alimentos simulados.
- Sin Wger API key → la API pública funciona con rate limiting.
- Sin `RECAPTCHA_SECRET_KEY` → el login/registro rechaza por seguridad (requiere resolver el captcha).

### Poblar mirror local de ejercicios (una sola vez)

```powershell
python backend/poblar_ejercicios.py
```

Descarga 846+ ejercicios en español desde Wger y los inserta en la tabla `ejercicios`.

### Ejecutar servidores

Hay dos servidores que deben correr simultáneamente:

**Servidor principal** (puerto 8000):
```powershell
python backend\servidor.py
```

**Servidor FastAPI** (puerto 8001) para ejercicios, rutinas, historial y solicitudes:
```powershell
python -m uvicorn backend.fastapi_app:app --host 0.0.0.0 --port 8001
```

O usa el script de inicio que arranca ambos:
```powershell
.\iniciar_servidor.ps1
```

---

### Endpoints del Servidor Principal (puerto 8000)

#### Autenticación
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/auth` | Iniciar sesión (con reCAPTCHA v2) |
| POST | `/api/registro` | Registrar usuario (con reCAPTCHA v2) |
| POST | `/api/verificar-correo` | Confirmar correo con código de 6 dígitos |
| POST | `/api/reenviar-codigo` | Reenviar código de verificación |
| POST | `/api/recuperar-password` | Solicitar enlace de recuperación por correo |
| POST | `/api/cambiar-password` | Cambiar contraseña con token de 1h |

> Nota: el login devuelve un `token-simulado-{id}`; los endpoints del servidor principal no validan el token.

#### Usuarios
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/usuario` | Listar todos (admin) |
| GET | `/api/usuario/{id}` | Obtener usuario + perfil completo |
| PUT | `/api/usuario/{id}` | Actualizar nombre/correo (no fecha de nacimiento) |
| POST | `/api/usuario/{id}/foto` | Subir foto de perfil (base64, máx. 3 MB) |
| DELETE | `/api/usuario/{id}/foto` | Eliminar foto de perfil |

#### Comidas
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/comidas?fecha&id_paciente` | Comidas de un día |
| GET | `/api/dias-con-comidas?mes&id_paciente` | Días del mes con registro |
| POST | `/api/comidas` | Guardar comida (máx. 2 alimentos por categoría) |
| DELETE | `/api/comidas/{id}` | Eliminar comida |

#### FatSecret (proxy)
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/buscar-alimentos?termino` | Buscar alimentos |

#### Citas
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/citas?id_usuario&rol` | Listar citas (filtra por rol) |
| POST | `/api/citas` | Crear cita (body: `{id_paciente, id_nutriologo, fecha, hora, tipo, notas}`) |

#### Nutriólogos y Pacientes
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/nutriologos?termino&pagina&limite` | Catálogo con búsqueda y paginación |
| GET | `/api/nutriologo/{id}` | Detalle de un nutriólogo |
| GET | `/api/pacientes?id_nutriologo` | Pacientes asignados a un nutriólogo |

#### Dieta
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/dieta/{id_paciente}` | Plan de dieta activo (con su fecha de asignación original) |
| POST | `/api/dieta` | Asignar plan de dieta (reutiliza el plan activo si existe) |
| DELETE | `/api/dieta/{id_plan}` | Desactivar plan |

#### Mensajería
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/mensajes?id_paciente&id_nutriologo` | Historial de chat |
| POST | `/api/mensajes` | Enviar mensaje |
| PUT | `/api/mensajes/leidos` | Marcar mensajes como leídos |
| GET | `/api/mensajes/no-leidos?id_usuario` | Conteo de no leídos |

#### Notificaciones
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/notificaciones?id_usuario` | Listar notificaciones |
| GET | `/api/notificaciones/no-leidas?id_usuario` | Conteo de no leídas |
| PUT | `/api/notificaciones/{id}/leida` | Marcar una como leída |
| PUT | `/api/notificaciones/leidas` | Marcar todas como leídas |

#### Admin
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/admin/stats` | Estadísticas del sistema |
| POST | `/api/admin/usuarios` | Crear usuario |
| PUT | `/api/admin/usuarios/{id}` | Actualizar usuario |
| DELETE | `/api/admin/usuarios/{id}` | Eliminar usuario |

#### Salud
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/salud` | Health check del servidor |

### Endpoints del Servidor FastAPI (puerto 8001)

#### Ejercicios
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/ejercicios/buscar?q=&categoria=` | Buscar ejercicios en mirror local |
| GET | `/api/ejercicios/categorias` | Lista de categorías de ejercicios |

#### Rutinas
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/rutinas/paciente/{id_paciente}` | Rutina activa con detalles (conserva su fecha de asignación) |
| POST | `/api/rutinas` | Asignar rutina (máx. 10 ejercicios, reutiliza plan activo) |
| DELETE | `/api/rutinas/{id_plan}` | Desactivar rutina |

#### Historial Médico
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/historial/{id_paciente}` | Obtener todo el historial |
| POST | `/api/historial/completo` | Crear múltiples registros (peso, altura, enfermedades, etc.) |
| DELETE | `/api/historial/{id}` | Eliminar un registro |

#### Solicitudes Nutriólogo
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/solicitudes` | Paciente envía solicitud a nutriólogo |
| GET | `/api/solicitudes/pendientes/{id_nutriologo}` | Nutriólogo ve solicitudes |
| GET | `/api/solicitudes/pendientes-count?id_usuario` | Conteo para el badge del menú |
| PUT | `/api/solicitudes/{id}/aceptar` | Aceptar solicitud y asignar paciente |
| PUT | `/api/solicitudes/{id}/rechazar` | Rechazar solicitud |
| DELETE | `/api/paciente/{id_paciente}/nutriologo` | Paciente quita a su nutriólogo |

---

## 3. Frontend (React)

### Instalar dependencias

```powershell
cd frontend
npm install
```

### Ejecutar en desarrollo

```powershell
npm run dev
```

Abre en `http://localhost:5173` con hot-reload. Se comunica con ambos backends (8000 y 8001).

### Compilar para producción

```powershell
npm run build
```

Genera los archivos estáticos en `frontend/dist/`, servidos automáticamente por el backend en `http://localhost:8000`.

### Páginas del frontend

| Ruta | Página | Rol | Descripción |
|------|--------|-----|-------------|
| `/` | Landing | Todos | Página de presentación con carrusel |
| `/login` | Login | Todos | Inicio de sesión (con captcha) |
| `/registro` | Registro | Todos | Crear cuenta (con captcha) |
| `/verificar-correo` | Verificar correo | Todos | Código de 6 dígitos |
| `/recuperar-password` | Recuperar | Todos | Solicitar enlace por correo |
| `/restablecer` | Restablecer | Todos | Nueva contraseña con token |
| `/dashboard` | Dashboard | Todos | Vista adaptada al rol |
| `/dieta` | Dieta | Atleta | Dieta del día seleccionado |
| `/rutina` | Rutina | Atleta | Rutina de ejercicios |
| `/nutriologos` | Nutriólogos | Atleta | Catálogo con solicitud de asignación |
| `/citas` | Citas | Todos | Calendario interactivo; nutriólogo crea citas, atleta solo ve |
| `/mensajes` | Mensajes | Todos | Chat con su nutriólogo/paciente |
| `/historial` | Historial Médico | Atleta | Historial con resumen y navegación por días |
| `/historial/:idPaciente` | Historial Médico | Nutriólogo | Ver/editar historial de un paciente |
| `/pacientes` | Pacientes | Nutriólogo | Lista + solicitudes pendientes + Dieta/Rutina |
| `/perfil` | Perfil | Todos | Editar información + quitar nutriólogo (atleta) |
| `/admin/usuarios` | Usuarios | Admin | CRUD de usuarios |

---

## 3.5. Levantar todo con Docker (alternativa recomendada)

En vez de instalar MySQL, Python y Node manualmente, puedes levantar todo el stack con Docker en un solo comando. El frontend corre en modo desarrollo con hot-reload (Vite).

### Requisitos
- Docker Desktop instalado y corriendo.

### Pasos

```powershell
# 1. Copia el archivo de variables de entorno (ya viene con las claves de prueba del equipo)
copy .env.example .env
# Si ya tienes un .env local con tus propias claves, no lo sobreescribas.

# 2. Levanta todo (mysql + backend + fastapi + frontend)
docker compose up --build
```

Esto levanta:

| Servicio  | URL                          | Descripción                              |
|-----------|------------------------------|-------------------------------------------|
| frontend  | http://localhost:5173        | React + Vite (hot-reload)                  |
| backend   | http://localhost:8000        | API principal (http.server nativo)         |
| fastapi   | http://localhost:8001        | API de ejercicios/rutinas (FastAPI)        |
| mysql     | localhost:3306               | Base de datos (usuario `root` / `root`)    |

El contenedor `mysql` usa un volumen Docker (`mysql_data`). El propio `servidor.py` ejecuta `base_de_datos.sql` al arrancar para crear tablas y datos de prueba (seed idempotente).

### Comandos útiles

```powershell
docker compose up -d              # levantar en segundo plano
docker compose logs -f backend    # ver logs de un servicio
docker compose down               # apagar y quitar contenedores (conserva datos de MySQL)
docker compose down -v            # apagar y BORRAR también los datos de MySQL (empezar de cero)
docker compose restart backend fastapi   # reiniciar tras editar código Python
docker compose build backend      # reconstruir la imagen si cambias requirements.txt
```

### Notas
- El código de `backend/` y `frontend/` se monta como volumen, así que los cambios que hagas se reflejan sin reconstruir la imagen (solo necesitas reconstruir si agregas dependencias nuevas).
- Las claves de FatSecret, Wger y SMTP viven en `.env` (ignorado por git). `configuracion_bd.py` lee las variables `DB_*` de entorno con los mismos valores por defecto para que siga funcionando sin Docker.

---

## 4. Estructura del Proyecto

```
SilverBack/
├── backend/
│   ├── configuracion_bd.py          # Conexión MySQL (pool) + ejecución de SQL
│   ├── conector_fatsecret.py        # Proxy OAuth 1.0a hacia FatSecret
│   ├── conector_wger.py             # Proxy hacia Wger API v2
│   ├── fastapi_app.py               # FastAPI: ejercicios, rutinas, historial, solicitudes
│   ├── poblar_ejercicios.py         # Seeder: descarga 846+ ejercicios de Wger
│   └── servidor.py                  # Servidor HTTP principal + API REST
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── src/
│       ├── main.jsx
│       ├── index.css
│       ├── App.jsx
│       ├── context/
│       │   └── ContextoAutenticacion.jsx
│       ├── servicios/
│       │   ├── ApiServicio.js       # Cliente Axios (puerto 8000 y 8001)
│       │   └── AlertasServicio.js   # SweetAlert2 oscuro
│       ├── componentes/
│       │   ├── BarraNavegacion.jsx
│       │   ├── CaptchaVerificacion.jsx
│       │   ├── ValidadorPassword.jsx
│       │   ├── VistaCalendario.jsx
│       │   ├── ModalAgregarComida.jsx
│       │   ├── EditorDietaPaciente.jsx
│       │   └── EditorRutinaPaciente.jsx
│       └── paginas/
│           ├── Landing.jsx
│           ├── Dashboard.jsx
│           ├── PaginaLogin.jsx
│           ├── PaginaRegistro.jsx
│           ├── PaginaVerificarCorreo.jsx
│           ├── PaginaRecuperarPassword.jsx
│           ├── PaginaRestablecerPassword.jsx
│           ├── PaginaPerfil.jsx
│           ├── PaginaCitas.jsx
│           ├── PaginaMensajes.jsx
│           ├── PaginaDieta.jsx
│           ├── PaginaRutina.jsx
│           ├── PaginaHistorialMedico.jsx
│           ├── CatalogoNutriologos.jsx
│           ├── PaginaPacientes.jsx
│           └── PaginaAdminUsuarios.jsx
├── iniciar.ps1                      # Script de inicio rápido (dev)
├── iniciar_servidor.ps1             # Script de inicio con API keys (no versionado)
├── iniciar_docker.ps1               # Script de inicio con Docker
├── base_de_datos.sql                # Script de BD completo (16 tablas + seed idempotente)
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## 5. Flujo de Inicio Rápido

```powershell
# 1. Iniciar MySQL (si no está como servicio)
& "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqld.exe" --console

# 2. Crear BD (una sola vez)
cmd /c '"C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root -proot < "base_de_datos.sql"'

# 3. Poblar ejercicios desde Wger (una sola vez)
python backend/poblar_ejercicios.py

# 4. Iniciar servidores (PowerShell)
.\iniciar_servidor.ps1

# 5. (Opcional) Frontend en desarrollo
cd frontend; npm run dev

# Abrir http://localhost:5173 (dev) o http://localhost:8000 (prod)
# Usuario: juan@ejemplo.com / test1234
```

> Si usas Docker: detén MySQL local (`net stop MYSQL80`) y ejecuta `.\iniciar_docker.ps1`.

---

## 6. Funcionalidades por Rol

### Atleta
- Ver/editar dieta propia (si no tiene plan asignado)
- Ver/editar rutina propia (si no tiene plan asignado)
- Explorar catálogo de nutriólogos con búsqueda
- **Enviar solicitud** a un nutriólogo para ser asignado
- **Quitar nutriólogo** desde su perfil
- Ver historial médico (solo lectura, con resumen y navegación por días)
- Ver citas (solo lectura, calendario)
- Chat con su nutriólogo

### Nutriólogo
- Ver pacientes asignados + **solicitudes pendientes** (Aceptar/Rechazar)
- **Asignar/quitar planes de dieta** (modal con búsqueda FatSecret)
- **Asignar/quitar rutinas de ejercicios** (modal con búsqueda en mirror local + video embebido)
- **Editar historial médico** del paciente (formulario completo + eliminar registros)
- **Crear citas** desde calendario interactivo (tipo videollamada/presencial, hora, notas)
- Chat con sus pacientes

### Admin
- Estadísticas del sistema (usuarios, citas, etc.)
- CRUD completo de usuarios (activar/desactivar, cambiar rol)

---

## 7. Notas Adicionales

- **Variables en español**: Todo el código usa nombres en español.
- **Sin TypeScript**: JavaScript/JSX puro.
- **Estilos oscuros**: Tema base oscuro con TailwindCSS.
- **Multirol**: Barra de navegación adaptada al rol autenticado.
- **Mirror local Wger**: 846+ ejercicios en español precargados en MySQL (evita llamadas repetidas a la API).
- **Límites de negocio**: máx. 2 alimentos por categoría de comida; máx. 10 ejercicios por rutina.
- **Plan vs. registro diario**: El plan de dieta del nutriólogo se muestra como tarjeta separada; el resumen de macros del dashboard solo suma las comidas que el atleta registró realmente.
- **Fechas de asignación**: dietas y rutinas conservan su `fecha_asignado` original al reasignarse (no se re-fecha al día de la sesión).
- **Seed idempotente**: comidas y citas de ejemplo solo se crean si no existen registros para el paciente 1.
- **Video embebido**: Los ejercicios con video de YouTube se muestran en iframe, no como link.
- **Historial médico**: Resumen visual (peso, altura, enfermedades, alergias) + navegación por días.
- **Solicitudes**: Los pacientes sin nutriólogo pueden solicitar asignación; el nutriólogo acepta/rechaza.
- **Citas con calendario**: Calendario mensual interactivo con indicadores de tipo (videollamada azul, presencial verde).
- **FatSecret**: Proxy OAuth 1.0a funcional con credenciales reales.
- **Chat y notificaciones**: Mensajería paciente–nutriólogo con contadores de no leídos.
- **reCAPTCHA v2**: Protege login y registro (requiere `RECAPTCHA_SECRET_KEY`).
