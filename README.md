# SilverBack — Plataforma de Nutrición Deportiva

Aplicación full-stack para conectar atletas con nutriólogos. Gestión de dietas, rutinas de ejercicio, citas y seguimiento de macros.

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Base de datos | MySQL 8.0 |
| Backend | Python 3.10+ (http.server nativo, sin frameworks) |
| Frontend | React 18 + Vite + TailwindCSS + Framer Motion |
| APIs externas | FatSecret (proxy OAuth 1.0a) + Wger (proxy ejercicios) |

## Requisitos

- **MySQL 8.0** instalado y funcionando (puerto 3306)
- **Python 3.10+** con `pip`
- **Node.js 18+** con `npm`
- **Git** (opcional)

---

## 1. Base de Datos

### Iniciar MySQL

```powershell
# Desde PowerShell (usando datadir local del proyecto)
& "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqld.exe" --no-defaults --datadir=C:\Users\esaua\SilverBack\mysql_data --port=3306 --console
```

> ⚠️ Si ya tienes MySQL como servicio, solo asegúrate de que esté corriendo en puerto 3306 con usuario `root` y contraseña `root`.

### Crear BD, tablas y datos de prueba

```powershell
cmd /c '"C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root -proot < "C:\Users\esaua\SilverBack\base_de_datos.sql"'
```

Esto crea la base de datos `silverback_db` con 10 tablas:
- `usuarios` — Atletas, nutriólogos y admins
- `pacientes_perfil` — Perfil extendido de atletas
- `nutriologos_perfil` — Perfil extendido de nutriólogos
- `comidas_diarias` — Registro de alimentos por fecha y tipo de comida
- `citas` — Citas entre paciente y nutriólogo
- `registro_habitos` — Resumen diario (peso, agua, calorías)
- `planes_dieta` — Planes de dieta asignados por nutriólogos
- `detalles_dieta` — Alimentos dentro de un plan de dieta
- `planes_rutina` — Planes de rutina asignados por nutriólogos
- `detalles_rutina` — Ejercicios dentro de un plan de rutina

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
pip install mysql-connector-python requests
```

### Configurar conexión

El archivo `backend/configuracion_bd.py` ya contiene las credenciales:

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

### Ejecutar servidor

```powershell
python backend\servidor.py
```

El servidor inicia en `http://localhost:8000` y sirve:
- API REST en `/api/*`
- Frontend compilado desde `frontend/dist/`

### Endpoints de la API

#### Autenticación
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/auth` | Iniciar sesión (body: `{correo, contrasena}`) |
| POST | `/api/registro` | Registrar usuario (body: `{nombre_completo, correo, contrasena, rol}`) |

#### Usuarios
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/usuario` | Listar todos los usuarios (admin) |
| GET | `/api/usuario/{id}` | Obtener usuario + perfil (paciente o nutriólogo) |
| PUT | `/api/usuario/{id}` | Actualizar nombre/correo |

#### Comidas
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/comidas?fecha=YYYY-MM-DD&id_paciente=X` | Comidas de un día |
| GET | `/api/dias-con-comidas?mes=YYYY-MM&id_paciente=X` | Días del mes con registro |
| POST | `/api/comidas` | Guardar comida |
| PUT | `/api/comidas/{id}` | Actualizar comida |
| DELETE | `/api/comidas/{id}` | Eliminar comida |

#### FatSecret (proxy)
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/buscar-alimentos?termino=pollo` | Buscar alimentos vía FatSecret OAuth 1.0a |

#### Wger (proxy)
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/buscar-ejercicios?termino=press` | Buscar ejercicios vía Wger API v2 |

#### Citas
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/citas?id_usuario=X&rol=atleta\|nutriologo` | Listar citas |
| POST | `/api/citas` | Crear cita |
| PUT | `/api/citas/{id}` | Actualizar estado |
| DELETE | `/api/citas/{id}` | Cancelar cita |

#### Hábitos
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/habitos?id_paciente=X&fecha=YYYY-MM-DD` | Obtener hábitos |
| POST | `/api/habitos` | Guardar hábito |

#### Nutriólogos
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/nutriologos?termino=&pagina=1&limite=10` | Catálogo con búsqueda y paginación |

