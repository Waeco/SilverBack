import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI, HTTPException, Query, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from configuracion_bd import obtener_conexion
import re
import uuid
from urllib.parse import urlparse

app = FastAPI(title="SilverBack API - FastAPI (Ejercicios y Rutinas)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Carpeta compartida con servidor.py (mismo volumen de proyecto), que la sirve
# como estática bajo /uploads/rutinas/<archivo>.
RUTA_UPLOADS_RUTINAS = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads', 'rutinas')
os.makedirs(RUTA_UPLOADS_RUTINAS, exist_ok=True)
EXTENSIONES_VIDEO_PERMITIDAS = {'.mp4', '.mov', '.webm', '.ogg', '.avi', '.mkv'}
TAMANO_MAXIMO_VIDEO = 100 * 1024 * 1024  # 100 MB
EXTENSIONES_IMAGEN_PERMITIDAS = {'.jpg', '.jpeg', '.png', '.gif', '.webp'}
TAMANO_MAXIMO_IMAGEN = 5 * 1024 * 1024  # 5 MB
PREFIJO_PUBLICO_RUTINAS = '/uploads/rutinas/'
ROLES_GESTION_MULTIMEDIA = ('nutriologo', 'admin')
TAMANO_BLOQUE_LECTURA = 1024 * 1024  # 1 MB

# --- Esquemas Pydantic ---

class EjercicioOut(BaseModel):
    id: int
    wger_id: Optional[int] = None
    nombre: str
    descripcion: Optional[str] = None
    imagen_url: Optional[str] = None
    video_url: Optional[str] = None

class EjercicioAsignado(BaseModel):
    ejercicio_id: int
    nombre_ejercicio: str
    descripcion: Optional[str] = None
    series: int = Field(gt=0)
    repeticiones: str = "10"
    descanso: str = "60 seg"
    imagen_url: Optional[str] = None
    video_url: Optional[str] = None
    orden: int = 0
    dia_semana: Optional[str] = "Todos los días"
    equipo: Optional[str] = None
    progresion_peso: Optional[str] = None

class CrearRutinaSchema(BaseModel):
    id_paciente: int
    id_asignador: Optional[int] = None
    rol_asignador: Optional[str] = None
    nombre_rutina: Optional[str] = None
    ejercicios: List[EjercicioAsignado]

class RutinaOut(BaseModel):
    id_plan_rutina: int
    id_paciente: int
    id_nutriologo: Optional[int] = None
    nombre_rutina: Optional[str] = None
    activo: bool
    fecha_asignado: str
    detalles: list

# --- Endpoints ---

@app.get("/api/ejercicios/buscar", response_model=List[EjercicioOut])
async def buscar_ejercicios(q: str = Query(min_length=3)):
    conn = obtener_conexion()
    if not conn:
        raise HTTPException(status_code=500, detail="Error de conexión a BD")
    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            "SELECT id, wger_id, nombre, descripcion, imagen_url, video_url "
            "FROM ejercicios WHERE nombre LIKE %s ORDER BY nombre LIMIT 30",
            (f"%{q}%",)
        )
        resultados = cursor.fetchall()
        return resultados
    finally:
        cursor.close()
        conn.close()


# --- Multimedia de ejercicios (imágenes/videos que sube el nutriólogo) ---

_RE_YOUTUBE = re.compile(
    r'(?:youtube\.com/(?:watch\?(?:[^#]*&)?v=|shorts/|embed/|live/)|youtu\.be/)([A-Za-z0-9_-]{11})'
)


def _extension_imagen_real(cabecera: bytes) -> Optional[str]:
    """Detecta el tipo REAL de imagen por sus primeros bytes (no confiamos en la extensión)."""
    if cabecera.startswith(b'\xff\xd8\xff'):
        return '.jpg'
    if cabecera.startswith(b'\x89PNG\r\n\x1a\n'):
        return '.png'
    if cabecera.startswith((b'GIF87a', b'GIF89a')):
        return '.gif'
    if cabecera[:4] == b'RIFF' and cabecera[8:12] == b'WEBP':
        return '.webp'
    return None


