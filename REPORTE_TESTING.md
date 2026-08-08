# Reporte de Testing — SilverBack

> Evaluación contra la lista de pruebas de sistema web.

---

## Resumen

| Estado | Cantidad |
|--------|----------|
| ✅ Cumple | 20 |
| ⚠️ Parcial | 9 |
| ❌ No cumple | 3 |
| ❓ No se puede determinar | 4 |

---

## Detalle por caso

### Funcionalidad

| # | Caso | Estado | Observaciones |
|---|------|--------|---------------|
| 1 | **Registro de usuario** | ✅ | Crea cuenta + envía correo de verificación con enlace único. Token expira en 24h. |
| 2 | **Inicio de sesión (válido)** | ✅ | Devuelve `token-simulado-{id}`. Redirección al dashboard según rol. |
| 3 | **Inicio de sesión (inválido)** | ✅ | Error 401 con mensaje "Credenciales inválidas". Sin acceso al sistema. |
| 4 | **Recuperación de contraseña** | ✅ | Enlace por correo SMTP con token de 1h, página dedicada con validador de contraseña. |
| 5 | **Envío y guardado** | ✅ | Comidas, citas, dieta, rutinas, historial, mensajes — todo persistido en MySQL. |
| 6 | **Edición y eliminación** | ✅ | PUT/DELETE en usuario y admin. DELETE en comidas, dieta. Reflejo inmediato en UI. (PUT/DELETE de comidas/citas/hábitos eliminados del backend por código muerto.) |
| 7 | **Validación campos obligatorios** | ✅ | Frontend y backend validan. Mensajes claros en español. |
| 8 | **Carga de archivos** | ✅ | Envío de foto de perfil (base64, PNG/JPG/GIF/WebP, máx. 3 MB). Se sirve bajo `/uploads/perfil/`. |

### Rendimiento

| # | Caso | Estado | Observaciones |
|---|------|--------|---------------|
| 9 | **Carga página principal** | ✅ | SPA con code splitting (React.lazy). Bundle ~356KB. Carga <1s. |
| 10 | **Prueba de carga (concurrentes)** | ❌ | Servidor single-threaded (`http.server`). No maneja concurrencia real. Mejora: usar gunicorn o uvicorn. |
| 11 | **Tiempo respuesta API** | ⚠️ | Consultas simples <200ms. Consultas con JOINs múltiples pueden superar 500ms. Mejora: índices adicionales. |
| 12 | **Prueba de estrés** | ⚠️ | Pool de conexiones MySQL implementado (`inicializar_pool`). Sin balanceador; el servidor principal sigue siendo single-threaded. Mejora: mover todo a uvicorn. |
| 13 | **Consulta grandes volúmenes** | ⚠️ | Sin paginación en algunos endpoints (comidas, citas, historial). Mejora: agregar LIMIT/OFFSET y filtros por fecha. |

### Usabilidad

| # | Caso | Estado | Observaciones |
|---|------|--------|---------------|
| 14 | **Navegación intuitiva** | ✅ | Menú adaptado por rol, breadcrumbs implícitos, botones de retroceso. |
| 15 | **Diseño responsivo** | ✅ | Tailwind CSS con breakpoints sm/md/lg. Menú hamburguesa en móvil. |
| 16 | **Mensajes de validación** | ✅ | Todos los errores en español, con color rojo y iconos. Alertas con SweetAlert2. |

### Compatibilidad

| # | Caso | Estado | Observaciones |
|---|------|--------|---------------|
| 17 | **Navegadores** | ❓ | Probado en Chrome/Edge. Firefox y Safari no verificados formalmente. |
| 18 | **Sistemas operativos** | ❓ | Probado solo en Windows. Linux/macOS no verificado. |
| 19 | **Dispositivos móviles** | ❓ | Diseño responsivo funciona, pero no probado en iOS/Android real. |

### Seguridad

