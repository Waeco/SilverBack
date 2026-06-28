# SilverBack — Plataforma de Nutrición Deportiva

Aplicación full-stack para conectar atletas con nutriólogos. Gestión de dietas, rutinas de ejercicio, citas, historial médico y seguimiento de macros.

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Base de datos | MySQL 8.0 |
| Backend principal | Python 3.10+ (http.server nativo) — puerto 8000 |
| Backend secundario | Python 3.10+ (FastAPI + Uvicorn) — puerto 8001 |
| Frontend | React 18 + Vite + TailwindCSS + Framer Motion |
| APIs externas | FatSecret (proxy OAuth 1.0a) + Wger (mirror local de ejercicios) |

---

## Requisitos

- **MySQL 8.0** instalado y funcionando (puerto 3306, usuario `root`, contraseña `root`)
- **Python 3.10+** con `pip`
- **Node.js 18+** con `npm`

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
# Reemplaza la ruta del SQL según tu proyecto
cmd /c '"C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root -proot < "ruta\a\base_de_datos.sql"'
```

Esto crea la base de datos `silverback_db` con 14 tablas:
- `usuarios` — Atletas, nutriólogos y admins
- `pacientes_perfil` — Perfil extendido de atletas (incluye `id_nutriologo_asignado`)
- `nutriologos_perfil` — Perfil extendido de nutriólogos
- `solicitudes_nutriologo` — Solicitudes de pacientes para ser asignados a un nutriólogo
- `comidas_diarias` — Registro de alimentos por fecha y tipo de comida
- `citas` — Citas con tipo (videollamada/presencial), hora, estado y notas
- `registro_habitos` — Resumen diario (peso, agua, calorías)
- `historial_medico` — Registros de peso, altura, enfermedades, alergias y notas
- `ejercicios` — Mirror local de ejercicios desde Wger (846 ejercicios en español)
- `planes_dieta` — Planes de dieta asignados por nutriólogos
- `detalles_dieta` — Alimentos dentro de un plan de dieta
- `planes_rutina` — Planes de rutina asignados por nutriólogos
- `detalles_rutina` — Ejercicios dentro de un plan de rutina
- `cache_alimentos` — Cache de búsquedas en FatSecret

### Usuarios de prueba (seed data)

| Rol | Correo | Contraseña |
|-----|--------|-----------|
| Atleta | juan@ejemplo.com | test1234 |
| Nutriólogo | maria@ejemplo.com | test1234 |
| Admin | admin@silverback.com | admin1234 |

---

## 2. Backend (Python)

### Instalar dependencias

```powershell
pip install mysql-connector-python requests fastapi uvicorn pydantic
```

### Configurar conexión a BD

Edita `backend/configuracion_bd.py` si tu usuario/contraseña son distintos:

```python
CONFIG = {
    'host': 'localhost',
    'port': 3306,
    'user': 'root',
    'password': 'root',
    'database': 'silverback_db',
    'charset': 'utf8mb4',
    'collation': 'utf8mb4_unicode_ci',
}
```

### APIs externas (opcional)

Crea un archivo `iniciar_servidor.ps1` con tus claves (no incluido en el repo):

```powershell
$env:FATSECRET_CLIENT_ID = 'tu_client_id'
$env:FATSECRET_CLIENT_SECRET = 'tu_client_secret'
$env:WGER_API_KEY = 'tu_wger_api_key'

# Iniciar FastAPI (ejercicios, rutinas, historial, solicitudes)
$jobFast = Start-Job -ScriptBlock {
  Set-Location ruta\del\proyecto
  python -m uvicorn backend.fastapi_app:app --host 0.0.0.0 --port 8001
}

Start-Sleep -Seconds 2

# Iniciar servidor principal
python backend/servidor.py
```

Sin credenciales de FatSecret → devuelve 10 alimentos simulados.
Sin Wger API key → la API pública funciona con rate limiting.

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
| POST | `/api/auth` | Iniciar sesión |
| POST | `/api/registro` | Registrar usuario |

#### Usuarios
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/usuario` | Listar todos (admin) |
| GET | `/api/usuario/{id}` | Obtener usuario + perfil completo |
| PUT | `/api/usuario/{id}` | Actualizar nombre/correo |

#### Comidas
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/comidas?fecha&id_paciente` | Comidas de un día |
| GET | `/api/dias-con-comidas?mes&id_paciente` | Días del mes con registro |
| POST | `/api/comidas` | Guardar comida |
| PUT | `/api/comidas/{id}` | Actualizar comida |
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
| PUT | `/api/citas/{id}` | Actualizar estado de cita |
| DELETE | `/api/citas/{id}` | Eliminar cita |

#### Hábitos
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/habitos?id_paciente&fecha` | Obtener hábitos |
| POST | `/api/habitos` | Guardar hábito |

#### Nutriólogos
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/nutriologos?termino&pagina&limite` | Catálogo con búsqueda y paginación |

#### Pacientes
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/pacientes?id_nutriologo` | Pacientes asignados a un nutriólogo |