def _borrar_archivo_local(url: Optional[str]):
    """Borra un archivo de uploads/rutinas. Solo actúa sobre URLs locales y usa únicamente
    el nombre del archivo, así que no puede salirse de la carpeta."""
    if not url or not url.startswith(PREFIJO_PUBLICO_RUTINAS):
        return
    ruta = os.path.join(RUTA_UPLOADS_RUTINAS, os.path.basename(url))
    try:
        if os.path.isfile(ruta):
            os.remove(ruta)
    except OSError as e:
        print(f"[Multimedia] No se pudo borrar {ruta}: {e}")


def _url_sigue_en_uso(cursor, url: str) -> bool:
    """True si algún ejercicio o rutina asignada todavía apunta a esa URL."""
    cursor.execute(
        "SELECT (SELECT COUNT(*) FROM ejercicios WHERE imagen_url=%s OR video_url=%s) + "
        "(SELECT COUNT(*) FROM detalles_rutina WHERE imagen_url=%s OR video_url=%s) AS n",
        (url, url, url, url)
    )
    fila = cursor.fetchone()
    return bool(fila and fila['n'])


def _exigir_permiso_multimedia(cursor, id_usuario: int):
    cursor.execute("SELECT rol, activo FROM usuarios WHERE id_usuario=%s", (id_usuario,))
    usuario = cursor.fetchone()
    if not usuario or not usuario['activo'] or usuario['rol'] not in ROLES_GESTION_MULTIMEDIA:
        raise HTTPException(status_code=403, detail="Solo los nutriólogos pueden gestionar el multimedia de los ejercicios.")


async def _guardar_archivo_subido(archivo: UploadFile, es_imagen: bool) -> str:
    """Guarda el archivo en uploads/rutinas leyendo por bloques (sin cargarlo completo en memoria).
    Devuelve la URL pública relativa (/uploads/rutinas/<uuid>.<ext>)."""
    extension_original = os.path.splitext(archivo.filename or "")[1].lower()
    validas = EXTENSIONES_IMAGEN_PERMITIDAS if es_imagen else EXTENSIONES_VIDEO_PERMITIDAS
    limite = TAMANO_MAXIMO_IMAGEN if es_imagen else TAMANO_MAXIMO_VIDEO
    nombre_tipo = "imagen" if es_imagen else "video"

    if extension_original not in validas:
        raise HTTPException(
            status_code=400,
            detail=f"Formato de {nombre_tipo} no permitido. Usa: {', '.join(sorted(validas))}"
        )

    primer_bloque = await archivo.read(TAMANO_BLOQUE_LECTURA)
    if not primer_bloque:
        raise HTTPException(status_code=400, detail=f"El archivo de {nombre_tipo} está vacío.")

    extension = extension_original
    if es_imagen:
        extension = _extension_imagen_real(primer_bloque)
        if not extension:
            raise HTTPException(status_code=400, detail="El archivo no es una imagen válida (JPG, PNG, GIF o WEBP).")

    nombre_archivo = f"{uuid.uuid4().hex}{extension}"
    ruta_completa = os.path.join(RUTA_UPLOADS_RUTINAS, nombre_archivo)
    total = 0
    try:
        with open(ruta_completa, "wb") as f:
            bloque = primer_bloque
            while bloque:
                total += len(bloque)
                if total > limite:
                    raise HTTPException(
                        status_code=400,
                        detail=f"El {nombre_tipo} no debe superar los {limite // (1024 * 1024)} MB."
                    )
                f.write(bloque)
                bloque = await archivo.read(TAMANO_BLOQUE_LECTURA)
    except HTTPException:
        _borrar_archivo_local(f"{PREFIJO_PUBLICO_RUTINAS}{nombre_archivo}")
        raise
    except Exception as e:
        _borrar_archivo_local(f"{PREFIJO_PUBLICO_RUTINAS}{nombre_archivo}")
        raise HTTPException(status_code=500, detail=f"Error al guardar el {nombre_tipo}: {str(e)}")

    return f"{PREFIJO_PUBLICO_RUTINAS}{nombre_archivo}"


