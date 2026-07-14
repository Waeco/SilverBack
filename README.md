# SilverBack — Plataforma de Nutrición Deportiva

Aplicación full-stack para conectar atletas con nutriólogos. Gestión de dietas, rutinas de ejercicio, citas y seguimiento de macros.

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Base de datos | MySQL 8.0 |
| Backend | Python 3.10+ (http.server nativo, sin frameworks) |
| Frontend | React 18 + Vite + TailwindCSS + Framer Motion |
| Autenticación | JWT (PyJWT, HS256, expiración 24h) |
| APIs externas | FatSecret (proxy OAuth 1.0a) + Wger (mirror local de ejercicios) |

---

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
pip install mysql-connector-python requests fastapi uvicorn pydantic pyjwt
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

O usa el script de inicio que arranca ambos:
```powershell
.\iniciar_servidor.ps1
```

**Producción** (con auto-reinicio ante caídas):
```powershell
.\iniciar_servidor_produccion.ps1
```

---

### Endpoints del Servidor Principal (puerto 8000)

#### Autenticación
| Método | Ruta | Descripción | Auth |
|--------|------|-------------|------|
| POST | `/api/auth` | Iniciar sesión (JWT, rate limit 5 intentos) | No |
| POST | `/api/registro` | Registrar usuario + envío de verificación email | No |
| POST | `/api/recuperar-password` | Solicitar enlace de recuperación (SMTP) | No |
| POST | `/api/cambiar-password` | Restablecer contraseña con token | No |
| GET | `/api/verificar-correo?token&id` | Verificar correo electrónico | No |

#### Usuarios
| Método | Ruta | Descripción | Rol |
|--------|------|-------------|-----|
| GET | `/api/usuario` | Listar todos | Admin |
| GET | `/api/usuario/{id}` | Obtener usuario + perfil completo | Propio |
| PUT | `/api/usuario/{id}` | Actualizar nombre/correo | Propio |

#### Comidas
| Método | Ruta | Descripción | Rol |
|--------|------|-------------|-----|
| GET | `/api/comidas?fecha&id_paciente` | Comidas de un día | Cualquiera |
| GET | `/api/dias-con-comidas?mes&id_paciente` | Días del mes con registro | Cualquiera |
| POST | `/api/comidas` | Guardar comida | Cualquiera |
| PUT | `/api/comidas/{id}` | Actualizar comida | Cualquiera |
| DELETE | `/api/comidas/{id}` | Eliminar comida | Cualquiera |

#### Subida de archivos
| Método | Ruta | Descripción | Rol |
|--------|------|-------------|-----|
| POST | `/api/upload` | Subir archivo (PNG/JPG/PDF/DOC, max 5MB) | Cualquiera |

#### Respaldos
| Método | Ruta | Descripción | Rol |
|--------|------|-------------|-----|
| POST | `/api/backup` | Generar respaldo mysqldump | Admin |

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
| `/login` | Login | Todos | Inicio de sesión |
| `/registro` | Registro | Todos | Crear cuenta |
| `/recuperar-password` | Recuperar | Todos | Solicitar enlace de recuperación |
| `/restablecer` | Restablecer | Todos | Cambiar contraseña con token |
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
│       │   ├── BarraNavegacion.jsx
│       │   ├── VistaCalendario.jsx
│       │   ├── ModalAgregarComida.jsx
│       │   ├── EditorDietaPaciente.jsx
│       │   ├── EditorRutinaPaciente.jsx
│       │   └── ValidadorPassword.jsx
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
│           ├── PaginaAdminUsuarios.jsx
│           ├── PaginaRecuperarPassword.jsx
│           ├── PaginaRestablecerPassword.jsx
│           └── PaginaNoEncontrada.jsx
├── iniciar_servidor.ps1             # Script de inicio (no versionado, tiene API keys)
├── base_de_datos.sql                # Script de BD completo (14 tablas + seed)
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
- **JWT**: Autenticación con tokens JWT (HS256, expiración 24h).
- **Rate limiting**: 5 intentos fallidos de login bloquean 15 minutos.
- **Verificación email**: Correo de confirmación al registrarse con enlace único.
- **Recuperación de contraseña**: Enlace por correo con token de 1 hora, enviado en hilo separado.
- **Validador de contraseña**: Popup en tiempo real con requisitos (6+ chars, mayúscula, minúscula, número, coincidencia).
- **Seguridad**: Headers X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy. Control de roles por endpoint.
- **Subida de archivos**: Endpoint POST /api/upload con validación de tipo (PNG/JPG/PDF/DOC) y tamaño máximo (5MB).
- **Backup**: Endpoint POST /api/backup (admin) que ejecuta mysqldump.
- **404 personalizada**: Página de error con diseño coherente y navegación.
- **Code splitting**: Carga diferida de páginas con React.lazy(). Bundle principal reducido de 618KB a 356KB.
