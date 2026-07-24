import json
import os
import sys
import time
import datetime
import secrets
import requests
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from configuracion_bd import obtener_conexion, cerrar_conexion, inicializar_base_datos, ejecutar_script_sql
from conector_fatsecret import buscar_alimentos
from conector_wger import buscar_ejercicios, obtener_info_ejercicio

RUTA_FRONTEND = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'frontend', 'dist')
PUERTO = 8000

# Fotos de perfil: se guardan en disco (montado como volumen de Docker) y se
# sirven como archivos estáticos bajo /uploads/perfil/<archivo>.
RUTA_UPLOADS = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads')
RUTA_FOTOS_PERFIL = os.path.join(RUTA_UPLOADS, 'perfil')
os.makedirs(RUTA_FOTOS_PERFIL, exist_ok=True)

TAMANO_MAX_FOTO = 3 * 1024 * 1024  # 3 MB

# Firmas (magic bytes) de los formatos de imagen permitidos, para validar el
# contenido real del archivo y no solo la extensión/Content-Type declarados.
FIRMAS_IMAGEN = {
    b'\xff\xd8\xff': 'jpg',
    b'\x89PNG\r\n\x1a\n': 'png',
    b'GIF87a': 'gif',
    b'GIF89a': 'gif',
    b'RIFF': 'webp',  # se valida 'WEBP' en el offset 8 por separado
}


def _detectar_tipo_imagen(datos_binarios):
    """Detecta el tipo real de imagen a partir de sus primeros bytes (magic bytes).
    Devuelve la extensión ('jpg', 'png', 'gif', 'webp') o None si no es una imagen soportada."""
    if datos_binarios[:4] == b'RIFF' and datos_binarios[8:12] == b'WEBP':
        return 'webp'
    for firma, extension in FIRMAS_IMAGEN.items():
        if extension == 'webp':
            continue
        if datos_binarios.startswith(firma):
            return extension
    return None

# reCAPTCHA v2 (verificación de segundo paso en el login y en el registro)
RECAPTCHA_SECRET_KEY = os.environ.get('RECAPTCHA_SECRET_KEY', '')
RECAPTCHA_VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify'

FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:5173')


def _enviar_correo_smtp(destinatario, asunto, cuerpo_html):
    """Envía un correo HTML usando las credenciales SMTP configuradas en el .env.
    Devuelve True si se envió correctamente, False si falló (el error se imprime en consola)."""
    import smtplib
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart

    remitente_correo = os.getenv('SMTP_EMAIL')
    remitente_password = os.getenv('SMTP_PASSWORD')

    if not remitente_correo or not remitente_password:
        print("[EMAIL] SMTP_EMAIL / SMTP_PASSWORD no están configurados en el .env")
        return False

    mensaje = MIMEMultipart()
    mensaje['From'] = remitente_correo
    mensaje['To'] = destinatario
    mensaje['Subject'] = asunto
    mensaje.attach(MIMEText(cuerpo_html, 'html'))

    try:
        servidor_smtp = smtplib.SMTP('smtp.gmail.com', 587)
        servidor_smtp.starttls()
        servidor_smtp.login(remitente_correo, remitente_password)
        servidor_smtp.sendmail(remitente_correo, destinatario, mensaje.as_string())
        servidor_smtp.quit()
        return True
    except Exception as e:
        print(f"[EMAIL] Error al enviar correo: {e}")
        return False


def _validar_fortaleza_password(password):
    """Devuelve None si la contraseña cumple los requisitos, o un mensaje de error si no."""
    if len(password) < 6:
        return 'La contraseña debe tener al menos 6 caracteres'
    if not any(c.isupper() for c in password):
        return 'La contraseña debe tener al menos una mayúscula'
    if not any(c.islower() for c in password):
        return 'La contraseña debe tener al menos una minúscula'
    if not any(c.isdigit() for c in password):
        return 'La contraseña debe tener al menos un número'
    return None


