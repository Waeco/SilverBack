import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional
from configuracion_bd import obtener_conexion

app = FastAPI(title="SilverBack API - FastAPI (Ejercicios y Rutinas)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

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
            "FROM ejercicios WHERE nombre LIKE %s ORDER BY nombre LIMIT 20",
            (f"%{q}%",)
        )
        resultados = cursor.fetchall()
        return resultados
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
                "descripcion, series, repeticiones, descanso, imagen_url, video_url, orden) "
                "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)",
                (id_plan, ej.ejercicio_id, ej.nombre_ejercicio, ej.descripcion,
                 ej.series, ej.repeticiones, ej.descanso,
                 ej.imagen_url, ej.video_url, ej.orden)
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