def _normalizar_url_imagen(url: str) -> str:
    url = url.strip()
    partes = urlparse(url)
    if partes.scheme not in ('http', 'https') or not partes.netloc:
        raise HTTPException(status_code=400, detail="El enlace de la imagen debe empezar con http:// o https://")
    if len(url) > 500:
        raise HTTPException(status_code=400, detail="El enlace de la imagen es demasiado largo (máx. 500 caracteres).")
    return url


def _normalizar_url_video(url: str) -> str:
    url = url.strip()
    partes = urlparse(url)
    if partes.scheme not in ('http', 'https') or not partes.netloc:
        raise HTTPException(status_code=400, detail="El enlace del video debe empezar con http:// o https://")
    if len(url) > 500:
        raise HTTPException(status_code=400, detail="El enlace del video es demasiado largo (máx. 500 caracteres).")
    host = (partes.hostname or '').lower()
    if host in ('youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'):
        coincidencia = _RE_YOUTUBE.search(url)
        if not coincidencia:
            raise HTTPException(status_code=400, detail="No se pudo reconocer el enlace de YouTube.")
        # Forma canónica: es la que sabe convertir a embed el reproductor del frontend.
        return f"https://www.youtube.com/watch?v={coincidencia.group(1)}"
    if os.path.splitext(partes.path)[1].lower() in EXTENSIONES_VIDEO_PERMITIDAS:
        return url
    raise HTTPException(
        status_code=400,
        detail="Solo se aceptan enlaces de YouTube o enlaces directos a un archivo de video (.mp4, .webm, ...)."
    )


_SQL_SIN_VIDEO = "(video_url IS NULL OR video_url = '')"
_SQL_SIN_IMAGEN = "(imagen_url IS NULL OR imagen_url = '')"


@app.get("/api/ejercicios/multimedia")
async def listar_multimedia_ejercicios(
    q: Optional[str] = Query(default=None, max_length=100),
    estado: str = Query(default="todos", pattern="^(todos|pendientes|sin_video|sin_imagen|completos)$"),
    limite: int = Query(default=24, ge=1, le=100),
    pagina: int = Query(default=1, ge=1),
):
    """Catálogo de ejercicios para el apartado de multimedia. Permite filtrar los que
    no tienen imagen y/o video. Los contadores del resumen respetan la búsqueda `q`."""
    conn = obtener_conexion()
    if not conn:
        raise HTTPException(status_code=500, detail="Error de conexión a BD")
    cursor = conn.cursor(dictionary=True)
    try:
        condiciones_busqueda = ""
        params_busqueda = []
        if q and q.strip():
            patron = "%" + q.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"
            condiciones_busqueda = "WHERE nombre LIKE %s"
            params_busqueda.append(patron)

        cursor.execute(
            f"SELECT COUNT(*) AS total, "
            f"COALESCE(SUM(CASE WHEN {_SQL_SIN_VIDEO} THEN 1 ELSE 0 END), 0) AS sin_video, "
            f"COALESCE(SUM(CASE WHEN {_SQL_SIN_IMAGEN} THEN 1 ELSE 0 END), 0) AS sin_imagen, "
            f"COALESCE(SUM(CASE WHEN {_SQL_SIN_VIDEO} OR {_SQL_SIN_IMAGEN} THEN 1 ELSE 0 END), 0) AS pendientes "
            f"FROM ejercicios {condiciones_busqueda}",
            params_busqueda
        )
        fila = cursor.fetchone() or {}
        resumen = {
            "total": int(fila.get("total") or 0),
            "sin_video": int(fila.get("sin_video") or 0),
            "sin_imagen": int(fila.get("sin_imagen") or 0),
            "pendientes": int(fila.get("pendientes") or 0),
        }
        resumen["completos"] = resumen["total"] - resumen["pendientes"]

        filtros_estado = {
            "pendientes": f"({_SQL_SIN_VIDEO} OR {_SQL_SIN_IMAGEN})",
            "sin_video": _SQL_SIN_VIDEO,
            "sin_imagen": _SQL_SIN_IMAGEN,
            "completos": f"(NOT {_SQL_SIN_VIDEO} AND NOT {_SQL_SIN_IMAGEN})",
        }
        condiciones = []
        if condiciones_busqueda:
            condiciones.append("nombre LIKE %s")
        if estado in filtros_estado:
            condiciones.append(filtros_estado[estado])
        donde = ("WHERE " + " AND ".join(condiciones)) if condiciones else ""
        total_filtrado = resumen["total"] if estado == "todos" else resumen[estado]

        cursor.execute(
            f"SELECT id, wger_id, nombre, LEFT(descripcion, 200) AS descripcion, imagen_url, video_url "
            f"FROM ejercicios {donde} ORDER BY nombre ASC LIMIT %s OFFSET %s",
            params_busqueda + [limite, (pagina - 1) * limite]
        )
        items = cursor.fetchall()
        return {
            "items": items,
            "total": total_filtrado,
            "pagina": pagina,
            "limite": limite,
            "resumen": resumen,
        }
    finally:
        cursor.close()
        conn.close()


