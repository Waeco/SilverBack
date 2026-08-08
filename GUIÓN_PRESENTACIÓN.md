# Guión de Presentación — SilverBack

**Duración:** 5 minutos  
**Participantes:** 5 personas  
**Formato:** Introducción → Desarrollo → Conclusiones

---

## INTRODUCCIÓN (1 min) — Persona 1

*Hola a todos. Vamos a presentarles **SilverBack**, una plataforma de nutrición deportiva que conecta atletas con nutriólogos.*

El problema que detectamos es que los atletas no tienen una herramienta centralizada para registrar su alimentación, seguir una dieta asignada por un especialista, y dar seguimiento a su rendimiento. Todo se hace por separado: WhatsApp, hojas de cálculo, papel.

SilverBack resuelve esto con una aplicación web donde:

- El **atleta** registra sus comidas diarias, ve su plan de dieta y rutina de ejercicios, agenda citas con su nutriólogo, y lleva un historial médico.
- El **nutriólogo** asigna planes de dieta y rutinas, acepta o rechaza solicitudes de pacientes, y edita el historial médico de cada uno.
- El **admin** gestiona usuarios y ve estadísticas del sistema.

La aplicación está construida con **Python en el backend** (servidor HTTP nativo + FastAPI), **React con Vite en el frontend**, **MySQL como base de datos**, y se conecta a **APIs reales de nutrición y ejercicio** como FatSecret y Wger.

*Les paso con mi compañero para que les cuente cómo funciona el backend.*

---

## DESARROLLO (3 min)

### Backend — Persona 2 (1 min)

*Gracias. Yo les voy a contar cómo está construido el backend.*

Tenemos **dos servidores**. El principal corre en el puerto 8000 con Python nativo — sin frameworks pesados, diseñado así para mantenerlo ligero y rápido. Implementa toda la lógica de negocio: autenticación, CRUD de comidas, citas, usuarios, dieta y rutinas.

El segundo servidor corre en el puerto 8001 con **FastAPI** y se encarga de ejercicios, rutinas, historial médico y solicitudes a nutriólogos.

En cuanto a **seguridad**, implementamos:

- **Token de sesión**: el login genera un token para el navegador; bloqueo de cuenta tras 5 intentos fallidos en `login` (15 minutos).
- **Control de roles por endpoint**: solo admin puede ver estadísticas, solo nutriólogo puede asignar dietas.
- **reCAPTCHA v2**: protege los formularios públicos (login y registro) contra bots.
- **Headers de seguridad**: X-Frame-Options, X-Content-Type-Options, X-XSS-Protection, Referrer-Policy.

Para la **base de datos**, usamos MySQL con consultas parametrizadas para prevenir inyección SQL. El esquema tiene 16 tablas normalizadas con claves foráneas y relaciones bien definidas, y un seed idempotente que no duplica datos al reiniciar.

*Les paso con mi compañera para que vean el frontend.*

### Frontend — Persona 3 (1 min)

*Gracias. Yo trabajé en el frontend con **React 18 + Vite + TailwindCSS**.*

La interfaz es **completamente responsiva** — funciona en escritorio, tablet y móvil. Tiene un tema oscuro unificado y animaciones suaves con Framer Motion.

Implementamos **code splitting** con React.lazy(), lo que redujo el bundle principal de 618KB a 356KB. Cada página carga solo cuando el usuario la necesita, haciendo la aplicación más rápida.

Entre los componentes más importantes:

- **Barra de navegación** que se adapta según el rol del usuario autenticado.
- **Validador de contraseña en tiempo real**: un popup animado que muestra los requisitos mientras el usuario escribe.
- **Calendario interactivo** para visualizar y crear citas.
- **Modal de búsqueda de alimentos** conectado a FatSecret en tiempo real.

La experiencia de usuario está pensada para ser intuitiva: mensajes de error claros en español, confirmaciones con SweetAlert2, y formularios con validación tanto en frontend como en backend.

*Mi compañero les va a mostrar las funcionalidades clave.*

### Funcionalidades Clave — Persona 4 (1 min)

*Gracias. Les voy a mostrar lo que hace único a SilverBack.*

**Para el atleta:**
- Registro diario de comidas con búsqueda en FatSecret (base de datos real de alimentos).
- Visualización de plan de dieta y rutina asignados por su nutriólogo.
- Catálogo de nutriólogos con búsqueda y solicitud de asignación.
- Historial médico completo con resumen visual de peso, altura y alergias.
- Calendario de citas y chat directo con su nutriólogo.

**Para el nutriólogo:**
- Panel con sus pacientes asignados y solicitudes pendientes.
- Asignación de dietas con búsqueda de alimentos en FatSecret.
- Asignación de rutinas con ejercicios del mirror local de Wger (846 ejercicios en español).
- Capacidad de editar el historial médico de cada paciente.
- Creación de citas desde el calendario y chat con sus pacientes.

**Para el admin:**
- Estadísticas del sistema: usuarios, citas, actividad.
- CRUD completo de usuarios con activación/desactivación.

Una característica importante es que todo el flujo de **recuperación de contraseña** es funcional: el usuario recibe un correo con un enlace único que expira en 1 hora, y puede restablecer su contraseña desde una página dedicada con validación en tiempo real.

*Para cerrar, mi compañero les dará las conclusiones.*

---

## CONCLUSIONES (1 min) — Persona 5

*Gracias. Para cerrar, estos son los logros más importantes del proyecto:*

**Lo que logramos:**
- Una plataforma funcional de principio a fin con 3 roles bien definidos.
- Token de sesión, bloqueo por intentos fallidos, control de permisos y reCAPTCHA.
- Integración con APIs reales de nutrición y ejercicio (FatSecret + Wger).
- Recuperación de contraseña y verificación de correo electrónico funcionales.
- Código modular, bien estructurado, con nombres en español.

**Mejoras de seguridad implementadas:**
- Headers de seguridad en todas las respuestas.
- Protección contra inyección SQL en toda la base de datos.
- Bloqueo por intentos fallidos de inicio de sesión.
- reCAPTCHA v2 en formularios públicos.

**Pendientes para futuro:**
- Migrar a JWT real con verificación por endpoint.
- Agregar HTTPS con certificados SSL.
- Implementar pruebas automatizadas (unitarias y de integración).

En resumen, SilverBack es una plataforma completa, segura y lista para usar que resuelve un problema real en el ámbito de la nutrición deportiva.

*Muchas gracias por su atención. ¿Preguntas?*
