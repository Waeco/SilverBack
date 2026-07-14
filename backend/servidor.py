import json
import os
import sys
import time
import datetime
import hashlib
import secrets
import hmac
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from configuracion_bd import obtener_conexion, cerrar_conexion, inicializar_base_datos, ejecutar_script_sql
from conector_fatsecret import buscar_alimentos
from conector_wger import buscar_ejercicios, obtener_info_ejercicio

RUTA_FRONTEND = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'frontend', 'dist')
PUERTO = 8000
SECRETO_JWT = os.getenv('JWT_SECRET', 'silverback-secreto-jwt-2026-cambiame')
TIEMPO_EXPIRACION_TOKEN = 86400
INTENTOS_MAXIMOS = 5
TIEMPO_BLOQUEO = 900


class ManejadorSilverBack(BaseHTTPRequestHandler):

    _intentos_fallidos = {}

    def _enviar_json(self, datos, codigo=200):
        self.send_response(codigo)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self._enviar_headers_seguridad()
        self._enviar_cors()
        self.end_headers()
        self.wfile.write(json.dumps(datos, ensure_ascii=False, default=str).encode('utf-8'))

    def _enviar_error(self, mensaje, codigo=400):
        self._enviar_json({'error': mensaje}, codigo)

    def _enviar_headers_seguridad(self):
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('X-Frame-Options', 'DENY')
        self.send_header('X-XSS-Protection', '1; mode=block')
        self.send_header('Referrer-Policy', 'strict-origin-when-cross-origin')
        self.send_header('Permissions-Policy', 'geolocation=(), microphone=(), camera=()')

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

    def _parsear_ruta(self):
        return urlparse(self.path)

    def _generar_token(self, id_usuario, rol):
        import jwt
        payload = {
            'id_usuario': id_usuario,
            'rol': rol,
            'exp': int(time.time()) + TIEMPO_EXPIRACION_TOKEN,
            'iat': int(time.time())
        }
        return jwt.encode(payload, SECRETO_JWT, algorithm='HS256')

    def _verificar_token(self, roles=None):
        auth = self.headers.get('Authorization', '')
        if not auth.startswith('Bearer '):
            self._enviar_error('Token de autorización requerido', 401)
            return None
        token = auth[7:]
        try:
            import jwt
            payload = jwt.decode(token, SECRETO_JWT, algorithms=['HS256'])
            if roles and payload.get('rol') not in roles:
                self._enviar_error('No tienes permiso para acceder a este recurso', 403)
                return None
            return payload
        except jwt.ExpiredSignatureError:
            self._enviar_error('El token ha expirado. Inicia sesión nuevamente.', 401)
            return None
        except jwt.InvalidTokenError:
            self._enviar_error('Token inválido', 401)
            return None

    def do_OPTIONS(self):
        self.send_response(204)
        self._enviar_cors()
        self.end_headers()

    def do_GET(self):
        ruta = self._parsear_ruta()
        partes = ruta.path.rstrip('/').split('/')

        if ruta.path.startswith('/api/'):
            self._manejar_api_get(partes, ruta)
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
        if len(partes) >= 3 and partes[2] == 'salud':
            self._enviar_json({'estado': 'ok', 'timestamp': time.time()})
            return
        if len(partes) >= 3 and partes[2] == 'verificar-correo':
            self._verificar_correo(ruta)
            return

        if not self._verificar_token():
            return

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
        elif len(partes) >= 3 and partes[2] == 'nutriologos':
            self._listar_nutriologos(ruta)
        elif len(partes) >= 3 and partes[2] == 'pacientes':
            self._listar_pacientes(ruta)
        elif len(partes) >= 3 and partes[2] == 'admin' and len(partes) >= 4 and partes[3] == 'stats':
            if not self._verificar_token(roles=['admin']):
                return
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
                "SELECT pp.*, u.nombre_completo, u.correo, u.activo "
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
            cursor.execute("SELECT id_usuario, nombre_completo, correo, rol FROM usuarios WHERE id_usuario = %s", (id_usuario,))
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
                "SELECT id_usuario, nombre_completo, correo, rol, activo, fecha_registro "
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
        if len(partes) >= 3 and partes[2] == 'auth':
            self._iniciar_sesion()
        elif len(partes) >= 3 and partes[2] == 'registro':
            self._registrar_usuario()
        elif len(partes) >= 3 and partes[2] == 'recuperar-password':
            self._solicitar_recuperacion_password()
        elif len(partes) >= 3 and partes[2] == 'cambiar-password':
            self._cambiar_password()
        elif len(partes) >= 3 and partes[2] == 'upload':
            if not self._verificar_token():
                return
            self._subir_archivo()
        elif len(partes) >= 3 and partes[2] == 'backup':
            if not self._verificar_token(roles=['admin']):
                return
            self._generar_backup()
        elif not self._verificar_token():
            return
        elif len(partes) >= 3 and partes[2] == 'comidas':
            self._guardar_comida()
        elif len(partes) >= 3 and partes[2] == 'habitos':
            self._guardar_habito()
        elif len(partes) >= 3 and partes[2] == 'citas':
            self._crear_cita()
        elif len(partes) >= 3 and partes[2] == 'dieta':
            if not self._verificar_token(roles=['nutriologo', 'admin']):
                return
            self._asignar_dieta()
        elif len(partes) >= 3 and partes[2] == 'rutina':
            if not self._verificar_token(roles=['nutriologo', 'admin']):
                return
            self._asignar_rutina()
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

    def _iniciar_sesion(self):
        datos = self._leer_cuerpo()
        correo = datos.get('correo')
        contrasena = datos.get('contrasena')
        if not correo or not contrasena:
            self._enviar_error('Correo y contraseña requeridos', 400)
            return

        ip = self.client_address[0]
        ahora = time.time()
        intento = ManejadorSilverBack._intentos_fallidos.get(ip)
        if intento:
            if intento['count'] >= INTENTOS_MAXIMOS and ahora < intento['reset']:
                restante = int(intento['reset'] - ahora)
                self._enviar_error(
                    f'Demasiados intentos fallidos. Intenta de nuevo en {restante} segundos.',
                    429
                )
                return
            if ahora >= intento['reset']:
                del ManejadorSilverBack._intentos_fallidos[ip]

        conexion = obtener_conexion()
        if not conexion:
            self._enviar_error('Error de conexión a la base de datos', 500)
            return
        try:
            cursor = conexion.cursor(dictionary=True)
            cursor.execute("SELECT * FROM usuarios WHERE correo = %s", (correo,))
            usuario = cursor.fetchone()
            cursor.close()
            if not usuario:
                self._registrar_intento_fallido(ip, ahora)
                self._enviar_error('Credenciales inválidas', 401)
                return
            hash_ingresada = hashlib.sha256(contrasena.encode('utf-8')).hexdigest()
            if usuario['contrasenia_hash'] != hash_ingresada:
                self._registrar_intento_fallido(ip, ahora)
                self._enviar_error('Credenciales inválidas', 401)
                return

            if ip in ManejadorSilverBack._intentos_fallidos:
                del ManejadorSilverBack._intentos_fallidos[ip]

            token = self._generar_token(usuario['id_usuario'], usuario['rol'])
            self._enviar_json({
                'token': token,
                'usuario': {
                    'id_usuario': usuario['id_usuario'],
                    'nombre_completo': usuario['nombre_completo'],
                    'correo': usuario['correo'],
                    'rol': usuario['rol']
                }
            })
        except Exception as e:
            self._enviar_error(f'Error al iniciar sesión: {str(e)}', 500)
        finally:
            cerrar_conexion(conexion)

    def _registrar_intento_fallido(self, ip, ahora):
        intento = ManejadorSilverBack._intentos_fallidos.get(ip)
        if intento:
            intento['count'] += 1
        else:
            ManejadorSilverBack._intentos_fallidos[ip] = {
                'count': 1,
                'reset': ahora + TIEMPO_BLOQUEO
            }

    def _registrar_usuario(self):
        datos = self._leer_cuerpo()
        nombre = datos.get('nombre_completo')
        correo = datos.get('correo')
        contrasena = datos.get('contrasena')
        rol = datos.get('rol', 'atleta')

        if not all([nombre, correo, contrasena]):
            self._enviar_error('Campos requeridos: nombre_completo, correo, contrasena', 400)
            return

        import hashlib
        hash_contrasena = hashlib.sha256(contrasena.encode('utf-8')).hexdigest()

        conexion = obtener_conexion()
        if not conexion:
            self._enviar_error('Error de conexión a la base de datos', 500)
            return
        try:
            cursor = conexion.cursor()
            cursor.execute(
                "INSERT INTO usuarios (nombre_completo, correo, contrasenia_hash, rol) VALUES (%s, %s, %s, %s)",
                (nombre, correo, hash_contrasena, rol)
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
            token_verificacion = secrets.token_hex(32)
            cur = conexion.cursor()
            cur.execute(
                "UPDATE usuarios SET token_verificacion_correo=%s WHERE id_usuario=%s",
                (token_verificacion, id_usuario)
            )
            conexion.commit()
            cur.close()

            self._enviar_json({'id_usuario': id_usuario, 'mensaje': 'Usuario registrado correctamente. Revisa tu correo para verificar tu cuenta.'}, 201)

            def enviar_verificacion():
                try:
                    import smtplib
                    from email.mime.text import MIMEText
                    from email.mime.multipart import MIMEMultipart
                    REMITENTE_CORREO = os.getenv('SMTP_EMAIL', 'sebastianorozcoperez2108@gmail.com')
                    REMITENTE_PASSWORD = os.getenv('SMTP_PASSWORD', 'qvij lwef sufl rtwm')
                    enlace = f"http://localhost:8000/api/verificar-correo?token={token_verificacion}&id={id_usuario}"
                    mensaje = MIMEMultipart()
                    mensaje['From'] = REMITENTE_CORREO
                    mensaje['To'] = correo
                    mensaje['Subject'] = "Verifica tu cuenta - SilverBack"
                    cuerpo_html = f"""
                    <html><body style="font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background:#0b0f19;color:#f3f4f6;padding:40px 20px;margin:0;">
                        <div style="max-width:550px;margin:0 auto;background:#111827;padding:40px;border-radius:16px;border:1px solid #1f2937;">
                            <div style="text-align:center;margin-bottom:30px;">
                                <h1 style="color:#ff4757;font-size:28px;font-weight:800;letter-spacing:2px;margin:0;text-transform:uppercase;">
                                    Silver<span style="color:#fff;">Back</span>
                                </h1>
                                <div style="height:2px;width:60px;background:#ff4757;margin:12px auto 0;border-radius:2px;"></div>
                            </div>
                            <div style="font-size:15px;line-height:1.6;color:#d1d5db;">
                                <p style="font-size:17px;color:#fff;margin-top:0;">Hola, <strong style="color:#ff4757;">{nombre}</strong>:</p>
                                <p>Gracias por registrarte en SilverBack. Para activar tu cuenta, haz clic en el botón de abajo:</p>
                                <div style="text-align:center;margin:30px 0;">
                                    <a href="{enlace}" style="display:inline-block;background:#ff4757;color:#fff;text-decoration:none;font-size:16px;font-weight:600;padding:14px 36px;border-radius:8px;">
                                        Verificar Cuenta
                                    </a>
                                </div>
                                <p style="font-size:13px;color:#9ca3af;">Este enlace expira en 24 horas. Si no creaste esta cuenta, ignora este mensaje.</p>
                            </div>
                            <div style="border-top:1px solid #1f2937;margin:30px 0 20px 0;"></div>
                            <p style="font-size:11px;color:#6b7280;text-align:center;">&copy; SilverBack Platform.</p>
                        </div>
                    </body></html>
                    """
                    mensaje.attach(MIMEText(cuerpo_html, 'html'))
                    servidor_smtp = smtplib.SMTP('smtp.gmail.com', 587, timeout=10)
                    servidor_smtp.starttls()
                    servidor_smtp.login(REMITENTE_CORREO, REMITENTE_PASSWORD)
                    servidor_smtp.sendmail(REMITENTE_CORREO, correo, mensaje.as_string())
                    servidor_smtp.quit()
                except Exception as e:
                    print(f"[EMAIL] Error al enviar verificación: {e}")

            threading.Thread(target=enviar_verificacion, daemon=True).start()
        except Exception as e:
            if 'Duplicate' in str(e):
                self._enviar_error('El correo ya está registrado', 409)
            else:
                self._enviar_error(f'Error al registrar usuario: {str(e)}', 500)
        finally:
            cerrar_conexion(conexion)

    def _verificar_correo(self, ruta):
        params = parse_qs(ruta.query)
        token = params.get('token', [None])[0]
        id_usuario = params.get('id', [None])[0]
        if not token or not id_usuario:
            self._enviar_error('Enlace de verificación inválido', 400)
            return
        conexion = obtener_conexion()
        if not conexion:
            self._enviar_error('Error de conexión a la base de datos', 500)
            return
        try:
            cursor = conexion.cursor(dictionary=True)
            cursor.execute(
                "SELECT id_usuario FROM usuarios WHERE id_usuario=%s AND token_verificacion_correo=%s",
                (id_usuario, token)
            )
            usuario = cursor.fetchone()
            if not usuario:
                cursor.close()
                self._enviar_error('Enlace de verificación inválido o expirado', 400)
                return
            cursor = conexion.cursor()
            cursor.execute(
                "UPDATE usuarios SET correo_verificado=1, token_verificacion_correo=NULL WHERE id_usuario=%s",
                (id_usuario,)
            )
            conexion.commit()
            cursor.close()
            self.send_response(302)
            self.send_header('Location', '/login?verificado=1')
            self.end_headers()
        except Exception as e:
            self._enviar_error(f'Error al verificar correo: {str(e)}', 500)
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

            # Responder inmediatamente antes de enviar el email
            self._enviar_json({
                'mensaje': 'Se ha enviado un enlace de recuperación a tu correo electrónico.'
            })

            # ── Enviar email en segundo plano (no bloquea el servidor) ──
            import smtplib
            from email.mime.text import MIMEText
            from email.mime.multipart import MIMEMultipart
            import threading

            def enviar_email():
                try:
                    REMITENTE_CORREO = os.getenv('SMTP_EMAIL', 'sebastianorozcoperez2108@gmail.com')
                    REMITENTE_PASSWORD = os.getenv('SMTP_PASSWORD', 'qvij lwef sufl rtwm')
                    enlace = f"http://localhost:8000/restablecer?token={token}&correo={correo}"
                    mensaje = MIMEMultipart()
                    mensaje['From'] = REMITENTE_CORREO
                    mensaje['To'] = correo
                    mensaje['Subject'] = "Restablecer Contraseña - SilverBack"
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
                    mensaje.attach(MIMEText(cuerpo_html, 'html'))
                    servidor_smtp = smtplib.SMTP('smtp.gmail.com', 587, timeout=10)
                    servidor_smtp.starttls()
                    servidor_smtp.login(REMITENTE_CORREO, REMITENTE_PASSWORD)
                    servidor_smtp.sendmail(REMITENTE_CORREO, correo, mensaje.as_string())
                    servidor_smtp.quit()
                except Exception as e:
                    print(f"[EMAIL] Error al enviar correo: {e}")

            threading.Thread(target=enviar_email, daemon=True).start()
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
        notas = datos.get('notas')
        if not all([id_paciente, id_nutriologo, fecha, hora]):
            self._enviar_error('Campos requeridos: id_paciente, id_nutriologo, fecha, hora', 400)
            return
        if tipo not in ('videollamada', 'presencial'):
            self._enviar_error('Tipo debe ser videollamada o presencial', 400)
            return
        conexion = obtener_conexion()
        if not conexion:
            self._enviar_error('Error de conexión a la base de datos', 500)
            return
        try:
            cursor = conexion.cursor()
            cursor.execute(
                "INSERT INTO citas (id_paciente, id_nutriologo, fecha, hora, tipo, notas) VALUES (%s, %s, %s, %s, %s, %s)",
                (id_paciente, id_nutriologo, fecha, hora, tipo, notas)
            )
            conexion.commit()
            id_cita = cursor.lastrowid
            cursor.close()
            self._enviar_json({'id_cita': id_cita, 'mensaje': 'Cita creada correctamente'}, 201)
        except Exception as e:
            self._enviar_error(f'Error al crear cita: {str(e)}', 500)
        finally:
            cerrar_conexion(conexion)

    # ─── API PUT ─────────────────────────────────────────────────────────────

    def _manejar_api_put(self, partes, ruta):
        if not self._verificar_token():
            return
        if len(partes) >= 4 and partes[2] == 'comidas':
            self._actualizar_comida(partes[3])
        elif len(partes) >= 4 and partes[2] == 'citas':
            self._actualizar_cita(partes[3])
        elif len(partes) >= 4 and partes[2] == 'usuario':
            self._actualizar_usuario(partes)
        elif len(partes) >= 5 and partes[2] == 'admin' and partes[3] == 'usuarios':
            if not self._verificar_token(roles=['admin']):
                return
            self._admin_actualizar_usuario(partes[4])
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
        if not self._verificar_token():
            return
        if len(partes) >= 5 and partes[2] == 'admin' and partes[3] == 'usuarios':
            if not self._verificar_token(roles=['admin']):
                return
            self._admin_eliminar_usuario(partes[4])
        elif len(partes) >= 4 and partes[2] == 'comidas':
            self._eliminar_comida(partes[3])
        elif len(partes) >= 4 and partes[2] == 'citas':
            self._eliminar_cita(partes[3])
        elif len(partes) >= 4 and partes[2] == 'dieta':
            if not self._verificar_token(roles=['nutriologo', 'admin']):
                return
            self._desactivar_dieta(partes[3])
        elif len(partes) >= 4 and partes[2] == 'rutina':
            if not self._verificar_token(roles=['nutriologo', 'admin']):
                return
            self._desactivar_rutina(partes[3])
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

    # ─── BACKUP ─────────────────────────────────────────────────────────────

    def _generar_backup(self):
        import subprocess
        try:
            timestamp = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
            nombre_archivo = f'backup_silverback_{timestamp}.sql'
            ruta_backup = os.path.join(os.path.dirname(os.path.dirname(__file__)), nombre_archivo)
            resultado = subprocess.run(
                ['mysqldump', '-u', 'root', 'silverback_db', f'--result-file={ruta_backup}'],
                capture_output=True, text=True, timeout=60
            )
            if resultado.returncode == 0:
                self._enviar_json({'mensaje': f'Respaldo creado: {nombre_archivo}', 'archivo': nombre_archivo})
            else:
                self._enviar_error(f'Error al crear respaldo: {resultado.stderr}', 500)
        except FileNotFoundError:
            self._enviar_error('mysqldump no está instalado o no está en el PATH', 500)
        except subprocess.TimeoutExpired:
            self._enviar_error('La operación de respaldo excedió el tiempo límite', 500)
        except Exception as e:
            self._enviar_error(f'Error al generar respaldo: {str(e)}', 500)

    # ─── SUBIDA DE ARCHIVOS ─────────────────────────────────────────────────

    def _subir_archivo(self):
        import cgi
        import io
        try:
            tipo = self.headers.get('Content-Type', '')
            if 'multipart/form-data' not in tipo:
                self._enviar_error('Se require Content-Type multipart/form-data', 400)
                return
            entorno = {
                'REQUEST_METHOD': 'POST',
                'CONTENT_TYPE': tipo,
                'CONTENT_LENGTH': self.headers.get('Content-Length', '0'),
            }
            archivos = cgi.FieldStorage(
                fp=self.rfile,
                headers=self.headers,
                environ=entorno,
                keep_blank_values=True
            )
            campo = archivos.get('archivo')
            if not campo or not campo.filename:
                self._enviar_error('Campo "archivo" requerido con un archivo válido', 400)
                return
            nombre_original = campo.filename
            if not nombre_original.lower().endswith(('.png', '.jpg', '.jpeg', '.gif', '.pdf', '.doc', '.docx')):
                self._enviar_error('Formato de archivo no permitido. Usa: PNG, JPG, PDF, DOC', 400)
                return
            if len(campo.file.read()) > 5 * 1024 * 1024:
                self._enviar_error('El archivo excede el tamaño máximo de 5 MB', 400)
                return
            campo.file.seek(0)
            timestamp = int(time.time())
            nombre_limpio = f"{timestamp}_{nombre_original.replace(' ', '_')}"
            ruta_uploads = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'uploads')
            os.makedirs(ruta_uploads, exist_ok=True)
            ruta_destino = os.path.join(ruta_uploads, nombre_limpio)
            with open(ruta_destino, 'wb') as f:
                f.write(campo.file.read())
            self._enviar_json({
                'mensaje': 'Archivo subido correctamente',
                'archivo': nombre_limpio,
                'url': f'/uploads/{nombre_limpio}'
            }, 201)
        except Exception as e:
            self._enviar_error(f'Error al subir archivo: {str(e)}', 500)

    # ─── ARCHIVOS ESTÁTICOS ──────────────────────────────────────────────────

    def _servir_estatico(self, ruta):
        if ruta == '' or ruta == '/':
            ruta = '/index.html'
        if ruta.startswith('/uploads/'):
            ruta_archivo = os.path.join(os.path.dirname(os.path.dirname(__file__)), ruta.lstrip('/'))
        else:
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
            self._enviar_headers_seguridad()
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

    # ── Migraciones: agrega columnas nuevas sin perder datos ────
    def _aplicar_migraciones():
        conexion = obtener_conexion()
        if not conexion:
            return
        try:
            cursor = conexion.cursor()
            migraciones = [
                "ALTER TABLE usuarios ADD COLUMN token_verificacion_correo VARCHAR(64) DEFAULT NULL",
                "ALTER TABLE usuarios ADD COLUMN correo_verificado TINYINT(1) NOT NULL DEFAULT 0",
            ]
            for sql in migraciones:
                try:
                    cursor.execute(sql)
                    conexion.commit()
                    print(f"[BD] Migración aplicada: {sql[:70]}...")
                except Exception as e:
                    if 'Duplicate column' in str(e) or 'Duplicate' in str(e):
                        pass
                    else:
                        print(f"[BD] Nota: {e}")
            cursor.close()
        except Exception as e:
            print(f"[BD] Error en migraciones: {e}")
        finally:
            cerrar_conexion(conexion)
    _aplicar_migraciones()

    servidor = HTTPServer(('0.0.0.0', PUERTO), ManejadorSilverBack)
    try:
        servidor.serve_forever()
    except KeyboardInterrupt:
        print('\n[Servidor] Apagando servidor...')
        servidor.server_close()


if __name__ == '__main__':
    main()