@app.get("/api/ejercicios/{id}", response_model=EjercicioOut)
async def obtener_ejercicio(id: int):
    conn = obtener_conexion()
    if not conn:
        raise HTTPException(status_code=500, detail="Error de conexión a BD")
    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            "SELECT id, wger_id, nombre, descripcion, imagen_url, video_url "
            "FROM ejercicios WHERE id = %s", (id,)
        )
        resultado = cursor.fetchone()
        if not resultado:
            raise HTTPException(status_code=404, detail="Ejercicio no encontrado")
        return resultado
    finally:
        cursor.close()
        conn.close()


@app.post("/api/rutinas", status_code=201)
async def crear_rutina(datos: CrearRutinaSchema):
    if len(datos.ejercicios) > 10:
        raise HTTPException(status_code=400, detail="La rutina no puede tener más de 10 ejercicios.")
    if len(datos.ejercicios) == 0:
        raise HTTPException(status_code=400, detail="La rutina debe tener al menos 1 ejercicio.")

    conn = obtener_conexion()
    if not conn:
        raise HTTPException(status_code=500, detail="Error de conexión a BD")
    try:
        cursor = conn.cursor(dictionary=True)

        cursor.execute(
            "UPDATE planes_rutina SET activo=0 WHERE id_paciente=%s AND activo=1",
            (datos.id_paciente,)
        )

        if datos.rol_asignador == 'nutriologo':
            cursor.execute(
                "INSERT INTO planes_rutina (id_paciente, id_nutriologo, nombre_rutina, activo) "
                "VALUES (%s, %s, %s, 1)",
                (datos.id_paciente, datos.id_asignador, datos.nombre_rutina)
            )
        else:
            cursor.execute(
                "INSERT INTO planes_rutina (id_paciente, nombre_rutina, activo) "
                "VALUES (%s, %s, 1)",
                (datos.id_paciente, datos.nombre_rutina)
            )

        id_plan = cursor.lastrowid

        for ej in datos.ejercicios:
            cursor.execute(
                "INSERT INTO detalles_rutina (id_plan_rutina, id_ejercicio, nombre_ejercicio, "
                "descripcion, series, repeticiones, descanso, imagen_url, video_url, orden, "
                "dia_semana, equipo, progresion_peso) "
                "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)",
                (id_plan, ej.ejercicio_id, ej.nombre_ejercicio, ej.descripcion,
                 ej.series, ej.repeticiones, ej.descanso,
                 ej.imagen_url, ej.video_url, ej.orden,
                 ej.dia_semana, ej.equipo, ej.progresion_peso)
            )

        conn.commit()
        return {"status": "success", "id_plan_rutina": id_plan}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()


@app.get("/api/rutinas/paciente/{id_paciente}")
async def obtener_rutina_paciente(id_paciente: int):
    conn = obtener_conexion()
    if not conn:
        raise HTTPException(status_code=500, detail="Error de conexión a BD")
    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            "SELECT * FROM planes_rutina WHERE id_paciente=%s AND activo=1 LIMIT 1",
            (id_paciente,)
        )
        rutina = cursor.fetchone()
        if not rutina:
            return {"rutina": None, "detalles": []}

        cursor.execute(
            "SELECT * FROM detalles_rutina WHERE id_plan_rutina=%s ORDER BY orden",
            (rutina['id_plan_rutina'],)
        )
        detalles = cursor.fetchall()
        return {"rutina": rutina, "detalles": detalles}
    finally:
        cursor.close()
        conn.close()