class ManejadorSilverBack(BaseHTTPRequestHandler):

    def _enviar_json(self, datos, codigo=200):
        self.send_response(codigo)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self._enviar_cors()
        self.end_headers()
        self.wfile.write(json.dumps(datos, ensure_ascii=False, default=str).encode('utf-8'))

    def _enviar_error(self, mensaje, codigo=400):
        self._enviar_json({'error': mensaje}, codigo)

    def _enviar_cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')

    def _leer_cuerpo(self):
        longitud = int(self.headers.get('Content-Length', 0))
        if longitud == 0:
            return {}
        cuerpo = self.rfile.read(longitud)
        return json.loads(cuerpo.decode('utf-8'))

    def _crear_notificacion(self, id_usuario, tipo, titulo, mensaje, enlace=None):
        """Inserta una notificación para un usuario. Nunca debe interrumpir
        la operación principal (ej. crear una cita) si falla, así que
        cualquier error solo se registra en consola."""
        conexion = obtener_conexion()
        if not conexion:
            return
        try:
            cursor = conexion.cursor()
            cursor.execute(
                "INSERT INTO notificaciones (id_usuario, tipo, titulo, mensaje, enlace) "
                "VALUES (%s, %s, %s, %s, %s)",
                (id_usuario, tipo, titulo, mensaje, enlace)
            )
            conexion.commit()
            cursor.close()
        except Exception as e:
            print(f'Error al crear notificación: {str(e)}')
        finally:
            cerrar_conexion(conexion)

    def _parsear_ruta(self):
        return urlparse(self.path)

    def do_OPTIONS(self):
        self.send_response(204)
        self._enviar_cors()
        self.end_headers()

    def do_GET(self):
        ruta = self._parsear_ruta()
        partes = ruta.path.rstrip('/').split('/')

        if ruta.path.startswith('/api/'):
            self._manejar_api_get(partes, ruta)
        elif ruta.path.startswith('/uploads/'):
            self._servir_archivo_subido(ruta.path)
        else:
            self._servir_estatico(ruta.path)

    def do_POST(self):
        ruta = self._parsear_ruta()
        partes = ruta.path.rstrip('/').split('/')

        if ruta.path.startswith('/api/'):
            self._manejar_api_post(partes, ruta)
        else:
            self._enviar_error('Ruta no encontrada', 404)

    def do_PUT(self):
        ruta = self._parsear_ruta()
        partes = ruta.path.rstrip('/').split('/')

        if ruta.path.startswith('/api/'):
            self._manejar_api_put(partes, ruta)
        else:
            self._enviar_error('Ruta no encontrada', 404)

    def do_DELETE(self):
        ruta = self._parsear_ruta()
        partes = ruta.path.rstrip('/').split('/')

        if ruta.path.startswith('/api/'):
            self._manejar_api_delete(partes, ruta)
        else:
            self._enviar_error('Ruta no encontrada', 404)

    # ─── API GET ──────────────────────────────────────────────────────────────

    def _manejar_api_get(self, partes, ruta):
        if len(partes) >= 3 and partes[2] == 'comidas':
            self._obtener_comidas(ruta)
        elif len(partes) >= 3 and partes[2] == 'dias-con-comidas':
            self._obtener_dias_con_comidas(ruta)
        elif len(partes) >= 3 and partes[2] == 'buscar-alimentos':
            self._buscar_alimentos(ruta)
        elif len(partes) >= 3 and partes[2] == 'buscar-ejercicios':
            self._buscar_ejercicios(ruta)
        elif len(partes) >= 3 and partes[2] == 'usuario':
            if len(partes) >= 4:
                self._obtener_usuario(partes)
            else:
                self._listar_usuarios()
        elif len(partes) >= 3 and partes[2] == 'citas':
            self._obtener_citas(ruta)
        elif len(partes) >= 4 and partes[2] == 'nutriologo':
            self._obtener_nutriologo(partes[3])
        elif len(partes) >= 3 and partes[2] == 'nutriologos':
            self._listar_nutriologos(ruta)
        elif len(partes) >= 3 and partes[2] == 'pacientes':
            self._listar_pacientes(ruta)
        elif len(partes) >= 3 and partes[2] == 'admin' and len(partes) >= 4 and partes[3] == 'stats':
            self._admin_stats()
        elif len(partes) >= 3 and partes[2] == 'dieta':
            if len(partes) >= 4:
                self._obtener_dieta_paciente(partes[3])
            else:
                self._enviar_error('ID de paciente requerido', 400)
        elif len(partes) >= 3 and partes[2] == 'rutina':
            if len(partes) >= 4:
                self._obtener_rutina_paciente(partes[3])
            else:
                self._enviar_error('ID de paciente requerido', 400)
        elif len(partes) >= 4 and partes[2] == 'ejercicio-info':
            self._obtener_info_ejercicio(partes[3])
        elif len(partes) >= 3 and partes[2] == 'habitos':
            self._obtener_habitos(ruta)
        elif len(partes) >= 4 and partes[2] == 'mensajes' and partes[3] == 'no-leidos':
            self._mensajes_no_leidos(ruta)
        elif len(partes) >= 3 and partes[2] == 'mensajes':
            self._obtener_mensajes(ruta)
        elif len(partes) >= 4 and partes[2] == 'notificaciones' and partes[3] == 'no-leidas':
            self._notificaciones_no_leidas(ruta)
        elif len(partes) >= 3 and partes[2] == 'notificaciones':
            self._obtener_notificaciones(ruta)
        elif len(partes) >= 3 and partes[2] == 'salud':
            self._enviar_json({'estado': 'ok', 'timestamp': time.time()})
        else:
            self._enviar_error('Ruta API no encontrada', 404)

    def _obtener_dias_con_comidas(self, ruta):
        params = parse_qs(ruta.query)
        mes = params.get('mes', [None])[0]
        id_paciente = params.get('id_paciente', [None])[0]
        if not mes or not id_paciente:
            self._enviar_error('Parámetros "mes" (YYYY-MM) e "id_paciente" requeridos', 400)
            return
        conexion = obtener_conexion()
        if not conexion:
            self._enviar_error('Error de conexión a la base de datos', 500)
            return
        try:
            cursor = conexion.cursor(dictionary=True)
            cursor.execute(
                "SELECT DISTINCT fecha FROM comidas_diarias "
                "WHERE id_paciente = %s AND DATE_FORMAT(fecha, '%Y-%m') = %s",
                (int(id_paciente), mes)
            )
            fechas = [fila['fecha'].isoformat() for fila in cursor.fetchall()]
            cursor.close()
            self._enviar_json({'fechas': fechas})
        except Exception as e:
            self._enviar_error(f'Error al obtener días con comidas: {str(e)}', 500)
        finally:
            cerrar_conexion(conexion)

    def _obtener_dieta_paciente(self, id_paciente):
        conexion = obtener_conexion()
        if not conexion:
            self._enviar_error('Error de conexión a la base de datos', 500)
            return
        try:
            cursor = conexion.cursor(dictionary=True)
            cursor.execute(
                """SELECT pd.*, u.nombre_completo AS nombre_nutriologo
                   FROM planes_dieta pd
                   LEFT JOIN nutriologos_perfil np ON pd.id_nutriologo = np.id_nutriologo
                   LEFT JOIN usuarios u ON np.id_usuario = u.id_usuario
                   WHERE pd.id_paciente = %s AND pd.activo = 1
                   ORDER BY pd.fecha_asignado DESC LIMIT 1""",
                (int(id_paciente),)
            )
            plan = cursor.fetchone()
            if not plan:
                cursor.close()
                self._enviar_json({'dieta': None})
                return
            cursor.execute(
                "SELECT * FROM detalles_dieta WHERE id_plan_dieta = %s ORDER BY FIELD(tipo_comida, 'desayuno', 'colacion_1', 'comida', 'colacion_2', 'cena')",
                (plan['id_plan_dieta'],)
            )
            detalles = cursor.fetchall()
            cursor.close()
            self._enviar_json({'dieta': plan, 'detalles': detalles})
        except Exception as e:
            self._enviar_error(f'Error al obtener dieta: {str(e)}', 500)
        finally:
            cerrar_conexion(conexion)

    def _asignar_dieta(self):
        datos = self._leer_cuerpo()
        id_paciente = datos.get('id_paciente')
        id_nutriologo = datos.get('id_nutriologo')
        detalles = datos.get('detalles', [])
        if not id_paciente or not id_nutriologo:
            self._enviar_error('Campos requeridos: id_paciente, id_nutriologo', 400)
            return
        conexion = obtener_conexion()
        if not conexion:
            self._enviar_error('Error de conexión a la base de datos', 500)
            return
        try:
            cursor = conexion.cursor()
            cursor.execute(
                "UPDATE planes_dieta SET activo = 0 WHERE id_paciente = %s AND activo = 1",
                (int(id_paciente),)
            )
            cursor.execute(
                "INSERT INTO planes_dieta (id_paciente, id_nutriologo) VALUES (%s, %s)",
                (int(id_paciente), int(id_nutriologo))
            )
            id_plan_dieta = cursor.lastrowid
            for d in detalles:
                cursor.execute(
                    """INSERT INTO detalles_dieta
                       (id_plan_dieta, tipo_comida, nombre_alimento, cantidad, unidad,
                        calorias_totales, proteinas_totales, grasas_totales, carbohidratos_totales)
                       VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                    (id_plan_dieta, d['tipo_comida'], d['nombre_alimento'],
                     d.get('cantidad', 100), d.get('unidad', 'g'),
                     d.get('calorias_totales', 0), d.get('proteinas_totales', 0),
                     d.get('grasas_totales', 0), d.get('carbohidratos_totales', 0))
                )
            conexion.commit()
            cursor.close()
            self._enviar_json({'id_plan_dieta': id_plan_dieta, 'mensaje': 'Dieta asignada correctamente'}, 201)
        except Exception as e:
            self._enviar_error(f'Error al asignar dieta: {str(e)}', 500)
        finally:
            cerrar_conexion(conexion)

    def _desactivar_dieta(self, id_plan_dieta):
        conexion = obtener_conexion()
        if not conexion:
            self._enviar_error('Error de conexión a la base de datos', 500)
            return
        try:
            cursor = conexion.cursor()
            cursor.execute("UPDATE planes_dieta SET activo = 0 WHERE id_plan_dieta = %s", (int(id_plan_dieta),))
            conexion.commit()
            cursor.close()
            self._enviar_json({'mensaje': 'Dieta desactivada correctamente'})
        except Exception as e:
            self._enviar_error(f'Error al desactivar dieta: {str(e)}', 500)
        finally:
            cerrar_conexion(conexion)

    def _obtener_rutina_paciente(self, id_paciente):
        conexion = obtener_conexion()
        if not conexion:
            self._enviar_error('Error de conexión a la base de datos', 500)
            return
        try:
            cursor = conexion.cursor(dictionary=True)
            cursor.execute(
                """SELECT pr.*, u.nombre_completo AS nombre_nutriologo
                   FROM planes_rutina pr
                   LEFT JOIN nutriologos_perfil np ON pr.id_nutriologo = np.id_nutriologo
                   LEFT JOIN usuarios u ON np.id_usuario = u.id_usuario
                   WHERE pr.id_paciente = %s AND pr.activo = 1
                   ORDER BY pr.fecha_asignado DESC LIMIT 1""",
                (int(id_paciente),)
            )
            plan = cursor.fetchone()
            if not plan:
                cursor.close()
                self._enviar_json({'rutina': None})
                return
            cursor.execute(
                "SELECT * FROM detalles_rutina WHERE id_plan_rutina = %s ORDER BY orden ASC",
                (plan['id_plan_rutina'],)
            )
            detalles = cursor.fetchall()
            cursor.close()
            self._enviar_json({'rutina': plan, 'detalles': detalles})
        except Exception as e:
            self._enviar_error(f'Error al obtener rutina: {str(e)}', 500)
        finally:
            cerrar_conexion(conexion)

    def _completar_desde_wger(self, detalle):
        """Si el detalle tiene id_ejercicio pero le faltan descripcion/imagen/video,
        los obtiene desde Wger."""
        id_ej = detalle.get('id_ejercicio')
        if not id_ej:
            return detalle
        necesita = not detalle.get('imagen_url') or not detalle.get('video_url') or not detalle.get('descripcion')
        if not necesita:
            return detalle
        try:
            info = obtener_info_ejercicio(id_ej)
            if info:
                if not detalle.get('descripcion'):
                    detalle['descripcion'] = info.get('descripcion', '')
                if not detalle.get('imagen_url'):
                    detalle['imagen_url'] = info.get('imagen', '')
                if not detalle.get('video_url'):
                    detalle['video_url'] = info.get('video', '')
        except Exception as e:
            print(f'[Servidor] Error auto-completando Wger ({id_ej}): {e}')
        return detalle

    def _asignar_rutina(self):
        datos = self._leer_cuerpo()
        id_paciente = datos.get('id_paciente')
        id_nutriologo = datos.get('id_nutriologo')
        detalles = datos.get('detalles', [])
        if not id_paciente:
            self._enviar_error('Campo requerido: id_paciente', 400)
            return
        # Auto-completar datos desde Wger si hace falta
        detalles = [self._completar_desde_wger(d) for d in detalles]
        conexion = obtener_conexion()
        if not conexion:
            self._enviar_error('Error de conexión a la base de datos', 500)
            return
        try:
            cursor = conexion.cursor()
            cursor.execute(
                "UPDATE planes_rutina SET activo = 0 WHERE id_paciente = %s AND activo = 1",
                (int(id_paciente),)
            )
            cursor.execute(
                "INSERT INTO planes_rutina (id_paciente, id_nutriologo) VALUES (%s, %s)",
                (int(id_paciente), int(id_nutriologo) if id_nutriologo else None)
            )
            id_plan_rutina = cursor.lastrowid
            for i, d in enumerate(detalles):
                cursor.execute(
                    """INSERT INTO detalles_rutina
                       (id_plan_rutina, id_ejercicio, nombre_ejercicio, descripcion,
                        series, repeticiones, descanso, imagen_url, video_url, orden)
                       VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                    (id_plan_rutina,
                     int(d['id_ejercicio']) if d.get('id_ejercicio') else None,
                     d.get('nombre_ejercicio', 'Ejercicio'),
                     d.get('descripcion', ''),
                     d.get('series', 3),
                     d.get('repeticiones', '10'),
                     d.get('descanso', '60 seg'),
                     d.get('imagen_url', '') or '',
                     d.get('video_url', '') or '',
                     i)
                )
            conexion.commit()
            cursor.close()
            self._enviar_json({'id_plan_rutina': id_plan_rutina, 'mensaje': 'Rutina asignada correctamente'}, 201)
        except Exception as e:
            self._enviar_error(f'Error al asignar rutina: {str(e)}', 500)
        finally:
            cerrar_conexion(conexion)

    def _desactivar_rutina(self, id_plan_rutina):
        conexion = obtener_conexion()
        if not conexion:
            self._enviar_error('Error de conexión a la base de datos', 500)
            return
        try:
            cursor = conexion.cursor()
            cursor.execute("UPDATE planes_rutina SET activo = 0 WHERE id_plan_rutina = %s", (int(id_plan_rutina),))
            conexion.commit()
            cursor.close()
            self._enviar_json({'mensaje': 'Rutina desactivada correctamente'})
        except Exception as e:
            self._enviar_error(f'Error al desactivar rutina: {str(e)}', 500)
        finally:
            cerrar_conexion(conexion)

    def _obtener_nutriologo(self, id_nutriologo):
        conexion = obtener_conexion()
        if not conexion:
            self._enviar_error('Error de conexión a la base de datos', 500)
            return
        try:
            cursor = conexion.cursor(dictionary=True)
            cursor.execute(
                "SELECT np.*, u.nombre_completo, u.correo, u.foto_perfil "
                "FROM nutriologos_perfil np JOIN usuarios u ON np.id_usuario = u.id_usuario "
                "WHERE np.id_nutriologo = %s",
                (id_nutriologo,)
            )
            nutriologo = cursor.fetchone()
            cursor.close()
            if not nutriologo:
                self._enviar_error('Nutriólogo no encontrado', 404)
                return
            self._enviar_json({'nutriologo': nutriologo})
        except Exception as e:
            self._enviar_error(f'Error al obtener nutriólogo: {str(e)}', 500)
        finally:
            cerrar_conexion(conexion)

    def _listar_nutriologos(self, ruta):
        params = parse_qs(ruta.query)
        termino = params.get('termino', [None])[0]
        pagina = int(params.get('pagina', ['1'])[0])
        limite = int(params.get('limite', ['10'])[0])
        if pagina < 1: pagina = 1
        if limite < 1 or limite > 50: limite = 10
        offset = (pagina - 1) * limite
        conexion = obtener_conexion()
        if not conexion:
            self._enviar_error('Error de conexión a la base de datos', 500)
            return
        try:
            cursor = conexion.cursor(dictionary=True)
            where = ""
            valores = []
            if termino:
                where = "WHERE u.nombre_completo LIKE %s OR np.especialidad LIKE %s"
                like = f'%{termino}%'
                valores = [like, like]
            cursor.execute(
                f"SELECT COUNT(*) as total FROM nutriologos_perfil np "
                f"JOIN usuarios u ON np.id_usuario = u.id_usuario {where}",
                valores
            )
            total = cursor.fetchone()['total']
            cursor.execute(
                f"SELECT np.*, u.nombre_completo, u.correo "
                f"FROM nutriologos_perfil np "
                f"JOIN usuarios u ON np.id_usuario = u.id_usuario {where} "
                f"ORDER BY np.verificado DESC, u.nombre_completo ASC "
                f"LIMIT %s OFFSET %s",
                valores + [limite, offset]
            )
            nutriologos = cursor.fetchall()
            cursor.close()
            self._enviar_json({
                'nutriologos': nutriologos,
                'total': total,
                'pagina': pagina,
                'limite': limite,
                'total_paginas': max(1, (total + limite - 1) // limite)
            })
        except Exception as e:
            self._enviar_error(f'Error al listar nutriólogos: {str(e)}', 500)
        finally:
            cerrar_conexion(conexion)

    def _listar_pacientes(self, ruta):
        params = parse_qs(ruta.query)
        id_nutriologo = params.get('id_nutriologo', [None])[0]
        if not id_nutriologo:
            self._enviar_error('Parámetro "id_nutriologo" requerido', 400)
            return
        conexion = obtener_conexion()
        if not conexion:
            self._enviar_error('Error de conexión a la base de datos', 500)
            return
        try:
            cursor = conexion.cursor(dictionary=True)
            cursor.execute(
                "SELECT pp.*, u.nombre_completo, u.correo, u.activo, u.foto_perfil "
                "FROM pacientes_perfil pp "
                "JOIN usuarios u ON pp.id_usuario = u.id_usuario "
                "JOIN nutriologos_perfil np ON np.id_usuario = %s "
                "WHERE pp.id_nutriologo_asignado = np.id_nutriologo "
                "ORDER BY u.nombre_completo ASC",
                (int(id_nutriologo),)
            )
            pacientes = cursor.fetchall()
            cursor.close()
            self._enviar_json({'pacientes': pacientes})
        except Exception as e:
            self._enviar_error(f'Error al listar pacientes: {str(e)}', 500)
        finally:
            cerrar_conexion(conexion)

    def _obtener_par_conversacion(self, cursor, id_paciente, id_nutriologo):
        """Verifica que el paciente esté realmente asignado a ese nutriólogo y
        devuelve los id_usuario de ambos, para validar remitentes y evitar que
        alguien chatee con una pareja paciente/nutriólogo que no le corresponde."""
        cursor.execute(
            "SELECT pp.id_usuario AS id_usuario_paciente, np.id_usuario AS id_usuario_nutriologo "
            "FROM pacientes_perfil pp "
            "JOIN nutriologos_perfil np ON np.id_nutriologo = pp.id_nutriologo_asignado "
            "WHERE pp.id_paciente = %s AND np.id_nutriologo = %s",
            (id_paciente, id_nutriologo)
        )
        return cursor.fetchone()

    def _obtener_mensajes(self, ruta):
        params = parse_qs(ruta.query)
        id_paciente = params.get('id_paciente', [None])[0]
        id_nutriologo = params.get('id_nutriologo', [None])[0]
        despues_de = params.get('despues_de', [None])[0]
        if not id_paciente or not id_nutriologo:
            self._enviar_error('Parámetros "id_paciente" e "id_nutriologo" requeridos', 400)
            return
        conexion = obtener_conexion()
        if not conexion:
            self._enviar_error('Error de conexión a la base de datos', 500)
            return
        try:
            cursor = conexion.cursor(dictionary=True)
            par = self._obtener_par_conversacion(cursor, int(id_paciente), int(id_nutriologo))
            if not par:
                cursor.close()
                self._enviar_error('Esta conversación no existe o el paciente ya no está asignado a ese nutriólogo', 404)
                return
            consulta = (
                "SELECT id_mensaje, id_paciente, id_nutriologo, id_emisor, contenido, leido, enviado_en "
                "FROM mensajes WHERE id_paciente = %s AND id_nutriologo = %s"
            )
            valores = [int(id_paciente), int(id_nutriologo)]
            if despues_de:
                consulta += " AND id_mensaje > %s"
                valores.append(int(despues_de))
            consulta += " ORDER BY id_mensaje ASC"
            cursor.execute(consulta, valores)
            mensajes = cursor.fetchall()
            cursor.close()
            self._enviar_json({'mensajes': mensajes})
        except Exception as e:
            self._enviar_error(f'Error al obtener mensajes: {str(e)}', 500)
        finally:
            cerrar_conexion(conexion)

    def _mensajes_no_leidos(self, ruta):
        params = parse_qs(ruta.query)
        id_usuario = params.get('id_usuario', [None])[0]
        if not id_usuario:
            self._enviar_error('Parámetro "id_usuario" requerido', 400)
            return
        conexion = obtener_conexion()
        if not conexion:
            self._enviar_error('Error de conexión a la base de datos', 500)
            return
        try:
            cursor = conexion.cursor(dictionary=True)
            # No leídos = mensajes de conversaciones donde participo, que no envié yo y que siguen sin leer.
            cursor.execute(
                "SELECT m.id_paciente, COUNT(*) AS no_leidos "
                "FROM mensajes m "
                "JOIN pacientes_perfil pp ON pp.id_paciente = m.id_paciente "
                "JOIN nutriologos_perfil np ON np.id_nutriologo = m.id_nutriologo "
                "WHERE (pp.id_usuario = %s OR np.id_usuario = %s) "
                "AND m.id_emisor != %s AND m.leido = 0 "
                "GROUP BY m.id_paciente",
                (int(id_usuario), int(id_usuario), int(id_usuario))
            )
            filas = cursor.fetchall()
            cursor.close()
            total = sum(f['no_leidos'] for f in filas)
            self._enviar_json({'total': total, 'por_paciente': filas})
        except Exception as e:
            self._enviar_error(f'Error al obtener mensajes no leídos: {str(e)}', 500)
        finally:
            cerrar_conexion(conexion)

    def _obtener_notificaciones(self, ruta):
        params = parse_qs(ruta.query)
        id_usuario = params.get('id_usuario', [None])[0]
        if not id_usuario:
            self._enviar_error('Parámetro "id_usuario" requerido', 400)
            return
        conexion = obtener_conexion()
        if not conexion:
            self._enviar_error('Error de conexión a la base de datos', 500)
            return
        try:
            cursor = conexion.cursor(dictionary=True)
            cursor.execute(
                "SELECT id_notificacion, tipo, titulo, mensaje, enlace, leido, creado_en "
                "FROM notificaciones WHERE id_usuario = %s "
                "ORDER BY creado_en DESC LIMIT 30",
                (int(id_usuario),)
            )
            notificaciones = cursor.fetchall()
            cursor.close()
            self._enviar_json({'notificaciones': notificaciones})
        except Exception as e:
            self._enviar_error(f'Error al obtener notificaciones: {str(e)}', 500)
        finally:
            cerrar_conexion(conexion)

    def _notificaciones_no_leidas(self, ruta):
        params = parse_qs(ruta.query)
        id_usuario = params.get('id_usuario', [None])[0]
        if not id_usuario:
            self._enviar_error('Parámetro "id_usuario" requerido', 400)
            return
        conexion = obtener_conexion()
        if not conexion:
            self._enviar_error('Error de conexión a la base de datos', 500)
            return
        try:
            cursor = conexion.cursor()
            cursor.execute(
                "SELECT COUNT(*) FROM notificaciones WHERE id_usuario = %s AND leido = 0",
                (int(id_usuario),)
            )
            total = cursor.fetchone()[0]
            cursor.close()
            self._enviar_json({'total': total})
        except Exception as e:
            self._enviar_error(f'Error al obtener notificaciones no leídas: {str(e)}', 500)
        finally:
            cerrar_conexion(conexion)

    def _enviar_mensaje(self):
        datos = self._leer_cuerpo()
        id_paciente = datos.get('id_paciente')
        id_nutriologo = datos.get('id_nutriologo')
        id_emisor = datos.get('id_emisor')
        contenido = (datos.get('contenido') or '').strip()

        if not id_paciente or not id_nutriologo or not id_emisor:
            self._enviar_error('Campos "id_paciente", "id_nutriologo" e "id_emisor" requeridos', 400)
            return
        if not contenido:
            self._enviar_error('El mensaje no puede estar vacío', 400)
            return
        if len(contenido) > 2000:
            self._enviar_error('El mensaje no puede superar los 2000 caracteres', 400)
            return

        conexion = obtener_conexion()
        if not conexion:
            self._enviar_error('Error de conexión a la base de datos', 500)
            return
        try:
            cursor = conexion.cursor(dictionary=True)
            par = self._obtener_par_conversacion(cursor, int(id_paciente), int(id_nutriologo))
            if not par:
                cursor.close()
                self._enviar_error('Esta conversación no existe o el paciente ya no está asignado a ese nutriólogo', 404)
                return
            emisores_validos = {par['id_usuario_paciente'], par['id_usuario_nutriologo']}
            if int(id_emisor) not in emisores_validos:
                cursor.close()
                self._enviar_error('No tienes permiso para enviar mensajes en esta conversación', 403)
                return

            cursor.execute(
                "INSERT INTO mensajes (id_paciente, id_nutriologo, id_emisor, contenido) VALUES (%s, %s, %s, %s)",
                (int(id_paciente), int(id_nutriologo), int(id_emisor), contenido)
            )
            conexion.commit()
            id_mensaje = cursor.lastrowid
            cursor.execute(
                "SELECT id_mensaje, id_paciente, id_nutriologo, id_emisor, contenido, leido, enviado_en "
                "FROM mensajes WHERE id_mensaje = %s", (id_mensaje,)
            )
            mensaje = cursor.fetchone()
            cursor.close()
            self._enviar_json({'mensaje': mensaje}, codigo=201)
        except Exception as e:
            self._enviar_error(f'Error al enviar el mensaje: {str(e)}', 500)
        finally:
            cerrar_conexion(conexion)

    def _marcar_mensajes_leidos(self):
        datos = self._leer_cuerpo()
        id_paciente = datos.get('id_paciente')
        id_nutriologo = datos.get('id_nutriologo')
        id_usuario = datos.get('id_usuario')
        if not id_paciente or not id_nutriologo or not id_usuario:
            self._enviar_error('Campos "id_paciente", "id_nutriologo" e "id_usuario" requeridos', 400)
            return
        conexion = obtener_conexion()
        if not conexion:
            self._enviar_error('Error de conexión a la base de datos', 500)
            return
        try:
            cursor = conexion.cursor(dictionary=True)
            par = self._obtener_par_conversacion(cursor, int(id_paciente), int(id_nutriologo))
            if not par:
                cursor.close()
                self._enviar_error('Esta conversación no existe o el paciente ya no está asignado a ese nutriólogo', 404)
                return
            cursor.execute(
                "UPDATE mensajes SET leido = 1 "
                "WHERE id_paciente = %s AND id_nutriologo = %s AND id_emisor != %s AND leido = 0",
                (int(id_paciente), int(id_nutriologo), int(id_usuario))
            )
            conexion.commit()
            cursor.close()
            self._enviar_json({'mensaje': 'Mensajes marcados como leídos'})
        except Exception as e:
            self._enviar_error(f'Error al marcar mensajes como leídos: {str(e)}', 500)
        finally:
            cerrar_conexion(conexion)

    def _marcar_notificacion_leida(self, id_notificacion):
        conexion = obtener_conexion()
        if not conexion:
            self._enviar_error('Error de conexión a la base de datos', 500)
            return
        try:
            cursor = conexion.cursor()
            cursor.execute(
                "UPDATE notificaciones SET leido = 1 WHERE id_notificacion = %s",
                (id_notificacion,)
            )
            conexion.commit()
            cursor.close()
            self._enviar_json({'mensaje': 'Notificación marcada como leída'})
        except Exception as e:
            self._enviar_error(f'Error al marcar notificación como leída: {str(e)}', 500)
        finally:
            cerrar_conexion(conexion)

    def _marcar_notificaciones_leidas(self):
        datos = self._leer_cuerpo()
        id_usuario = datos.get('id_usuario')
        if not id_usuario:
            self._enviar_error('Campo "id_usuario" requerido', 400)
            return
        conexion = obtener_conexion()
        if not conexion:
            self._enviar_error('Error de conexión a la base de datos', 500)
            return
        try:
            cursor = conexion.cursor()
            cursor.execute(
                "UPDATE notificaciones SET leido = 1 WHERE id_usuario = %s AND leido = 0",
                (int(id_usuario),)
            )
            conexion.commit()
            cursor.close()
            self._enviar_json({'mensaje': 'Notificaciones marcadas como leídas'})
        except Exception as e:
            self._enviar_error(f'Error al marcar notificaciones como leídas: {str(e)}', 500)
        finally:
            cerrar_conexion(conexion)

    def _admin_stats(self):
        conexion = obtener_conexion()
        if not conexion:
            self._enviar_error('Error de conexión a la base de datos', 500)
            return
        try:
            cursor = conexion.cursor(dictionary=True)
            cursor.execute("SELECT COUNT(*) as total FROM usuarios")
            total_usuarios = cursor.fetchone()['total']
            cursor.execute("SELECT COUNT(*) as total FROM usuarios WHERE rol = 'atleta'")
            total_atletas = cursor.fetchone()['total']
            cursor.execute("SELECT COUNT(*) as total FROM usuarios WHERE rol = 'nutriologo'")
            total_nutriologos = cursor.fetchone()['total']
            cursor.execute("SELECT COUNT(*) as total FROM citas")
            total_citas = cursor.fetchone()['total']
            cursor.execute("SELECT COUNT(*) as total FROM citas WHERE estado = 'pendiente'")
            citas_pendientes = cursor.fetchone()['total']
            cursor.close()
            self._enviar_json({
                'total_usuarios': total_usuarios,
                'total_atletas': total_atletas,
                'total_nutriologos': total_nutriologos,
                'total_citas': total_citas,
                'citas_pendientes': citas_pendientes,
            })
        except Exception as e:
            self._enviar_error(f'Error al obtener stats: {str(e)}', 500)
        finally:
            cerrar_conexion(conexion)

    def _obtener_comidas(self, ruta):
        params = parse_qs(ruta.query)
        fecha = params.get('fecha', [None])[0]
        id_paciente = params.get('id_paciente', [None])[0]
        if not fecha:
            self._enviar_error('Parámetro "fecha" requerido (YYYY-MM-DD)', 400)
            return
        conexion = obtener_conexion()
        if not conexion:
            self._enviar_error('Error de conexión a la base de datos', 500)
            return
        try:
            cursor = conexion.cursor(dictionary=True)
            consulta = ("SELECT * FROM comidas_diarias WHERE fecha = %s")
            parametros = [fecha]
            if id_paciente:
                consulta += " AND id_paciente = %s"
                parametros.append(int(id_paciente))
            consulta += " ORDER BY FIELD(tipo_comida, 'desayuno', 'colacion_1', 'comida', 'colacion_2', 'cena')"
            cursor.execute(consulta, parametros)
            comidas = cursor.fetchall()
            self._enviar_json({'comidas': comidas})
            cursor.close()
        except Exception as e:
            self._enviar_error(f'Error al obtener comidas: {str(e)}', 500)
        finally:
            cerrar_conexion(conexion)

    def _buscar_alimentos(self, ruta):
        params = parse_qs(ruta.query)
        termino = params.get('termino', [None])[0]
        if not termino:
            self._enviar_error('Parámetro "termino" requerido', 400)
            return
        try:
            resultado = buscar_alimentos(termino)
            self._enviar_json(resultado)
        except RuntimeError as e:
            self._enviar_error(str(e), 503)

    def _buscar_ejercicios(self, ruta):
        params = parse_qs(ruta.query)
        termino = params.get('termino', [None])[0]
        if not termino:
            self._enviar_error('Parámetro "termino" requerido', 400)
            return
        try:
            resultado = buscar_ejercicios(termino)
            self._enviar_json(resultado)
        except RuntimeError as e:
            self._enviar_error(str(e), 503)

    def _obtener_info_ejercicio(self, id_ejercicio):
        if not id_ejercicio:
            self._enviar_error('ID de ejercicio requerido', 400)
            return
        try:
            resultado = obtener_info_ejercicio(id_ejercicio)
            if resultado is None:
                self._enviar_error('Ejercicio no encontrado', 404)
                return
            self._enviar_json(resultado)
        except RuntimeError as e:
            self._enviar_error(str(e), 503)

    def _obtener_usuario(self, partes):
        if len(partes) < 4:
            self._enviar_error('ID de usuario requerido', 400)
            return
        id_usuario = partes[3]
        conexion = obtener_conexion()
        if not conexion:
            self._enviar_error('Error de conexión a la base de datos', 500)
            return
        try:
            cursor = conexion.cursor(dictionary=True)
            cursor.execute("SELECT id_usuario, nombre_completo, correo, rol, foto_perfil FROM usuarios WHERE id_usuario = %s", (id_usuario,))
            usuario = cursor.fetchone()
            cursor.close()
            if not usuario:
                self._enviar_error('Usuario no encontrado', 404)
                return
            if usuario['rol'] == 'atleta':
                cursor = conexion.cursor(dictionary=True)
                cursor.execute("SELECT * FROM pacientes_perfil WHERE id_usuario = %s", (id_usuario,))
                perfil = cursor.fetchone()
                if perfil:
                    usuario['perfil'] = perfil
                cursor.close()
            elif usuario['rol'] == 'nutriologo':
                cursor = conexion.cursor(dictionary=True)
                cursor.execute("SELECT * FROM nutriologos_perfil WHERE id_usuario = %s", (id_usuario,))
                perfil = cursor.fetchone()
                if perfil:
                    usuario['perfil'] = perfil
                cursor.close()
            self._enviar_json({'usuario': usuario})
        except Exception as e:
            self._enviar_error(f'Error al obtener usuario: {str(e)}', 500)
        finally:
            cerrar_conexion(conexion)

    def _listar_usuarios(self):
        conexion = obtener_conexion()
        if not conexion:
            self._enviar_error('Error de conexión a la base de datos', 500)
            return
        try:
            cursor = conexion.cursor(dictionary=True)
            cursor.execute(
                "SELECT id_usuario, nombre_completo, correo, rol, activo, fecha_registro, foto_perfil "
                "FROM usuarios ORDER BY fecha_registro DESC"
            )
            usuarios = cursor.fetchall()
            cursor.close()
            self._enviar_json({'usuarios': usuarios})
        except Exception as e:
            self._enviar_error(f'Error al listar usuarios: {str(e)}', 500)
        finally:
            cerrar_conexion(conexion)

    def _obtener_citas(self, ruta):
        params = parse_qs(ruta.query)
        id_usuario = params.get('id_usuario', [None])[0]
        rol = params.get('rol', [None])[0]
        conexion = obtener_conexion()
        if not conexion:
            self._enviar_error('Error de conexión a la base de datos', 500)
            return
        try:
            cursor = conexion.cursor(dictionary=True)
            consulta = (
                "SELECT c.*, "
                "  up.nombre_completo as nombre_paciente, "
                "  un.nombre_completo as nombre_nutriologo "
                "FROM citas c "
                "JOIN pacientes_perfil pp ON c.id_paciente = pp.id_paciente "
                "JOIN usuarios up ON pp.id_usuario = up.id_usuario "
                "JOIN nutriologos_perfil np ON c.id_nutriologo = np.id_nutriologo "
                "JOIN usuarios un ON np.id_usuario = un.id_usuario"
            )
            parametros = []
            if id_usuario and rol == 'nutriologo':
                consulta += " WHERE np.id_usuario = %s"
                parametros.append(int(id_usuario))
            elif id_usuario:
                consulta += " WHERE pp.id_usuario = %s"
                parametros.append(int(id_usuario))
            consulta += " ORDER BY c.fecha DESC, c.hora DESC"
            cursor.execute(consulta, parametros)
            citas = cursor.fetchall()
            self._enviar_json({'citas': citas})
            cursor.close()
        except Exception as e:
            self._enviar_error(f'Error al obtener citas: {str(e)}', 500)
        finally:
            cerrar_conexion(conexion)

    def _obtener_habitos(self, ruta):
        params = parse_qs(ruta.query)
        id_paciente = params.get('id_paciente', [None])[0]
        fecha = params.get('fecha', [None])[0]
        if not id_paciente:
            self._enviar_error('Parámetro "id_paciente" requerido', 400)
            return
        conexion = obtener_conexion()
        if not conexion:
            self._enviar_error('Error de conexión a la base de datos', 500)
            return
        try:
            cursor = conexion.cursor(dictionary=True)
            consulta = "SELECT * FROM registro_habitos WHERE id_paciente = %s"
            parametros = [int(id_paciente)]
            if fecha:
                consulta += " AND fecha = %s"
                parametros.append(fecha)
            consulta += " ORDER BY fecha DESC LIMIT 30"
            cursor.execute(consulta, parametros)
            habitos = cursor.fetchall()
            self._enviar_json({'habitos': habitos})
            cursor.close()
        except Exception as e:
            self._enviar_error(f'Error al obtener hábitos: {str(e)}', 500)
        finally:
            cerrar_conexion(conexion)

    # ─── API POST ─────────────────────────────────────────────────────────────

    def _manejar_api_post(self, partes, ruta):
        if len(partes) >= 3 and partes[2] == 'comidas':
            self._guardar_comida()
        elif len(partes) >= 3 and partes[2] == 'auth':
            self._iniciar_sesion()
        elif len(partes) >= 3 and partes[2] == 'registro':
            self._registrar_usuario()
        elif len(partes) >= 3 and partes[2] == 'habitos':
            self._guardar_habito()
        elif len(partes) >= 3 and partes[2] == 'citas':
            self._crear_cita()
        elif len(partes) >= 3 and partes[2] == 'dieta':
            self._asignar_dieta()
        elif len(partes) >= 3 and partes[2] == 'rutina':
            self._asignar_rutina()
        elif len(partes) >= 3 and partes[2] == 'recuperar-password':
            self._solicitar_recuperacion_password()
        elif len(partes) >= 3 and partes[2] == 'cambiar-password':
            self._cambiar_password()
        elif len(partes) >= 3 and partes[2] == 'verificar-correo':
            self._verificar_correo()
        elif len(partes) >= 3 and partes[2] == 'reenviar-codigo':
            self._reenviar_codigo_verificacion()
        elif len(partes) >= 5 and partes[2] == 'usuario' and partes[4] == 'foto':
            self._subir_foto_perfil(partes[3])
        elif len(partes) >= 3 and partes[2] == 'mensajes':
            self._enviar_mensaje()
        else:
            self._enviar_error('Ruta API no encontrada', 404)

    def _guardar_comida(self):
        datos = self._leer_cuerpo()
        id_paciente = datos.get('id_paciente')
        fecha = datos.get('fecha')
        tipo_comida = datos.get('tipo_comida')
        nombre_alimento = datos.get('nombre_alimento')
        cantidad = datos.get('cantidad', 100)
        unidad = datos.get('unidad', 'g')
        calorias = datos.get('calorias_totales', 0)
        proteinas = datos.get('proteinas_totales', 0)
        grasas = datos.get('grasas_totales', 0)
        carbohidratos = datos.get('carbohidratos_totales', 0)

        if not all([id_paciente, fecha, tipo_comida, nombre_alimento]):
            self._enviar_error('Campos requeridos: id_paciente, fecha, tipo_comida, nombre_alimento', 400)
            return

        conexion = obtener_conexion()
        if not conexion:
            self._enviar_error('Error de conexión a la base de datos', 500)
            return
        try:
            cursor = conexion.cursor()
            cursor.execute(
                """INSERT INTO comidas_diarias
                   (id_paciente, fecha, tipo_comida, nombre_alimento, cantidad, unidad,
                    calorias_totales, proteinas_totales, grasas_totales, carbohidratos_totales)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                (id_paciente, fecha, tipo_comida, nombre_alimento, cantidad, unidad,
                 calorias, proteinas, grasas, carbohidratos)
            )
            conexion.commit()
            id_comida = cursor.lastrowid
            cursor.close()
            self._enviar_json({'id_comida': id_comida, 'mensaje': 'Comida registrada correctamente'}, 201)
        except Exception as e:
            self._enviar_error(f'Error al guardar comida: {str(e)}', 500)
        finally:
            cerrar_conexion(conexion)

    def _verificar_captcha(self, token, ip_cliente=None):
        """Verifica un token de reCAPTCHA v2 contra la API de Google.
        Devuelve True solo si Google confirma que es válido."""
        if not RECAPTCHA_SECRET_KEY:
            print('[Captcha] RECAPTCHA_SECRET_KEY no configurada; se rechaza por seguridad.')
            return False
        if not token:
            return False
        try:
            payload = {'secret': RECAPTCHA_SECRET_KEY, 'response': token}
            if ip_cliente:
                payload['remoteip'] = ip_cliente
            respuesta = requests.post(RECAPTCHA_VERIFY_URL, data=payload, timeout=8)
            resultado = respuesta.json()
            return bool(resultado.get('success'))
        except Exception as e:
            print(f'[Captcha] Error al verificar con Google: {e}')
            return False

    def _iniciar_sesion(self):
        MAX_INTENTOS = 5
        MINUTOS_BLOQUEO = 5

        datos = self._leer_cuerpo()
        correo = datos.get('correo')
        contrasena = datos.get('contrasena')
        if not correo or not contrasena:
            self._enviar_error('Correo y contraseña requeridos', 400)
            return
        conexion = obtener_conexion()
        if not conexion:
            self._enviar_error('Error de conexión a la base de datos', 500)
            return
        try:
            cursor = conexion.cursor(dictionary=True)
            cursor.execute("SELECT * FROM usuarios WHERE correo = %s", (correo,))
            usuario = cursor.fetchone()

            if not usuario:
                cursor.close()
                self._enviar_error('Credenciales inválidas', 401)
                return

            ahora = datetime.datetime.now()
            bloqueado_hasta = usuario.get('bloqueado_hasta')

            # Si el bloqueo ya expiró, lo limpiamos antes de seguir
            if bloqueado_hasta and bloqueado_hasta <= ahora:
                cursor.execute(
                    "UPDATE usuarios SET intentos_fallidos = 0, bloqueado_hasta = NULL WHERE id_usuario = %s",
                    (usuario['id_usuario'],)
                )
                conexion.commit()
                usuario['intentos_fallidos'] = 0
                bloqueado_hasta = None

            # Si sigue bloqueado, se rechaza sin verificar la contraseña
            if bloqueado_hasta and bloqueado_hasta > ahora:
                cursor.close()
                segundos_restantes = int((bloqueado_hasta - ahora).total_seconds())
                minutos_restantes = max(1, (segundos_restantes + 59) // 60)
                self._enviar_error(
                    f'Cuenta bloqueada por demasiados intentos fallidos. Intenta de nuevo en {minutos_restantes} minuto(s).',
                    423
                )
                return

            import hashlib
            hash_ingresada = hashlib.sha256(contrasena.encode('utf-8')).hexdigest()

            if usuario['contrasenia_hash'] != hash_ingresada:
                intentos = (usuario.get('intentos_fallidos') or 0) + 1
                if intentos >= MAX_INTENTOS:
                    nuevo_bloqueo = ahora + datetime.timedelta(minutes=MINUTOS_BLOQUEO)
                    cursor.execute(
                        "UPDATE usuarios SET intentos_fallidos = %s, bloqueado_hasta = %s WHERE id_usuario = %s",
                        (intentos, nuevo_bloqueo, usuario['id_usuario'])
                    )
                    conexion.commit()
                    cursor.close()
                    self._enviar_error(
                        f'Cuenta bloqueada por {MINUTOS_BLOQUEO} minutos debido a demasiados intentos fallidos.',
                        423
                    )
                    return
                else:
                    cursor.execute(
                        "UPDATE usuarios SET intentos_fallidos = %s WHERE id_usuario = %s",
                        (intentos, usuario['id_usuario'])
                    )
                    conexion.commit()
                    cursor.close()
                    restantes = MAX_INTENTOS - intentos
                    self._enviar_error(
                        f'Credenciales inválidas. Te quedan {restantes} intento(s) antes del bloqueo temporal.',
                        401
                    )
                    return

            # Credenciales correctas: limpiar contador de intentos fallidos
            cursor.execute(
                "UPDATE usuarios SET intentos_fallidos = 0, bloqueado_hasta = NULL WHERE id_usuario = %s",
                (usuario['id_usuario'],)
            )
            conexion.commit()
            cursor.close()

            if not usuario.get('correo_verificado', 1):
                self._enviar_error(
                    'Debes verificar tu correo electrónico antes de iniciar sesión. Revisa tu bandeja de entrada.',
                    403
                )
                return

            captcha_token = datos.get('captcha_token')

            # Paso 2: si aún no se envió el captcha, se pide antes de emitir el token
            if not captcha_token:
                self._enviar_json({
                    'requiere_captcha': True,
                    'mensaje': 'Credenciales correctas. Verifica el captcha para completar el inicio de sesión.'
                })
                return

            ip_cliente = self.client_address[0] if self.client_address else None
            if not self._verificar_captcha(captcha_token, ip_cliente):
                self._enviar_error('Verificación de captcha inválida. Intenta de nuevo.', 400)
                return

            self._enviar_json({
                'token': 'token-simulado-' + str(usuario['id_usuario']),
                'usuario': {
                    'id_usuario': usuario['id_usuario'],
                    'nombre_completo': usuario['nombre_completo'],
                    'correo': usuario['correo'],
                    'rol': usuario['rol'],
                    'foto_perfil': usuario.get('foto_perfil')
                }
            })
        except Exception as e:
            self._enviar_error(f'Error al iniciar sesión: {str(e)}', 500)
        finally:
            cerrar_conexion(conexion)

    def _registrar_usuario(self):
        datos = self._leer_cuerpo()
        nombre = datos.get('nombre_completo')
        correo = datos.get('correo')
        contrasena = datos.get('contrasena')
        rol = datos.get('rol', 'atleta')

        if not all([nombre, correo, contrasena]):
            self._enviar_error('Campos requeridos: nombre_completo, correo, contrasena', 400)
            return

        error_password = _validar_fortaleza_password(contrasena)
        if error_password:
            self._enviar_error(error_password, 400)
            return

        conexion = obtener_conexion()
        if not conexion:
            self._enviar_error('Error de conexión a la base de datos', 500)
            return
        try:
            # Verificamos duplicado antes de pedir el captcha para no hacer
            # resolver el captcha a alguien que de todos modos va a fallar.
            cursor = conexion.cursor()
            cursor.execute("SELECT id_usuario FROM usuarios WHERE correo = %s", (correo,))
            ya_existe = cursor.fetchone()
            cursor.close()
            if ya_existe:
                self._enviar_error('El correo ya está registrado', 409)
                return

            captcha_token = datos.get('captcha_token')

            # Paso 1: si aún no se envió el captcha, se pide antes de crear la cuenta
            if not captcha_token:
                self._enviar_json({
                    'requiere_captcha': True,
                    'mensaje': 'Verifica el captcha para completar tu registro.'
                })
                return

            ip_cliente = self.client_address[0] if self.client_address else None
            if not self._verificar_captcha(captcha_token, ip_cliente):
                self._enviar_error('Verificación de captcha inválida. Intenta de nuevo.', 400)
                return

            import hashlib
            hash_contrasena = hashlib.sha256(contrasena.encode('utf-8')).hexdigest()

            import secrets
            codigo_verificacion = f"{secrets.randbelow(1000000):06d}"

            cursor = conexion.cursor()
            cursor.execute(
                "INSERT INTO usuarios "
                "(nombre_completo, correo, contrasenia_hash, rol, correo_verificado, "
                "codigo_verificacion, codigo_verificacion_expira) "
                "VALUES (%s, %s, %s, %s, 0, %s, DATE_ADD(NOW(), INTERVAL 15 MINUTE))",
                (nombre, correo, hash_contrasena, rol, codigo_verificacion)
            )
            conexion.commit()
            id_usuario = cursor.lastrowid
            cursor.close()
            if rol == 'atleta':
                cursor = conexion.cursor()
                cursor.execute(
                    "INSERT INTO pacientes_perfil (id_usuario) VALUES (%s)",
                    (id_usuario,)
                )
                conexion.commit()
                cursor.close()
            elif rol == 'nutriologo':
                cursor = conexion.cursor()
                cursor.execute(
                    "INSERT INTO nutriologos_perfil (id_usuario, cedula) VALUES (%s, %s)",
                    (id_usuario, datos.get('cedula', 'SIN_CEDULA'))
                )
                conexion.commit()
                cursor.close()

            cuerpo_html = f"""
            <html>
                <body style="font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background:#0b0f19;color:#f3f4f6;padding:40px 20px;margin:0;">
                    <div style="max-width:550px;margin:0 auto;background:#111827;padding:40px;border-radius:16px;border:1px solid #1f2937;">
                        <div style="text-align:center;margin-bottom:30px;">
                            <h1 style="color:#ff4757;font-size:28px;font-weight:800;letter-spacing:2px;margin:0;text-transform:uppercase;">
                                Silver<span style="color:#fff;">Back</span>
                            </h1>
                            <div style="height:2px;width:60px;background:#ff4757;margin:12px auto 0;border-radius:2px;"></div>
                        </div>
                        <div style="font-size:15px;line-height:1.6;color:#d1d5db;">
                            <p style="font-size:17px;color:#fff;margin-top:0;">Hola, <strong style="color:#ff4757;">{nombre}</strong>:</p>
                            <p>Gracias por registrarte en SilverBack. Usa este código para verificar tu correo electrónico:</p>
                            <div style="text-align:center;margin:30px 0;">
                                <span style="display:inline-block;background:#1f2937;color:#fff;letter-spacing:6px;
                                             font-size:28px;font-weight:700;padding:14px 28px;border-radius:8px;">
                                    {codigo_verificacion}
                                </span>
                            </div>
                            <p style="font-size:13px;color:#9ca3af;">Este código expira en 15 minutos. Si tú no creaste esta cuenta, ignora este mensaje.</p>
                        </div>
                        <div style="border-top:1px solid #1f2937;margin:30px 0 20px 0;"></div>
                        <p style="font-size:11px;color:#6b7280;text-align:center;">&copy; SilverBack Platform. Todos los derechos reservados.</p>
                    </div>
                </body>
            </html>
            """
            _enviar_correo_smtp(correo, "Verifica tu correo - SilverBack", cuerpo_html)

            self._enviar_json({
                'id_usuario': id_usuario,
                'correo_verificado': False,
                'mensaje': 'Usuario registrado correctamente. Revisa tu correo para verificar tu cuenta.'
            }, 201)
        except Exception as e:
            if 'Duplicate' in str(e):
                self._enviar_error('El correo ya está registrado', 409)
            else:
                self._enviar_error(f'Error al registrar usuario: {str(e)}', 500)
        finally:
            cerrar_conexion(conexion)

    def _verificar_correo(self):
        datos = self._leer_cuerpo()
        correo = datos.get('correo')
        codigo = datos.get('codigo')
        if not correo or not codigo:
            self._enviar_error('Campos requeridos: correo, codigo', 400)
            return
        conexion = obtener_conexion()
        if not conexion:
            self._enviar_error('Error de conexión a la base de datos', 500)
            return
        try:
            cursor = conexion.cursor(dictionary=True)
            cursor.execute(
                "SELECT id_usuario, correo_verificado, codigo_verificacion, codigo_verificacion_expira "
                "FROM usuarios WHERE correo = %s",
                (correo,)
            )
            usuario = cursor.fetchone()
            cursor.close()
            if not usuario:
                self._enviar_error('Correo no registrado', 404)
                return
            if usuario['correo_verificado']:
                self._enviar_json({'mensaje': 'Este correo ya estaba verificado.'})
                return
            if not usuario['codigo_verificacion'] or usuario['codigo_verificacion'] != codigo:
                self._enviar_error('Código de verificación inválido.', 400)
                return
            if usuario['codigo_verificacion_expira'] and usuario['codigo_verificacion_expira'] < datetime.datetime.now():
                self._enviar_error('El código ha expirado. Solicita uno nuevo.', 400)
                return
            cur = conexion.cursor()
            cur.execute(
                "UPDATE usuarios SET correo_verificado=1, codigo_verificacion=NULL, "
                "codigo_verificacion_expira=NULL WHERE id_usuario=%s",
                (usuario['id_usuario'],)
            )
            conexion.commit()
            cur.close()
            self._enviar_json({'mensaje': 'Correo verificado correctamente. Ya puedes iniciar sesión.'})
        except Exception as e:
            self._enviar_error(f'Error al verificar correo: {str(e)}', 500)
        finally:
            cerrar_conexion(conexion)

    def _reenviar_codigo_verificacion(self):
        datos = self._leer_cuerpo()
        correo = datos.get('correo')
        if not correo:
            self._enviar_error('El correo electrónico es requerido', 400)
            return
        conexion = obtener_conexion()
        if not conexion:
            self._enviar_error('Error de conexión a la base de datos', 500)
            return
        try:
            cursor = conexion.cursor(dictionary=True)
            cursor.execute(
                "SELECT id_usuario, nombre_completo, correo_verificado FROM usuarios WHERE correo = %s",
                (correo,)
            )
            usuario = cursor.fetchone()
            cursor.close()
            if not usuario:
                self._enviar_error('Correo no registrado', 404)
                return
            if usuario['correo_verificado']:
                self._enviar_json({'mensaje': 'Este correo ya estaba verificado.'})
                return

            import secrets
            codigo_verificacion = f"{secrets.randbelow(1000000):06d}"
            cur = conexion.cursor()
            cur.execute(
                "UPDATE usuarios SET codigo_verificacion=%s, "
                "codigo_verificacion_expira=DATE_ADD(NOW(), INTERVAL 15 MINUTE) WHERE id_usuario=%s",
                (codigo_verificacion, usuario['id_usuario'])
            )
            conexion.commit()
            cur.close()

            cuerpo_html = f"""
            <html>
                <body style="font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background:#0b0f19;color:#f3f4f6;padding:40px 20px;margin:0;">
                    <div style="max-width:550px;margin:0 auto;background:#111827;padding:40px;border-radius:16px;border:1px solid #1f2937;">
                        <div style="text-align:center;margin-bottom:30px;">
                            <h1 style="color:#ff4757;font-size:28px;font-weight:800;letter-spacing:2px;margin:0;text-transform:uppercase;">
                                Silver<span style="color:#fff;">Back</span>
                            </h1>
                            <div style="height:2px;width:60px;background:#ff4757;margin:12px auto 0;border-radius:2px;"></div>
                        </div>
                        <div style="font-size:15px;line-height:1.6;color:#d1d5db;">
                            <p style="font-size:17px;color:#fff;margin-top:0;">Hola, <strong style="color:#ff4757;">{usuario['nombre_completo']}</strong>:</p>
                            <p>Aquí tienes tu nuevo código de verificación:</p>
                            <div style="text-align:center;margin:30px 0;">
                                <span style="display:inline-block;background:#1f2937;color:#fff;letter-spacing:6px;
                                             font-size:28px;font-weight:700;padding:14px 28px;border-radius:8px;">
                                    {codigo_verificacion}
                                </span>
                            </div>
                            <p style="font-size:13px;color:#9ca3af;">Este código expira en 15 minutos.</p>
                        </div>
                        <div style="border-top:1px solid #1f2937;margin:30px 0 20px 0;"></div>
                        <p style="font-size:11px;color:#6b7280;text-align:center;">&copy; SilverBack Platform. Todos los derechos reservados.</p>
                    </div>
                </body>
            </html>
            """
            _enviar_correo_smtp(correo, "Nuevo código de verificación - SilverBack", cuerpo_html)

            self._enviar_json({'mensaje': 'Se ha enviado un nuevo código a tu correo electrónico.'})
        except Exception as e:
            self._enviar_error(f'Error al reenviar código: {str(e)}', 500)
        finally:
            cerrar_conexion(conexion)

    def _solicitar_recuperacion_password(self):
        datos = self._leer_cuerpo()
        correo = datos.get('correo')
        if not correo:
            self._enviar_error('El correo electrónico es requerido', 400)
            return
        conexion = obtener_conexion()
        if not conexion:
            self._enviar_error('Error de conexión a la base de datos', 500)
            return
        try:
            cursor = conexion.cursor(dictionary=True)
            cursor.execute("SELECT id_usuario, nombre_completo FROM usuarios WHERE correo = %s", (correo,))
            usuario = cursor.fetchone()
            cursor.close()
            if not usuario:
                self._enviar_error('El correo no está registrado en el sistema', 404)
                return
            import secrets
            token = secrets.token_hex(32)
            cur = conexion.cursor()
            cur.execute(
                "UPDATE usuarios SET token_recuperacion=%s, "
                "token_recuperacion_expira=DATE_ADD(NOW(), INTERVAL 1 HOUR) "
                "WHERE id_usuario=%s",
                (token, usuario['id_usuario'])
            )
            conexion.commit()
            cur.close()

            # ── Enviar email con link de restablecimiento ──
            enlace = f"{FRONTEND_URL}/restablecer?token={token}&correo={correo}"

            cuerpo_html = f"""
            <html>
                <body style="font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background:#0b0f19;color:#f3f4f6;padding:40px 20px;margin:0;">
                    <div style="max-width:550px;margin:0 auto;background:#111827;padding:40px;border-radius:16px;border:1px solid #1f2937;">
                        <div style="text-align:center;margin-bottom:30px;">
                            <h1 style="color:#ff4757;font-size:28px;font-weight:800;letter-spacing:2px;margin:0;text-transform:uppercase;">
                                Silver<span style="color:#fff;">Back</span>
                            </h1>
                            <div style="height:2px;width:60px;background:#ff4757;margin:12px auto 0;border-radius:2px;"></div>
                        </div>
                        <div style="font-size:15px;line-height:1.6;color:#d1d5db;">
                            <p style="font-size:17px;color:#fff;margin-top:0;">Hola, <strong style="color:#ff4757;">{usuario['nombre_completo']}</strong>:</p>
                            <p>Recibimos una solicitud para restablecer tu contraseña. Haz clic en el botón de abajo para crear una nueva:</p>
                            <div style="text-align:center;margin:30px 0;">
                                <a href="{enlace}"
                                   style="display:inline-block;background:#ff4757;color:#fff;text-decoration:none;
                                          font-size:16px;font-weight:600;padding:14px 36px;border-radius:8px;">
                                    Restablecer Contraseña
                                </a>
                            </div>
                            <p style="font-size:13px;color:#9ca3af;">Este enlace expira en 1 hora. Si no solicitaste este cambio, ignora este mensaje.</p>
                        </div>
                        <div style="border-top:1px solid #1f2937;margin:30px 0 20px 0;"></div>
                        <p style="font-size:11px;color:#6b7280;text-align:center;">&copy; SilverBack Platform. Todos los derechos reservados.</p>
                    </div>
                </body>
            </html>
            """
            _enviar_correo_smtp(correo, "Restablecer Contraseña - SilverBack", cuerpo_html)

            self._enviar_json({
                'mensaje': 'Se ha enviado un enlace de recuperación a tu correo electrónico.'
            })
        except Exception as e:
            self._enviar_error(f'Error al solicitar recuperación: {str(e)}', 500)
        finally:
            cerrar_conexion(conexion)

    def _cambiar_password(self):
        datos = self._leer_cuerpo()
        correo = datos.get('correo')
        token = datos.get('token')
        nueva_contrasena = datos.get('nueva_contrasena')
        if not all([correo, token, nueva_contrasena]):
            self._enviar_error('Campos requeridos: correo, token, nueva_contrasena', 400)
            return
        if len(nueva_contrasena) < 6:
            self._enviar_error('La contraseña debe tener al menos 6 caracteres', 400)
            return
        conexion = obtener_conexion()
        if not conexion:
            self._enviar_error('Error de conexión a la base de datos', 500)
            return
        try:
            cursor = conexion.cursor(dictionary=True)
            cursor.execute(
                "SELECT id_usuario, token_recuperacion, token_recuperacion_expira "
                "FROM usuarios WHERE correo = %s",
                (correo,)
            )
            usuario = cursor.fetchone()
            cursor.close()
            if not usuario:
                self._enviar_error('Correo no registrado', 404)
                return
            if not usuario['token_recuperacion'] or usuario['token_recuperacion'] != token:
                self._enviar_error('Token de recuperación inválido.', 400)
                return
            if usuario['token_recuperacion_expira'] and usuario['token_recuperacion_expira'] < datetime.datetime.now():
                self._enviar_error('El token ha expirado. Solicita uno nuevo.', 400)
                return
            import hashlib
            hash_nueva = hashlib.sha256(nueva_contrasena.encode('utf-8')).hexdigest()
            cur = conexion.cursor()
            cur.execute(
                "UPDATE usuarios SET contrasenia_hash=%s, token_recuperacion=NULL, "
                "token_recuperacion_expira=NULL WHERE id_usuario=%s",
                (hash_nueva, usuario['id_usuario'])
            )
            conexion.commit()
            cur.close()
            self._enviar_json({'mensaje': 'Contraseña actualizada correctamente. Ya puedes iniciar sesión.'})
        except Exception as e:
            self._enviar_error(f'Error al cambiar contraseña: {str(e)}', 500)
        finally:
            cerrar_conexion(conexion)

    def _guardar_habito(self):
        datos = self._leer_cuerpo()
        id_paciente = datos.get('id_paciente')
        fecha = datos.get('fecha')
        peso = datos.get('peso')
        agua = datos.get('agua_litros')
        calorias = datos.get('calorias_consumidas')

        if not id_paciente or not fecha:
            self._enviar_error('Campos requeridos: id_paciente, fecha', 400)
            return

        conexion = obtener_conexion()
        if not conexion:
            self._enviar_error('Error de conexión a la base de datos', 500)
            return
        try:
            cursor = conexion.cursor()
            cursor.execute(
                """INSERT INTO registro_habitos (id_paciente, fecha, peso, agua_litros, calorias_consumidas)
                   VALUES (%s, %s, %s, %s, %s)
                   ON DUPLICATE KEY UPDATE peso = VALUES(peso), agua_litros = VALUES(agua_litros),
                   calorias_consumidas = VALUES(calorias_consumidas)""",
                (id_paciente, fecha, peso, agua, calorias)
            )
            conexion.commit()
            cursor.close()
            self._enviar_json({'mensaje': 'Hábito guardado correctamente'})
        except Exception as e:
            self._enviar_error(f'Error al guardar hábito: {str(e)}', 500)
        finally:
            cerrar_conexion(conexion)

    def _crear_cita(self):
        datos = self._leer_cuerpo()
        id_paciente = datos.get('id_paciente')
        id_nutriologo = datos.get('id_nutriologo')
        fecha = datos.get('fecha')
        hora = datos.get('hora')
        tipo = datos.get('tipo', 'presencial')
        ubicacion = datos.get('ubicacion')
        notas = datos.get('notas')
        if not all([id_paciente, id_nutriologo, fecha, hora]):
            self._enviar_error('Campos requeridos: id_paciente, id_nutriologo, fecha, hora', 400)
            return
        if tipo not in ('videollamada', 'presencial'):
            self._enviar_error('Tipo debe ser videollamada o presencial', 400)
            return

        # Para citas por videollamada se genera automáticamente una sala de
        # videollamada única (Jitsi Meet, no requiere cuenta ni API key).
        enlace_videollamada = None
        if tipo == 'videollamada':
            token = secrets.token_urlsafe(9).replace('-', '').replace('_', '')
            enlace_videollamada = f"https://meet.jit.si/SilverBack-{token}"

        conexion = obtener_conexion()
        if not conexion:
            self._enviar_error('Error de conexión a la base de datos', 500)
            return
        try:
            cursor = conexion.cursor(dictionary=True)
            cursor.execute(
                "INSERT INTO citas (id_paciente, id_nutriologo, fecha, hora, tipo, ubicacion, enlace_videollamada, notas) "
                "VALUES (%s, %s, %s, %s, %s, %s, %s, %s)",
                (id_paciente, id_nutriologo, fecha, hora, tipo, ubicacion, enlace_videollamada, notas)
            )
            conexion.commit()
            id_cita = cursor.lastrowid

            # Notificar al paciente de que se le asignó una nueva cita.
            cursor.execute(
                "SELECT up.id_usuario, up.nombre_completo AS nombre_paciente, un.nombre_completo AS nombre_nutriologo "
                "FROM pacientes_perfil pp "
                "JOIN usuarios up ON up.id_usuario = pp.id_usuario "
                "JOIN nutriologos_perfil np ON np.id_nutriologo = %s "
                "JOIN usuarios un ON un.id_usuario = np.id_usuario "
                "WHERE pp.id_paciente = %s",
                (id_nutriologo, id_paciente)
            )
            fila = cursor.fetchone()
            cursor.close()

            if fila:
                fecha_legible = fecha
                try:
                    fecha_legible = datetime.datetime.strptime(str(fecha), '%Y-%m-%d').strftime('%d/%m/%Y')
                except Exception:
                    pass
                tipo_legible = 'una videollamada' if tipo == 'videollamada' else 'una cita presencial'
                self._crear_notificacion(
                    fila['id_usuario'],
                    'cita_creada',
                    'Nueva cita agendada',
                    f"{fila['nombre_nutriologo']} te agendó {tipo_legible} el {fecha_legible} a las {str(hora)[:5]}.",
                    '/citas'
                )

            self._enviar_json({
                'id_cita': id_cita,
                'enlace_videollamada': enlace_videollamada,
                'mensaje': 'Cita creada correctamente'
            }, 201)
        except Exception as e:
            self._enviar_error(f'Error al crear cita: {str(e)}', 500)
        finally:
            cerrar_conexion(conexion)

    # ─── API PUT ─────────────────────────────────────────────────────────────

    def _manejar_api_put(self, partes, ruta):
        if len(partes) >= 4 and partes[2] == 'comidas':
            self._actualizar_comida(partes[3])
        elif len(partes) >= 4 and partes[2] == 'citas':
            self._actualizar_cita(partes[3])
        elif len(partes) >= 4 and partes[2] == 'usuario':
            self._actualizar_usuario(partes)
        elif len(partes) >= 5 and partes[2] == 'admin' and partes[3] == 'usuarios':
            self._admin_actualizar_usuario(partes[4])
        elif len(partes) >= 4 and partes[2] == 'mensajes' and partes[3] == 'leidos':
            self._marcar_mensajes_leidos()
        elif len(partes) >= 5 and partes[2] == 'notificaciones' and partes[4] == 'leida':
            self._marcar_notificacion_leida(partes[3])
        elif len(partes) >= 4 and partes[2] == 'notificaciones' and partes[3] == 'leidas':
            self._marcar_notificaciones_leidas()
        else:
            self._enviar_error('Ruta API no encontrada', 404)

    def _actualizar_comida(self, id_comida):
        datos = self._leer_cuerpo()
        conexion = obtener_conexion()
        if not conexion:
            self._enviar_error('Error de conexión a la base de datos', 500)
            return
        try:
            cursor = conexion.cursor()
            campos = []
            valores = []
            for campo in ('tipo_comida', 'nombre_alimento', 'cantidad', 'unidad',
                          'calorias_totales', 'proteinas_totales', 'grasas_totales', 'carbohidratos_totales'):
                if campo in datos:
                    campos.append(f"{campo} = %s")
                    valores.append(datos[campo])
            if not campos:
                self._enviar_error('No hay campos para actualizar', 400)
                return
            valores.append(id_comida)
            cursor.execute(
                f"UPDATE comidas_diarias SET {', '.join(campos)} WHERE id_comida = %s",
                valores
            )
            conexion.commit()
            cursor.close()
            self._enviar_json({'mensaje': 'Comida actualizada correctamente'})
        except Exception as e:
            self._enviar_error(f'Error al actualizar comida: {str(e)}', 500)
        finally:
            cerrar_conexion(conexion)

    def _actualizar_cita(self, id_cita):
        datos = self._leer_cuerpo()
        estado = datos.get('estado')
        if not estado:
            self._enviar_error('Campo "estado" requerido', 400)
            return
        conexion = obtener_conexion()
        if not conexion:
            self._enviar_error('Error de conexión a la base de datos', 500)
            return
        try:
            cursor = conexion.cursor()
            cursor.execute("UPDATE citas SET estado = %s WHERE id_cita = %s", (estado, id_cita))
            conexion.commit()
            cursor.close()
            self._enviar_json({'mensaje': 'Cita actualizada correctamente'})
        except Exception as e:
            self._enviar_error(f'Error al actualizar cita: {str(e)}', 500)
        finally:
            cerrar_conexion(conexion)

    def _actualizar_usuario(self, partes):
        if len(partes) < 4:
            self._enviar_error('ID de usuario requerido', 400)
            return
        id_usuario = partes[3]
        datos = self._leer_cuerpo()
        conexion = obtener_conexion()
        if not conexion:
            self._enviar_error('Error de conexión a la base de datos', 500)
            return
        try:
            cursor = conexion.cursor()
            campos_permitidos = ('nombre_completo', 'correo')
            actualizaciones = []
            valores = []
            for campo in campos_permitidos:
                if campo in datos:
                    actualizaciones.append(f"{campo} = %s")
                    valores.append(datos[campo])
            if actualizaciones:
                valores.append(id_usuario)
                cursor.execute(
                    f"UPDATE usuarios SET {', '.join(actualizaciones)} WHERE id_usuario = %s",
                    valores
                )
                conexion.commit()
            cursor.close()
            self._enviar_json({'mensaje': 'Usuario actualizado correctamente'})
        except Exception as e:
            self._enviar_error(f'Error al actualizar usuario: {str(e)}', 500)
        finally:
            cerrar_conexion(conexion)

    def _subir_foto_perfil(self, id_usuario):
        datos = self._leer_cuerpo()
        imagen_b64 = datos.get('imagen')
        if not imagen_b64:
            self._enviar_error('Campo "imagen" requerido', 400)
            return

        # Acepta tanto "data:image/png;base64,...." como el base64 puro.
        if imagen_b64.strip().lower().startswith('data:') and ',' in imagen_b64:
            imagen_b64 = imagen_b64.split(',', 1)[1]

        import base64, uuid
        try:
            datos_binarios = base64.b64decode(imagen_b64, validate=True)
        except Exception:
            self._enviar_error('La imagen no es un base64 válido', 400)
            return

        if len(datos_binarios) == 0:
            self._enviar_error('La imagen está vacía', 400)
            return
        if len(datos_binarios) > TAMANO_MAX_FOTO:
            self._enviar_error('La imagen supera el tamaño máximo permitido (3 MB)', 400)
            return

        # Se valida el contenido real del archivo (magic bytes), no solo la extensión declarada.
        extension = _detectar_tipo_imagen(datos_binarios)
        if not extension:
            self._enviar_error('Formato de imagen no soportado. Usa JPG, PNG, GIF o WEBP.', 400)
            return

        conexion = obtener_conexion()
        if not conexion:
            self._enviar_error('Error de conexión a la base de datos', 500)
            return
        try:
            cursor = conexion.cursor(dictionary=True)
            cursor.execute("SELECT foto_perfil FROM usuarios WHERE id_usuario = %s", (id_usuario,))
            fila = cursor.fetchone()
            if not fila:
                cursor.close()
                self._enviar_error('Usuario no encontrado', 404)
                return
            foto_anterior = fila.get('foto_perfil')

            nombre_archivo = f"usuario_{id_usuario}_{uuid.uuid4().hex}.{extension}"
            ruta_archivo = os.path.join(RUTA_FOTOS_PERFIL, nombre_archivo)
            with open(ruta_archivo, 'wb') as f:
                f.write(datos_binarios)

            ruta_publica = f"/uploads/perfil/{nombre_archivo}"
            cursor.execute("UPDATE usuarios SET foto_perfil = %s WHERE id_usuario = %s", (ruta_publica, id_usuario))
            conexion.commit()
            cursor.close()

            # Borra la foto anterior del disco (si existía) para no acumular archivos huérfanos.
            if foto_anterior and foto_anterior.startswith('/uploads/perfil/'):
                ruta_anterior = os.path.join(RUTA_UPLOADS, foto_anterior[len('/uploads/'):])
                if os.path.exists(ruta_anterior):
                    try:
                        os.remove(ruta_anterior)
                    except OSError:
                        pass

            self._enviar_json({'mensaje': 'Foto de perfil actualizada correctamente', 'foto_perfil': ruta_publica})
        except Exception as e:
            self._enviar_error(f'Error al subir la foto de perfil: {str(e)}', 500)
        finally:
            cerrar_conexion(conexion)

    def _eliminar_foto_perfil(self, id_usuario):
        conexion = obtener_conexion()
        if not conexion:
            self._enviar_error('Error de conexión a la base de datos', 500)
            return
        try:
            cursor = conexion.cursor(dictionary=True)
            cursor.execute("SELECT foto_perfil FROM usuarios WHERE id_usuario = %s", (id_usuario,))
            fila = cursor.fetchone()
            if not fila:
                cursor.close()
                self._enviar_error('Usuario no encontrado', 404)
                return
            foto_actual = fila.get('foto_perfil')
            cursor.execute("UPDATE usuarios SET foto_perfil = NULL WHERE id_usuario = %s", (id_usuario,))
            conexion.commit()
            cursor.close()
            if foto_actual and foto_actual.startswith('/uploads/perfil/'):
                ruta_archivo = os.path.join(RUTA_UPLOADS, foto_actual[len('/uploads/'):])
                if os.path.exists(ruta_archivo):
                    try:
                        os.remove(ruta_archivo)
                    except OSError:
                        pass
            self._enviar_json({'mensaje': 'Foto de perfil eliminada correctamente'})
        except Exception as e:
            self._enviar_error(f'Error al eliminar la foto de perfil: {str(e)}', 500)
        finally:
            cerrar_conexion(conexion)

    def _admin_actualizar_usuario(self, id_usuario):
        datos = self._leer_cuerpo()
        conexion = obtener_conexion()
        if not conexion:
            self._enviar_error('Error de conexión a la base de datos', 500)
            return
        try:
            cursor = conexion.cursor()
            campos_permitidos = ('nombre_completo', 'correo', 'rol', 'activo')
            actualizaciones = []
            valores = []
            for campo in campos_permitidos:
                if campo in datos:
                    actualizaciones.append(f"{campo} = %s")
                    valores.append(datos[campo])
            if not actualizaciones:
                self._enviar_error('No hay campos para actualizar', 400)
                return
            valores.append(id_usuario)
            cursor.execute(
                f"UPDATE usuarios SET {', '.join(actualizaciones)} WHERE id_usuario = %s",
                valores
            )
            conexion.commit()
            cursor.close()
            self._enviar_json({'mensaje': 'Usuario actualizado correctamente'})
        except Exception as e:
            self._enviar_error(f'Error al actualizar usuario: {str(e)}', 500)
        finally:
            cerrar_conexion(conexion)

    def _admin_eliminar_usuario(self, id_usuario):
        conexion = obtener_conexion()
        if not conexion:
            self._enviar_error('Error de conexión a la base de datos', 500)
            return
        try:
            cursor = conexion.cursor()
            cursor.execute("DELETE FROM usuarios WHERE id_usuario = %s", (id_usuario,))
            conexion.commit()
            cursor.close()
            self._enviar_json({'mensaje': 'Usuario eliminado correctamente'})
        except Exception as e:
            self._enviar_error(f'Error al eliminar usuario: {str(e)}', 500)
        finally:
            cerrar_conexion(conexion)

    # ─── API DELETE ───────────────────────────────────────────────────────────

    def _manejar_api_delete(self, partes, ruta):
        if len(partes) >= 4 and partes[2] == 'comidas':
            self._eliminar_comida(partes[3])
        elif len(partes) >= 4 and partes[2] == 'citas':
            self._eliminar_cita(partes[3])
        elif len(partes) >= 5 and partes[2] == 'admin' and partes[3] == 'usuarios':
            self._admin_eliminar_usuario(partes[4])
        elif len(partes) >= 4 and partes[2] == 'dieta':
            self._desactivar_dieta(partes[3])
        elif len(partes) >= 4 and partes[2] == 'rutina':
            self._desactivar_rutina(partes[3])
        elif len(partes) >= 5 and partes[2] == 'usuario' and partes[4] == 'foto':
            self._eliminar_foto_perfil(partes[3])
        else:
            self._enviar_error('Ruta API no encontrada', 404)

    def _eliminar_comida(self, id_comida):
        conexion = obtener_conexion()
        if not conexion:
            self._enviar_error('Error de conexión a la base de datos', 500)
            return
        try:
            cursor = conexion.cursor()
            cursor.execute("DELETE FROM comidas_diarias WHERE id_comida = %s", (id_comida,))
            conexion.commit()
            cursor.close()
            self._enviar_json({'mensaje': 'Comida eliminada correctamente'})
        except Exception as e:
            self._enviar_error(f'Error al eliminar comida: {str(e)}', 500)
        finally:
            cerrar_conexion(conexion)

    def _eliminar_cita(self, id_cita):
        conexion = obtener_conexion()
        if not conexion:
            self._enviar_error('Error de conexión a la base de datos', 500)
            return
        try:
            cursor = conexion.cursor()
            cursor.execute("DELETE FROM citas WHERE id_cita = %s", (id_cita,))
            conexion.commit()
            cursor.close()
            self._enviar_json({'mensaje': 'Cita cancelada correctamente'})
        except Exception as e:
            self._enviar_error(f'Error al cancelar cita: {str(e)}', 500)
        finally:
            cerrar_conexion(conexion)

    # ─── ARCHIVOS ESTÁTICOS ──────────────────────────────────────────────────

    def _servir_archivo_subido(self, ruta):
        """Sirve archivos de la carpeta uploads (p. ej. fotos de perfil).
        Evita path traversal validando que la ruta resuelta siga dentro de RUTA_UPLOADS."""
        ruta_relativa = ruta[len('/uploads/'):]
        ruta_archivo = os.path.normpath(os.path.join(RUTA_UPLOADS, ruta_relativa))
        if not ruta_archivo.startswith(os.path.normpath(RUTA_UPLOADS) + os.sep):
            self._enviar_error('Ruta inválida', 400)
            return
        if not os.path.exists(ruta_archivo) or os.path.isdir(ruta_archivo):
            self._enviar_error('Archivo no encontrado', 404)
            return
        extension = os.path.splitext(ruta_archivo)[1].lower()
        tipos_mime = {
            '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
            '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp',
        }
        tipo_mime = tipos_mime.get(extension, 'application/octet-stream')
        try:
            with open(ruta_archivo, 'rb') as f:
                contenido = f.read()
            self.send_response(200)
            self.send_header('Content-Type', tipo_mime)
            self.send_header('Content-Length', str(len(contenido)))
            self.send_header('Cache-Control', 'no-cache')
            self._enviar_cors()
            self.end_headers()
            self.wfile.write(contenido)
        except IOError:
            self._enviar_error('Archivo no encontrado', 404)

    def _servir_estatico(self, ruta):
        if ruta == '' or ruta == '/':
            ruta = '/index.html'
        ruta_archivo = os.path.join(RUTA_FRONTEND, ruta.lstrip('/'))
        if not os.path.exists(ruta_archivo) or os.path.isdir(ruta_archivo):
            ruta_archivo = os.path.join(RUTA_FRONTEND, 'index.html')
        if not os.path.exists(ruta_archivo):
            self._enviar_error('Archivo no encontrado', 404)
            return
        extension = os.path.splitext(ruta_archivo)[1]
        tipos_mime = {
            '.html': 'text/html; charset=utf-8',
            '.css': 'text/css; charset=utf-8',
            '.js': 'application/javascript; charset=utf-8',
            '.json': 'application/json; charset=utf-8',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml',
            '.ico': 'image/x-icon',
            '.woff': 'font/woff',
            '.woff2': 'font/woff2',
        }
        tipo_mime = tipos_mime.get(extension, 'application/octet-stream')
        try:
            with open(ruta_archivo, 'rb') as f:
                contenido = f.read()
            self.send_response(200)
            self.send_header('Content-Type', tipo_mime)
            self.send_header('Content-Length', str(len(contenido)))
            self._enviar_cors()
            self.end_headers()
            self.wfile.write(contenido)
        except IOError:
            self._enviar_error('Archivo no encontrado', 404)

    def log_message(self, format, *args):
        print(f'[Servidor] {args[0]} {args[1]} {args[2]}')


def main():
    print(f'[Servidor] Iniciando SilverBack API en http://localhost:{PUERTO}')
    print(f'[Servidor] Sirviendo frontend desde: {RUTA_FRONTEND}')

    # Inicializar base de datos si no existe
    inicializar_base_datos()

    # Crear tablas y datos de prueba
    ruta_sql = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'base_de_datos.sql')
    if os.path.exists(ruta_sql):
        print(f'[Servidor] Ejecutando script SQL: {ruta_sql}')
        ejecutar_script_sql(ruta_sql)
    else:
        print(f'[Servidor] No se encontró {ruta_sql}, se usarán las tablas existentes si ya fueron creadas.')

    # Las rutinas persisten en BD. El cache local de Wger evita llamadas repetidas.

    servidor = HTTPServer(('0.0.0.0', PUERTO), ManejadorSilverBack)
    try:
        servidor.serve_forever()
    except KeyboardInterrupt:
        print('\n[Servidor] Apagando servidor...')
        servidor.server_close()


if __name__ == '__main__':
    main()