#### Dieta
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/dieta/{id_paciente}` | Plan de dieta activo |
| POST | `/api/dieta` | Asignar plan de dieta |
| DELETE | `/api/dieta/{id_plan}` | Desactivar plan |

#### Admin
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/admin/stats` | Estadísticas del sistema |
| PUT | `/api/admin/usuarios/{id}` | Actualizar usuario |
| DELETE | `/api/admin/usuarios/{id}` | Eliminar usuario |

### Endpoints del Servidor FastAPI (puerto 8001)

#### Ejercicios
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/ejercicios/buscar?q=press` | Buscar ejercicios en mirror local |
| GET | `/api/ejercicios/{id}` | Obtener detalle de un ejercicio |

#### Rutinas
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/rutinas/paciente/{id_paciente}` | Obtener rutina activa con detalles |
| POST | `/api/rutinas` | Asignar rutina (máx. 10 ejercicios) |
| DELETE | `/api/rutinas/{id_plan}` | Desactivar rutina |

#### Historial Médico
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/historial/{id_paciente}` | Obtener todo el historial |
| POST | `/api/historial` | Crear un registro individual |
| POST | `/api/historial/completo` | Crear múltiples registros (peso, altura, enfermedades, etc.) |
| PUT | `/api/historial/{id}` | Actualizar un registro |
| DELETE | `/api/historial/{id}` | Eliminar un registro |

#### Solicitudes Nutriólogo
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/solicitudes` | Paciente envía solicitud a nutriólogo |
| GET | `/api/solicitudes/pendientes/{id_nutriologo}` | Nutriólogo ve solicitudes |
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
| `/login` | Login | Todos | Inicio de sesión |
| `/registro` | Registro | Todos | Crear cuenta |
| `/dashboard` | Dashboard | Todos | Vista adaptada al rol |
| `/dieta` | Dieta | Atleta | Dieta del día seleccionado |
| `/rutina` | Rutina | Atleta | Rutina de ejercicios |
| `/nutriologos` | Nutriólogos | Atleta | Catálogo con solicitud de asignación |
| `/citas` | Citas | Todos | Calendario interactivo; nutriólogo crea citas, atleta solo ve |
| `/historial` | Historial Médico | Atleta | Historial con resumen y navegación por días |
| `/historial/:idPaciente` | Historial Médico | Nutriólogo | Ver/editar historial de un paciente |
| `/pacientes` | Pacientes | Nutriólogo | Lista + solicitudes pendientes + Dieta/Rutina |
| `/perfil` | Perfil | Todos | Editar información + quitar nutriólogo (atleta) |
| `/admin/usuarios` | Usuarios | Admin | CRUD de usuarios |

---

## 4. Estructura del Proyecto

```
SilverBack/
├── backend/
│   ├── configuracion_bd.py          # Conexión MySQL
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
│       │   ├── VistaCalendario.jsx
│       │   ├── ModalAgregarComida.jsx
│       │   ├── EditorDietaPaciente.jsx
│       │   └── EditorRutinaPaciente.jsx
│       └── paginas/
│           ├── Dashboard.jsx
│           ├── PaginaLogin.jsx
│           ├── PaginaRegistro.jsx
│           ├── PaginaPerfil.jsx
│           ├── PaginaCitas.jsx
│           ├── PaginaDieta.jsx
│           ├── PaginaRutina.jsx
│           ├── PaginaHistorialMedico.jsx
│           ├── CatalogoNutriologos.jsx
│           ├── PaginaPacientes.jsx
│           └── PaginaAdminUsuarios.jsx
├── iniciar_servidor.ps1             # Script de inicio (no versionado, tiene API keys)
├── base_de_datos.sql                # Script de BD completo (14 tablas + seed)
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

### Nutriólogo
- Ver pacientes asignados + **solicitudes pendientes** (Aceptar/Rechazar)
- **Asignar/quitar planes de dieta** (modal con búsqueda FatSecret)
- **Asignar/quitar rutinas de ejercicios** (modal con búsqueda en mirror local + video embebido)
- **Editar historial médico** del paciente (formulario completo + eliminar registros)
- **Crear citas** desde calendario interactivo (tipo videollamada/presencial, hora, notas)
- Ver próximas citas en sidebar

### Admin
- Estadísticas del sistema (usuarios, citas, etc.)
- CRUD completo de usuarios (activar/desactivar, cambiar rol)

---

## 7. Notas Adicionales

- **Variables en español**: Todo el código usa nombres en español.
- **Sin TypeScript**: JavaScript/JSX puro.
- **Estilos oscuros**: Tema base oscuro con TailwindCSS.
- **Multirol**: Barra de navegación adaptada al rol autenticado.
- **Mirror local Wger**: 846 ejercicios en español precargados en MySQL (evita llamadas repetidas a la API).
- **Video embebido**: Los ejercicios con video de YouTube se muestran en iframe, no como link.
- **Historial médico**: Resumen visual (peso, altura, enfermedades, alergias) + navegación por días.
- **Solicitudes**: Los pacientes sin nutriólogo pueden solicitar asignación; el nutriólogo acepta/rechaza.
- **Citas con calendario**: Calendario mensual interactivo con indicadores de tipo (videollamada azul, presencial verde).
- **FatSecret**: Proxy OAuth 1.0a funcional con credenciales reales.