@app.delete("/api/rutinas/{id_plan}")
async def desactivar_rutina(id_plan: int):
    conn = obtener_conexion()
    if not conn:
        raise HTTPException(status_code=500, detail="Error de conexión a BD")
    try:
        cursor = conn.cursor()
        cursor.execute("UPDATE planes_rutina SET activo=0 WHERE id_plan_rutina=%s", (id_plan,))
        conn.commit()
        return {"status": "success", "message": "Rutina desactivada"}
    finally:
        cursor.close()
        conn.close()


# --- Esquemas Historial Médico ---

class HistorialEntry(BaseModel):
    id_paciente: int
    id_nutriologo: Optional[int] = None
    tipo: str = Field(pattern=r'^(peso|altura|enfermedad|alergia|nota)$')
    valor: Optional[str] = None
    descripcion: Optional[str] = None
    fecha: str = Field(default_factory=lambda: __import__('datetime').date.today().isoformat())


class HistorialUpdate(BaseModel):
    tipo: Optional[str] = Field(default=None, pattern=r'^(peso|altura|enfermedad|alergia|nota)$')
    valor: Optional[str] = None
    descripcion: Optional[str] = None
    fecha: Optional[str] = None


class HistorialCompleto(BaseModel):
    id_paciente: int
    id_nutriologo: Optional[int] = None
    fecha: str = Field(default_factory=lambda: __import__('datetime').date.today().isoformat())
    peso: Optional[str] = None
    altura: Optional[str] = None
    enfermedades: Optional[str] = None
    alergias: Optional[str] = None
    notas: Optional[str] = None


# --- Endpoints Historial Médico ---

@app.get("/api/historial/{id_paciente}")
async def obtener_historial(id_paciente: int):
    conn = obtener_conexion()
    if not conn:
        raise HTTPException(status_code=500, detail="Error de conexión a BD")
    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            "SELECT hm.*, u.nombre_completo as nutriologo_nombre "
            "FROM historial_medico hm "
            "LEFT JOIN nutriologos_perfil np ON hm.id_nutriologo = np.id_nutriologo "
            "LEFT JOIN usuarios u ON np.id_usuario = u.id_usuario "
            "WHERE hm.id_paciente = %s ORDER BY hm.fecha DESC, hm.creado_en DESC",
            (id_paciente,)
        )
        return cursor.fetchall()
    finally:
        cursor.close()
        conn.close()


@app.post("/api/historial", status_code=201)
async def crear_historial(entry: HistorialEntry):
    conn = obtener_conexion()
    if not conn:
        raise HTTPException(status_code=500, detail="Error de conexión a BD")
    try:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO historial_medico (id_paciente, id_nutriologo, tipo, valor, descripcion, fecha) "
            "VALUES (%s, %s, %s, %s, %s, %s)",
            (entry.id_paciente, entry.id_nutriologo, entry.tipo, entry.valor, entry.descripcion, entry.fecha)
        )
        conn.commit()
        return {"status": "success", "id": cursor.lastrowid}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()


@app.post("/api/historial/completo", status_code=201)
async def crear_historial_completo(entry: HistorialCompleto):
    conn = obtener_conexion()
    if not conn:
        raise HTTPException(status_code=500, detail="Error de conexión a BD")
    try:
        cursor = conn.cursor()
        insertados = 0
        inserts = []
        if entry.peso:
            inserts.append(('peso', entry.peso, None))
        if entry.altura:
            inserts.append(('altura', entry.altura, None))
        if entry.enfermedades:
            inserts.append(('enfermedad', None, entry.enfermedades))
        if entry.alergias:
            inserts.append(('alergia', None, entry.alergias))
        if entry.notas:
            inserts.append(('nota', None, entry.notas))

        if not inserts:
            raise HTTPException(status_code=400, detail="Debes proporcionar al menos un campo.")

        for tipo, valor, desc in inserts:
            cursor.execute(
                "INSERT INTO historial_medico (id_paciente, id_nutriologo, tipo, valor, descripcion, fecha) "
                "VALUES (%s, %s, %s, %s, %s, %s)",
                (entry.id_paciente, entry.id_nutriologo, tipo, valor, desc, entry.fecha)
            )
            insertados += 1

        conn.commit()
        return {"status": "success", "insertados": insertados}
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()