| # | Caso | Estado | Observaciones |
|---|------|--------|---------------|
| 20 | **Inyección SQL** | ✅ | 100% parametrizado con `%s` placeholders. Sin cadenas concatenadas. |
| 21 | **Validación sesión y token** | ⚠️ | Token `token-simulado` local en el navegador. Los endpoints no validan el token ni expiración. 401 → redirect a login. Mejora: JWT real con middleware. |
| 22 | **HTTPS/TLS** | ❌ | Solo HTTP local. Producción requiere certificado SSL (Let's Encrypt). |
| 23 | **Control permisos por rol** | ✅ | Roles verificados por endpoint. Admin, nutriólogo, atleta tienen accesos diferenciados. |
| 24 | **Protección XSS** | ⚠️ | React escapa automáticamente en JSX. Backend no aplica escaping HTML adicional. Mejora: helmet/CSP headers. |
| 25 | **Protección CSRF** | ⚠️ | Sin tokens CSRF. El uso de Bearer token en Authorization header (no cookie) mitiga parcialmente. Mejora: SameSite cookies. |
| 26 | **Bloqueo intentos fallidos** | ✅ | 5 intentos → cuenta bloqueada temporalmente (por usuario). Implementado en login. |
| 27 | **Política de contraseñas** | ✅ | 6+ chars, mayúscula, minúscula, número, coincidencia. Validación frontend + backend. |

### Accesibilidad

| # | Caso | Estado | Observaciones |
|---|------|--------|---------------|
| 28 | **WCAG básico** | ⚠️ | Contraste adecuado (tema oscuro). Faltan: textos alternativos en imágenes, roles ARIA, foco visible. |
| 29 | **Lector de pantalla** | ❓ | No probado. `label` con `htmlFor` presentes en formularios, lo cual ayuda. |
| 30 | **Navegación por teclado** | ⚠️ | Formularios navegables con Tab. Faltan: skip links, indicadores de foco personalizados. |

### Estabilidad

| # | Caso | Estado | Observaciones |
|---|------|--------|---------------|
| 31 | **Manejo errores 404/500** | ✅ | La SPA redirige a Landing (ruta desconocida con `<Route path="*">`). API devuelve JSON con códigos HTTP correctos. |
| 32 | **Recuperación caída servidor** | ⚠️ | Sin process manager real. El script `iniciar_servidor.ps1` arranca ambos servidores; ante una caída hay que reiniciar manualmente. Mejora: supervisor/pm2 o systemd. |
| 33 | **Recuperación pérdida conexión** | ✅ | Backend detecta conexión BD fallida y responde con error 500. Sin pérdida de datos. |

### Integración

| # | Caso | Estado | Observaciones |
|---|------|--------|---------------|
| 34 | **Servicios externos** | ✅ | FatSecret (OAuth 1.0a real) + Wger (API real, 846 ejercicios en mirror local). |
| 35 | **Envío de correo** | ✅ | SMTP Gmail funcional. Recuperación de contraseña y verificación de registro. |

### Respaldo

| # | Caso | Estado | Observaciones |
|---|------|--------|---------------|
| 36 | **Respaldo y restauración** | ❌ | No hay endpoint de backup en el backend. En Docker se respalda con `mysqldump` manual o el volumen `mysql_data`. Mejora: tarea de respaldo automático. |

---

## Mejoras recomendadas

### Críticas
1. **HTTPS** — Implementar certificado SSL (Let's Encrypt + certbot) para producción
2. **Servidor concurrente** — Reemplazar `http.server` por uvicorn/gunicorn para soportar carga real
3. **Token de sesión** — Migrar del `token-simulado` actual a JWT real con verificación en cada endpoint

### Medias
4. **CSRF** — Agregar tokens CSRF en formularios sensibles o usar SameSite cookies
5. **CSP headers** — Content-Security-Policy para mitigar XSS
6. **Paginación** — Agregar LIMIT/OFFSET en endpoints de listados (comidas, citas, historial)
7. **Accesibilidad** — Agregar roles ARIA, skip links, textos alternativos en iconos
8. **Respaldo automático** — Tarea de mysqldump programada (o volumen Docker adicional)

### Bajas
9. **Pruebas cross-browser** — Verificar en Firefox y Safari
10. **Pruebas mobile** — Probar en Android/iOS real
11. **Lector de pantalla** — Probar con NVDA o VoiceOver