#### Pacientes
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/pacientes?id_nutriologo=X` | Pacientes asignados a un nutriólogo |

#### Admin
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/admin/stats` | Estadísticas del sistema (usuarios, citas, etc.) |
| PUT | `/api/admin/usuarios/{id}` | Actualizar usuario (admin) |
| DELETE | `/api/admin/usuarios/{id}` | Eliminar usuario con cascade (admin) |

#### Dieta
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/dieta/{id_paciente}` | Obtener plan de dieta activo |
| POST | `/api/dieta` | Asignar plan de dieta |
| DELETE | `/api/dieta/{id_plan}` | Desactivar plan de dieta |

#### Rutina
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/rutina/{id_paciente}` | Obtener plan de rutina activo |
| POST | `/api/rutina` | Asignar plan de rutina |
| DELETE | `/api/rutina/{id_plan}` | Desactivar plan de rutina |

#### Salud
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/salud` | Health check del servidor |

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

El frontend se abre en `http://localhost:5173` con hot-reload. Se comunica con el backend en `http://localhost:8000/api`.

### Compilar para producción

```powershell
npm run build
```

Genera los archivos estáticos en `frontend/dist/`, que el backend sirve automáticamente en `http://localhost:8000`.

### Páginas del frontend

| Ruta | Página | Rol | Descripción |
|------|--------|-----|-------------|
| `/login` | Login | Todos | Inicio de sesión con credenciales de prueba |
| `/registro` | Registro | Todos | Crear cuenta (atleta o nutriólogo) |
| `/dashboard` | Dashboard | Todos | Vista adaptada al rol (atleta: anillo progreso + timeline; nutriólogo: citas+pacientes; admin: stats) |
| `/dieta` | Dieta | Atleta | Vista detallada de la dieta del día seleccionado |
| `/rutina` | Rutina | Atleta | Rutina de ejercicios (asignada por nutriólogo o propia) |
| `/nutriologos` | Nutriólogos | Atleta | Catálogo de nutriólogos con búsqueda y paginación |
| `/citas` | Citas | Todos | Lista de citas con estado, cancelación y filtro por rol |
| `/pacientes` | Pacientes | Nutriólogo | Lista de pacientes asignados con botones Dieta + Rutina |
| `/admin/usuarios` | Usuarios | Admin | CRUD completo de usuarios del sistema |
| `/perfil` | Perfil | Todos | Editar información personal |

> La barra de navegación se adapta automáticamente según el rol del usuario autenticado.

---

## 4. Integración con FatSecret

El backend actúa como proxy hacia la API de FatSecret.

### FatSecret (proxy OAuth 1.0a)

El backend firma cada solicitud con OAuth 1.0a usando credenciales del panel **REST API OAuth 1.0 Credentials** de FatSecret.

```powershell
$env:FATSECRET_CLIENT_ID='TU_CLIENTE_ID'
$env:FATSECRET_CLIENT_SECRET='TU_CLIENTE_SECRETO'
```

Sin credenciales → devuelve 10 alimentos simulados (avena, pollo, salmón, etc.).

### Wger (proxy ejercicios)

El backend busca ejercicios usando el endpoint `exercise-translation` de Wger API v2.

```powershell
$env:WGER_API_KEY='TU_API_KEY'
```

Sin clave → devuelve 15 ejercicios simulados (flexiones, sentadillas, press, etc.). La API pública de Wger funciona sin clave (con rate limiting).

### Script de inicio

```powershell
.\iniciar_servidor.ps1
```

Configura automáticamente las variables de entorno y arranca el servidor en el puerto 8000.

---

## 5. Estructura del Proyecto