@app.put("/api/historial/{id}")
async def actualizar_historial(id: int, entry: HistorialUpdate):
    conn = obtener_conexion()
    if not conn:
        raise HTTPException(status_code=500, detail="Error de conexión a BD")
    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT id FROM historial_medico WHERE id=%s", (id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Registro no encontrado")

        campos = {}
        if entry.tipo is not None:
            campos['tipo'] = entry.tipo
        if entry.valor is not None:
            campos['valor'] = entry.valor
        if entry.descripcion is not None:
            campos['descripcion'] = entry.descripcion
        if entry.fecha is not None:
            campos['fecha'] = entry.fecha

        if not campos:
            return {"status": "success", "message": "Sin cambios"}

        set_clause = ", ".join(f"{k}=%s" for k in campos)
        valores = list(campos.values()) + [id]
        cursor.execute(f"UPDATE historial_medico SET {set_clause} WHERE id=%s", valores)
        conn.commit()
        return {"status": "success", "message": "Registro actualizado"}
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()


@app.delete("/api/historial/{id}")
async def eliminar_historial(id: int):
    conn = obtener_conexion()
    if not conn:
        raise HTTPException(status_code=500, detail="Error de conexión a BD")
    try:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM historial_medico WHERE id=%s", (id,))
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Registro no encontrado")
        conn.commit()
        return {"status": "success", "message": "Registro eliminado"}
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()


# --- Solicitudes Nutriólogo ---

class SolicitudSchema(BaseModel):
    id_paciente: int
    id_nutriologo: int


@app.post("/api/solicitudes", status_code=201)
async def enviar_solicitud(sol: SolicitudSchema):
    conn = obtener_conexion()
    if not conn:
        raise HTTPException(status_code=500, detail="Error de conexión a BD")
    try:
        cursor = conn.cursor(dictionary=True)

        cursor.execute(
            "SELECT id_nutriologo_asignado FROM pacientes_perfil WHERE id_paciente=%s",
            (sol.id_paciente,)
        )
        perfil = cursor.fetchone()
        if perfil and perfil['id_nutriologo_asignado']:
            raise HTTPException(status_code=400, detail="Ya tienes un nutriólogo asignado.")

        cursor.execute(
            "SELECT id FROM solicitudes_nutriologo "
            "WHERE id_paciente=%s AND id_nutriologo=%s AND estado='pendiente'",
            (sol.id_paciente, sol.id_nutriologo)
        )
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail="Ya enviaste una solicitud a este nutriólogo.")

        cursor.execute(
            "INSERT INTO solicitudes_nutriologo (id_paciente, id_nutriologo) VALUES (%s, %s)",
            (sol.id_paciente, sol.id_nutriologo)
        )
        conn.commit()
        return {"status": "success", "message": "Solicitud enviada correctamente."}
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()


@app.get("/api/solicitudes/pendientes-count")
async def solicitudes_pendientes_count(id_usuario: int = Query(...)):
    """Conteo rápido de solicitudes pendientes de un nutriólogo, a partir de su
    id_usuario (para mostrar el badge de notificación en la barra de navegación
    sin que el frontend tenga que conocer el id_nutriologo de antemano)."""
    conn = obtener_conexion()
    if not conn:
        raise HTTPException(status_code=500, detail="Error de conexión a BD")
    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            "SELECT COUNT(*) AS total FROM solicitudes_nutriologo sn "
            "JOIN nutriologos_perfil np ON np.id_nutriologo = sn.id_nutriologo "
            "WHERE np.id_usuario = %s AND sn.estado = 'pendiente'",
            (id_usuario,)
        )
        fila = cursor.fetchone()
        return {"total": fila['total'] if fila else 0}
    finally:
        cursor.close()
        conn.close()


