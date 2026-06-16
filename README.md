# SilverBack — Plataforma de Nutrición Deportiva

Aplicación full-stack para conectar atletas con nutriólogos. Gestión de dietas, citas y seguimiento de macros.

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Base de datos | MySQL 8.0 |
| Backend | Python 3.10+ (http.server nativo, sin frameworks) |
| Frontend | React 18 + Vite + TailwindCSS + Framer Motion |
| API externa | FatSecret (proxy vía backend) |

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

Esto crea la base de datos `silverback_db` con 6 tablas:
- `usuarios` — Atletas, nutriólogos y admins
- `pacientes_perfil` — Perfil extendido de atletas
- `nutriologos_perfil` — Perfil extendido de nutriólogos
- `comidas_diarias` — Registro de alimentos por fecha y tipo de comida
- `citas` — Citas entre paciente y nutriólogo
- `registro_habitos` — Resumen diario (peso, agua, calorías)

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
| GET | `/api/buscar-alimentos?termino=pollo` | Buscar alimentos (simulado sin credenciales) |

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
| `/dashboard` | Dashboard | Todos | Vista adaptada al rol (atleta: comidas; nutriólogo: citas+pacientes; admin: stats) |
| `/dieta` | Dieta | Atleta | Vista detallada de la dieta del día seleccionado |
| `/nutriologos` | Nutriólogos | Atleta | Catálogo de nutriólogos con búsqueda y paginación |
| `/citas` | Citas | Todos | Lista de citas con estado, cancelación y filtro por rol |
| `/pacientes` | Pacientes | Nutriólogo | Lista de pacientes asignados con datos de perfil |
| `/admin/usuarios` | Usuarios | Admin | Listado completo de usuarios del sistema |
| `/perfil` | Perfil | Todos | Editar información personal |

> La barra de navegación se adapta automáticamente según el rol del usuario autenticado.

---

## 4. Integración con FatSecret

El backend actúa como proxy hacia la API de FatSecret.

### Modo simulación (por defecto)

Sin credenciales configuradas, `buscar_alimentos()` devuelve 10 alimentos simulados (avena, huevo, pollo, etc.).

### Modo real

Configurar las variables de entorno antes de iniciar el servidor:

```powershell
$env:FATSECRET_CLIENT_ID='TU_CLIENTE_ID'
$env:FATSECRET_CLIENT_SECRET='TU_CLIENTE_SECRETO'
python backend\servidor.py
```

Con credenciales válidas, el backend firma cada solicitud con OAuth 1.0a y consulta la API real de FatSecret.

---

## 5. Estructura del Proyecto

```
SilverBack/
├── backend/
│   ├── configuracion_bd.py     # Conexión MySQL
│   ├── conector_fatsecret.py   # Proxy hacia FatSecret
│   └── servidor.py             # Servidor HTTP + API REST
├── frontend/
│   ├── index.html              # Entry point HTML
│   ├── package.json            # Dependencias Node
│   ├── vite.config.js          # Configuración Vite
│   ├── tailwind.config.js      # Configuración TailwindCSS
│   ├── postcss.config.js       # Configuración PostCSS
│   └── src/
│       ├── main.jsx            # Entry point React
│       ├── index.css           # Estilos globales + Tailwind
│       ├── App.jsx             # Router principal
│       ├── context/
│       │   └── ContextoAutenticacion.jsx  # Sesión de usuario
│       ├── servicios/
│       │   └── ApiServicio.js  # Cliente Axios para API
│       ├── componentes/
│       │   ├── VistaCalendario.jsx     # Calendario de comidas
│       │   ├── ModalAgregarComida.jsx  # Modal búsqueda FatSecret
│       │   └── BarraNavegacion.jsx     # Sidebar de navegación
│       └── paginas/
│           ├── Dashboard.jsx           # Panel principal (vista por rol)
│           ├── PaginaLogin.jsx         # Inicio de sesión
│           ├── PaginaRegistro.jsx      # Registro de usuarios
│           ├── PaginaPerfil.jsx        # Editar perfil
│           ├── PaginaCitas.jsx         # Gestión de citas
│           ├── PaginaDieta.jsx         # Dieta detallada (atleta)
│           ├── CatalogoNutriologos.jsx # Catálogo con búsqueda (atleta)
│           ├── PaginaPacientes.jsx     # Pacientes asignados (nutriólogo)
│           └── PaginaAdminUsuarios.jsx # Listado de usuarios (admin)
├── mysql_data/                    # Datos de MySQL (local)
├── mysql_config/
│   └── my.ini                     # Config MySQL opcional
├── base_de_datos.sql              # Script de BD completo
└── README.md
```

---

## 6. Flujo de Inicio Rápido

```powershell
# Terminal 1: Iniciar MySQL
& "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqld.exe" --no-defaults --datadir=C:\Users\esaua\SilverBack\mysql_data --port=3306 --console

# Terminal 2: Iniciar Backend
python backend\servidor.py

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
- **FatSecret**: Proxy OAuth 1.0a implementado; solo falta agregar credenciales reales.
