import json
import os
import sys
import time
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from configuracion_bd import obtener_conexion, cerrar_conexion
from conector_fatsecret import buscar_alimentos
from conector_wger import buscar_ejercicios

RUTA_FRONTEND = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'frontend', 'dist')
PUERTO = 8000


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
                "SELECT * FROM planes_dieta WHERE id_paciente = %s AND activo = 1 ORDER BY fecha_asignado DESC LIMIT 1",
                (int(id_paciente),)
            )
            plan = cursor.fetchone()
            if not plan:
                cursor.close()
                self._enviar_json({'dieta': None})
                return
            cursor.execute(
                "SELECT * FROM detalles_dieta WHERE id_plan = %s ORDER BY FIELD(tipo_comida, 'desayuno', 'colacion_1', 'comida', 'colacion_2', 'cena')",
                (plan['id_plan'],)
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
            id_plan = cursor.lastrowid
            for d in detalles:
                cursor.execute(
                    """INSERT INTO detalles_dieta
                       (id_plan, tipo_comida, nombre_alimento, cantidad, unidad,
                        calorias_totales, proteinas_totales, grasas_totales, carbohidratos_totales)
                       VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                    (id_plan, d['tipo_comida'], d['nombre_alimento'],
                     d.get('cantidad', 100), d.get('unidad', 'g'),
                     d.get('calorias_totales', 0), d.get('proteinas_totales', 0),
                     d.get('grasas_totales', 0), d.get('carbohidratos_totales', 0))
                )
            conexion.commit()
            cursor.close()
            self._enviar_json({'id_plan': id_plan, 'mensaje': 'Dieta asignada correctamente'}, 201)
        except Exception as e:
            self._enviar_error(f'Error al asignar dieta: {str(e)}', 500)
        finally:
            cerrar_conexion(conexion)

    def _desactivar_dieta(self, id_plan):
        conexion = obtener_conexion()
        if not conexion:
            self._enviar_error('Error de conexión a la base de datos', 500)
            return
        try:
            cursor = conexion.cursor()
            cursor.execute("UPDATE planes_dieta SET activo = 0 WHERE id_plan = %s", (int(id_plan),))
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
                "SELECT * FROM planes_rutina WHERE id_paciente = %s AND activo = 1 ORDER BY fecha_asignado DESC LIMIT 1",
                (int(id_paciente),)
            )
            plan = cursor.fetchone()
            if not plan:
                cursor.close()
                self._enviar_json({'rutina': None})
                return
            cursor.execute(
                "SELECT * FROM detalles_rutina WHERE id_plan = %s ORDER BY orden ASC",
                (plan['id_plan'],)
            )
            detalles = cursor.fetchall()
            cursor.close()
            self._enviar_json({'rutina': plan, 'detalles': detalles})
        except Exception as e:
            self._enviar_error(f'Error al obtener rutina: {str(e)}', 500)
        finally:
            cerrar_conexion(conexion)

    def _asignar_rutina(self):
        datos = self._leer_cuerpo()
        id_paciente = datos.get('id_paciente')
        id_nutriologo = datos.get('id_nutriologo')
        detalles = datos.get('detalles', [])
        if not id_paciente:
            self._enviar_error('Campo requerido: id_paciente', 400)
            return
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
            id_plan = cursor.lastrowid
            for i, d in enumerate(detalles):
                cursor.execute(
                    """INSERT INTO detalles_rutina
                       (id_plan, id_ejercicio, nombre_ejercicio, descripcion,
                        series, repeticiones, descanso, imagen_url, video_url, orden)
                       VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                    (id_plan,
                     d.get('id_ejercicio', None),
                     d['nombre_ejercicio'],
                     d.get('descripcion', ''),
                     d.get('series', 3),
                     d.get('repeticiones', '10'),
                     d.get('descanso', '60 seg'),
                     d.get('imagen_url', ''),
                     d.get('video_url', ''),
                     i)
                )
            conexion.commit()
            cursor.close()
            self._enviar_json({'id_plan': id_plan, 'mensaje': 'Rutina asignada correctamente'}, 201)
        except Exception as e:
            self._enviar_error(f'Error al asignar rutina: {str(e)}', 500)
        finally:
            cerrar_conexion(conexion)

    def _desactivar_rutina(self, id_plan):
        conexion = obtener_conexion()
        if not conexion:
            self._enviar_error('Error de conexión a la base de datos', 500)
            return
        try:
            cursor = conexion.cursor()
            cursor.execute("UPDATE planes_rutina SET activo = 0 WHERE id_plan = %s", (int(id_plan),))
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
        resultado = buscar_alimentos(termino)
        self._enviar_json(resultado)

    def _buscar_ejercicios(self, ruta):
        params = parse_qs(ruta.query)
        termino = params.get('termino', [None])[0]
        if not termino:
            self._enviar_error('Parámetro "termino" requerido', 400)
            return
        resultado = buscar_ejercicios(termino)
        self._enviar_json(resultado)

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
                self._enviar_error('Credenciales inválidas', 401)
                return
            import hashlib
            hash_ingresada = hashlib.sha256(contrasena.encode('utf-8')).hexdigest()
            if usuario['contrasena_hash'] != hash_ingresada:
                self._enviar_error('Credenciales inválidas', 401)
                return
            self._enviar_json({
                'token': 'token-simulado-' + str(usuario['id_usuario']),
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
                "INSERT INTO usuarios (nombre_completo, correo, contrasena_hash, rol) VALUES (%s, %s, %s, %s)",
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
            self._enviar_json({'id_usuario': id_usuario, 'mensaje': 'Usuario registrado correctamente'}, 201)
        except Exception as e:
            if 'Duplicate' in str(e):
                self._enviar_error('El correo ya está registrado', 409)
            else:
                self._enviar_error(f'Error al registrar usuario: {str(e)}', 500)
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
        if not all([id_paciente, id_nutriologo, fecha, hora]):
            self._enviar_error('Campos requeridos: id_paciente, id_nutriologo, fecha, hora', 400)
            return
        conexion = obtener_conexion()
        if not conexion:
            self._enviar_error('Error de conexión a la base de datos', 500)
            return
        try:
            cursor = conexion.cursor()
            cursor.execute(
                "INSERT INTO citas (id_paciente, id_nutriologo, fecha, hora) VALUES (%s, %s, %s, %s)",
                (id_paciente, id_nutriologo, fecha, hora)
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
        if len(partes) >= 4 and partes[2] == 'comidas':
            self._actualizar_comida(partes[3])
        elif len(partes) >= 4 and partes[2] == 'citas':
            self._actualizar_cita(partes[3])
        elif len(partes) >= 4 and partes[2] == 'usuario':
            self._actualizar_usuario(partes)
        elif len(partes) >= 5 and partes[2] == 'admin' and partes[3] == 'usuarios':
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
    servidor = HTTPServer(('0.0.0.0', PUERTO), ManejadorSilverBack)
    try:
        servidor.serve_forever()
    except KeyboardInterrupt:
        print('\n[Servidor] Apagando servidor...')
        servidor.server_close()


if __name__ == '__main__':
    main()