```
SilverBack/
├── backend/
│   ├── configuracion_bd.py        # Conexión MySQL
│   ├── conector_fatsecret.py      # Proxy OAuth 1.0a hacia FatSecret
│   ├── conector_wger.py           # Proxy hacia Wger API v2
│   └── servidor.py                # Servidor HTTP + API REST (~1060 líneas)
├── frontend/
│   ├── index.html                 # Entry point HTML con Google Fonts
│   ├── package.json               # Dependencias Node
│   ├── vite.config.js             # Configuración Vite
│   ├── tailwind.config.js         # Configuración TailwindCSS
│   ├── postcss.config.js          # Configuración PostCSS
│   └── src/
│       ├── main.jsx               # Entry point React
│       ├── index.css              # Estilos globales + Tailwind + SweetAlert2 oscuro
│       ├── App.jsx                # Router plano con rutas protegidas
│       ├── context/
│       │   └── ContextoAutenticacion.jsx  # Sesión de usuario (localStorage)
│       ├── servicios/
│       │   ├── ApiServicio.js     # Cliente Axios para todos los endpoints
│       │   └── AlertasServicio.js # Wrapper SweetAlert2 con tema oscuro
│       ├── componentes/
│       │   ├── BarraNavegacion.jsx      # Sidebar multirol con indicador activo
│       │   ├── VistaCalendario.jsx      # Calendario de comidas + dieta blocker
│       │   ├── ModalAgregarComida.jsx   # Modal búsqueda FatSecret
│       │   ├── EditorDietaPaciente.jsx  # Modal plan de dieta (nutriólogo)
│       │   └── EditorRutinaPaciente.jsx # Modal plan de rutina (nutriólogo)
│       └── paginas/
│           ├── Dashboard.jsx            # Anillo progreso SVG + timeline (rol-aware)
│           ├── PaginaLogin.jsx          # Inicio de sesión
│           ├── PaginaRegistro.jsx       # Registro de usuarios
│           ├── PaginaPerfil.jsx         # Editar perfil
│           ├── PaginaCitas.jsx          # Gestión de citas
│           ├── PaginaDieta.jsx          # Dieta detallada (atleta)
│           ├── PaginaRutina.jsx         # Rutina de ejercicios (atleta)
│           ├── CatalogoNutriologos.jsx  # Catálogo con búsqueda (atleta)
│           ├── PaginaPacientes.jsx      # Pacientes + botones Dieta/Rutina
│           └── PaginaAdminUsuarios.jsx  # CRUD usuarios (admin)
├── mysql_data/                       # Datos de MySQL (local)
├── mysql_config/
│   └── my.ini                        # Config MySQL opcional
├── iniciar_servidor.ps1              # Script de inicio con env vars
├── base_de_datos.sql                 # Script de BD completo (10 tablas + seed)
└── README.md
```

---

## 6. Flujo de Inicio Rápido

```powershell
# Terminal 1: Iniciar MySQL
& "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqld.exe" --no-defaults --datadir=C:\Users\esaua\SilverBack\mysql_data --port=3306 --console

# Terminal 2: Iniciar Backend (con env vars)
.\iniciar_servidor.ps1
# O manualmente: python backend\servidor.py

# Terminal 3: Iniciar Frontend (desarrollo)
cd frontend; npm run dev

# Abrir http://localhost:5173
# Usuario: juan@ejemplo.com / test1234
```

---

## 7. Notas Adicionales

- **Variables en español**: Todo el código (Python, JSX, SQL) usa nombres en español.
- **Sin TypeScript**: Proyecto en JavaScript/JSX puro.
- **Estilos oscuros**: Tema base oscuro con TailwindCSS y colores personalizados.
- **Calendario**: `react-calendar` como componente central del Dashboard.
- **Macros**: Barras de progreso con colores: Proteína (azul), Carbohidratos (ámbar), Grasas (rojo).
- **Multirol**: Cada rol (atleta, nutriólogo, admin) ve su propia navegación y dashboard. La barra lateral muestra solo las páginas relevantes.
- **Catálogo nutriólogos**: Los atletas pueden buscar nutriólogos por nombre o especialidad con paginación.
- **Pacientes**: Los nutriólogos tienen acceso a la lista de pacientes asignados.
- **Admin**: Panel con estadísticas del sistema y listado completo de usuarios.
- **FatSecret**: Proxy OAuth 1.0a implementado y funcional con credenciales reales.
- **Wger**: Proxy Wger API v2 para búsqueda de ejercicios e imágenes.
- **Dieta/Rutina blocker**: Si el nutriólogo asigna un plan, el atleta no puede modificarlo (solo visualiza).
- **SweetAlert2**: Alertas con tema oscuro consistente con la UI.
- **Tipografía triple**: Bebas Neue (display), Inter (cuerpo), JetBrains Mono (datos/macros).