@app.get("/api/solicitudes/pendientes/{id_nutriologo}")
async def solicitudes_pendientes(id_nutriologo: int):
    conn = obtener_conexion()
    if not conn:
        raise HTTPException(status_code=500, detail="Error de conexión a BD")
    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            "SELECT sn.*, u.nombre_completo, u.correo, pp.peso_actual, pp.altura, pp.deporte, pp.objetivo "
            "FROM solicitudes_nutriologo sn "
            "JOIN pacientes_perfil pp ON sn.id_paciente = pp.id_paciente "
            "JOIN usuarios u ON pp.id_usuario = u.id_usuario "
            "WHERE sn.id_nutriologo=%s AND sn.estado='pendiente' "
            "ORDER BY sn.creado_en DESC",
            (id_nutriologo,)
        )
        return cursor.fetchall()
    finally:
        cursor.close()
        conn.close()


@app.put("/api/solicitudes/{id_solicitud}/aceptar")
async def aceptar_solicitud(id_solicitud: int):
    conn = obtener_conexion()
    if not conn:
        raise HTTPException(status_code=500, detail="Error de conexión a BD")
    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            "SELECT sn.* FROM solicitudes_nutriologo sn WHERE sn.id=%s AND sn.estado='pendiente'",
            (id_solicitud,)
        )
        sol = cursor.fetchone()
        if not sol:
            raise HTTPException(status_code=404, detail="Solicitud no encontrada o ya procesada.")

        cursor.execute(
            "UPDATE pacientes_perfil SET id_nutriologo_asignado=%s WHERE id_paciente=%s",
            (sol['id_nutriologo'], sol['id_paciente'])
        )
        cursor.execute(
            "UPDATE solicitudes_nutriologo SET estado='aceptada' WHERE id=%s",
            (id_solicitud,)
        )
        conn.commit()
        return {"status": "success", "message": "Paciente asignado correctamente."}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()


@app.put("/api/solicitudes/{id_solicitud}/rechazar")
async def rechazar_solicitud(id_solicitud: int):
    conn = obtener_conexion()
    if not conn:
        raise HTTPException(status_code=500, detail="Error de conexión a BD")
    try:
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE solicitudes_nutriologo SET estado='rechazada' WHERE id=%s AND estado='pendiente'",
            (id_solicitud,)
        )
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Solicitud no encontrada o ya procesada.")
        conn.commit()
        return {"status": "success", "message": "Solicitud rechazada."}
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()


@app.delete("/api/paciente/{id_paciente}/nutriologo")
async def quitar_nutriologo(id_paciente: int):
    conn = obtener_conexion()
    if not conn:
        raise HTTPException(status_code=500, detail="Error de conexión a BD")
    try:
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE pacientes_perfil SET id_nutriologo_asignado=NULL WHERE id_paciente=%s",
            (id_paciente,)
        )
        conn.commit()
        return {"status": "success", "message": "Nutriólogo removido correctamente."}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()


@app.post("/api/ejercicios/{id}/multimedia")
async def guardar_multimedia_ejercicio(
    id: int,
    id_usuario: int = Form(...),
    imagen: Optional[UploadFile] = File(default=None),
    video: Optional[UploadFile] = File(default=None),
    imagen_externa: Optional[str] = Form(default=None),
    video_externo: Optional[str] = Form(default=None),
):
    """Sube (o enlaza) la imagen y/o el video de un ejercicio del catálogo.
    Se guarda en el catálogo, así que queda disponible para todas las rutinas futuras;
    además se completa en las rutinas ya asignadas que tenían ese campo vacío."""
    hay_imagen_archivo = bool(imagen and imagen.filename)
    hay_video_archivo = bool(video and video.filename)
    imagen_externa = (imagen_externa or "").strip()
    video_externo = (video_externo or "").strip()

    if not (hay_imagen_archivo or hay_video_archivo or imagen_externa or video_externo):
        raise HTTPException(status_code=400, detail="No se envió ninguna imagen ni video.")
    if hay_imagen_archivo and imagen_externa:
        raise HTTPException(status_code=400, detail="Para la imagen elige un archivo o un enlace, no ambos.")
    if hay_video_archivo and video_externo:
        raise HTTPException(status_code=400, detail="Para el video elige un archivo o un enlace, no ambos.")

    nueva_imagen = _normalizar_url_imagen(imagen_externa) if imagen_externa else None
    nuevo_video = _normalizar_url_video(video_externo) if video_externo else None

    conn = obtener_conexion()
    if not conn:
        raise HTTPException(status_code=500, detail="Error de conexión a BD")
    cursor = conn.cursor(dictionary=True)
    archivos_nuevos = []
    try:
        _exigir_permiso_multimedia(cursor, id_usuario)

        cursor.execute("SELECT id, nombre, imagen_url, video_url FROM ejercicios WHERE id=%s", (id,))
        ejercicio = cursor.fetchone()
        if not ejercicio:
            raise HTTPException(status_code=404, detail="Ejercicio no encontrado")

        if hay_imagen_archivo:
            nueva_imagen = await _guardar_archivo_subido(imagen, es_imagen=True)
            archivos_nuevos.append(nueva_imagen)
        if hay_video_archivo:
            nuevo_video = await _guardar_archivo_subido(video, es_imagen=False)
            archivos_nuevos.append(nuevo_video)

        resultado = {"imagen_url": ejercicio["imagen_url"], "video_url": ejercicio["video_url"]}
        reemplazadas = []
        # `campo` sale de esta tupla fija (nunca del usuario), por eso es seguro interpolarlo.
        for campo, nueva in (("imagen_url", nueva_imagen), ("video_url", nuevo_video)):
            if not nueva:
                continue
            anterior = ejercicio[campo] or ""
            cursor.execute(f"UPDATE ejercicios SET {campo}=%s WHERE id=%s", (nueva, id))
            cursor.execute(
                f"UPDATE detalles_rutina SET {campo}=%s "
                f"WHERE id_ejercicio=%s AND nombre_ejercicio=%s "
                f"AND ({campo} IS NULL OR {campo}='' OR {campo}=%s)",
                (nueva, id, ejercicio["nombre"], anterior)
            )
            resultado[campo] = nueva
            if anterior and anterior != nueva:
                reemplazadas.append(anterior)
        conn.commit()

        for anterior in reemplazadas:
            if not _url_sigue_en_uso(cursor, anterior):
                _borrar_archivo_local(anterior)

        return {
            "status": "success",
            "id": id,
            "nombre": ejercicio["nombre"],
            "imagen_url": resultado["imagen_url"],
            "video_url": resultado["video_url"],
        }
    except HTTPException:
        conn.rollback()
        for url in archivos_nuevos:
            _borrar_archivo_local(url)
        raise
    except Exception as e:
        conn.rollback()
        for url in archivos_nuevos:
            _borrar_archivo_local(url)
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()


@app.delete("/api/ejercicios/{id}/multimedia/{tipo}")
async def eliminar_multimedia_ejercicio(
    id: int,
    tipo: Literal["imagen", "video"],
    id_usuario: int = Query(...),
):
    """Quita la imagen o el video de un ejercicio (y de sus rutinas asignadas)."""
    campo = "imagen_url" if tipo == "imagen" else "video_url"
    conn = obtener_conexion()
    if not conn:
        raise HTTPException(status_code=500, detail="Error de conexión a BD")
    cursor = conn.cursor(dictionary=True)
    try:
        _exigir_permiso_multimedia(cursor, id_usuario)

        cursor.execute("SELECT id, nombre, imagen_url, video_url FROM ejercicios WHERE id=%s", (id,))
        ejercicio = cursor.fetchone()
        if not ejercicio:
            raise HTTPException(status_code=404, detail="Ejercicio no encontrado")

        anterior = ejercicio[campo] or ""
        if anterior:
            cursor.execute(f"UPDATE ejercicios SET {campo}=NULL WHERE id=%s", (id,))
            cursor.execute(
                f"UPDATE detalles_rutina SET {campo}='' "
                f"WHERE id_ejercicio=%s AND nombre_ejercicio=%s AND {campo}=%s",
                (id, ejercicio["nombre"], anterior)
            )
            conn.commit()
            if not _url_sigue_en_uso(cursor, anterior):
                _borrar_archivo_local(anterior)

        return {
            "status": "success",
            "id": id,
            "imagen_url": None if campo == "imagen_url" else ejercicio["imagen_url"],
            "video_url": None if campo == "video_url" else ejercicio["video_url"],
        }
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()
