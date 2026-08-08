import os
import mysql.connector
from mysql.connector import Error
from mysql.connector.pooling import MySQLConnectionPool

CONFIG = {
    'host': os.environ.get('DB_HOST', 'localhost'),
    'port': int(os.environ.get('DB_PORT', 3306)),
    'user': os.environ.get('DB_USER', 'root'),
    'password': os.environ.get('DB_PASSWORD', 'root'),
    'database': os.environ.get('DB_NAME', 'silverback_db'),
    'charset': 'utf8mb4',
    'collation': 'utf8mb4_unicode_ci',
    'raise_on_warnings': False
}

_pool = None


def esperar_mysql(intentos=30, intervalo=3):
    """Espera hasta que MySQL acepte conexiones TCP. Devuelve True si conecta.

    Necesario en Docker: aunque el healthcheck del contenedor mysql reporte
    'healthy', el servidor real puede tardar unos segundos en aceptar conexiones
    externas desde los contenedores backend/fastapi."""
    import time
    for i in range(1, intentos + 1):
        try:
            config_sin_db = {k: v for k, v in CONFIG.items() if k not in ('database', 'collation', 'raise_on_warnings')}
            config_sin_db['charset'] = 'utf8mb4'
            conn = mysql.connector.connect(**config_sin_db, connection_timeout=5)
            conn.close()
            print('[BD] MySQL disponible tras esperar conexión.')
            return True
        except Error as e:
            print(f'[BD] Esperando MySQL ({i}/{intentos}): {e}')
            time.sleep(intervalo)
    print('[BD] No se pudo conectar a MySQL después de esperar.')
    return False


def inicializar_pool(intentos=5, intervalo=3):
    global _pool
    import time
    for i in range(1, intentos + 1):
        try:
            config_pool = {
                'pool_name': 'silverback',
                'pool_size': int(os.environ.get('DB_POOL_SIZE', 10)),
                'pool_reset_session': True,
                'consume_results': True,
                'host': CONFIG['host'],
                'port': CONFIG['port'],
                'user': CONFIG['user'],
                'password': CONFIG['password'],
                'database': CONFIG['database'],
                'charset': CONFIG['charset'],
                'collation': CONFIG['collation'],
            }
            _pool = MySQLConnectionPool(**config_pool)
            print(f'[BD] Pool de conexiones creado (tamaño: {config_pool["pool_size"]})')
            return True
        except Error as e:
            print(f'[BD] Error al crear pool ({i}/{intentos}): {e}')
            _pool = None
            if i < intentos:
                time.sleep(intervalo)
    return False


def obtener_conexion():
    """Devuelve una conexión del pool (o una directa si no hay pool).

    Si el pool está agotado, espera unos segundos y reintenta en vez de
    fallar de inmediato: el polling del frontend y la verificación del
    captcha (que espera a Google con timeout) dejan la conexión ocupada
    un momento y con peticiones simultáneas se puede alcanzar el límite."""
    import time
    for _ in range(10):
        try:
            if _pool:
                return _pool.get_connection()
            return mysql.connector.connect(**CONFIG)
        except Error as e:
            if _pool and 'exhausted' in str(e).lower():
                time.sleep(0.5)
                continue
            print(f'[BD] Error de conexión: {e}')
            return None
    print('[BD] Error de conexión: pool agotado tras reintentos')
    return None


def inicializar_base_datos():
    pool_activo = _pool is not None
    if pool_activo:
        conexion = obtener_conexion()
    else:
        config_sin_db = {k: v for k, v in CONFIG.items() if k not in ('database', 'collation', 'raise_on_warnings')}
        config_sin_db['charset'] = 'utf8mb4'
        try:
            conexion = mysql.connector.connect(**config_sin_db)
        except Error as e:
            print(f'[BD] No se pudo conectar para crear BD: {e}')
            return
    try:
        cursor = conexion.cursor()
        cursor.execute(f"CREATE DATABASE IF NOT EXISTS {CONFIG['database']} "
                       "CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
        cursor.close()
        print(f'[BD] Base de datos "{CONFIG["database"]}" creada/verificada.')
    except Error as e:
        print(f'[BD] No se pudo crear la base de datos: {e}')
    finally:
        if not pool_activo and conexion and conexion.is_connected():
            conexion.close()
        elif pool_activo and conexion and conexion.is_connected():
            conexion.close()


def ejecutar_script_sql(ruta_script):
    conexion = obtener_conexion()
    if not conexion:
        print('[BD] No hay conexión para ejecutar script SQL.')
        return False
    try:
        cursor = conexion.cursor()
        with open(ruta_script, 'r', encoding='utf-8') as f:
            sql = f.read()

        statements = []
        current = []
        for line in sql.split('\n'):
            current.append(line)
            if line.rstrip().endswith(';'):
                statements.append('\n'.join(current))
                current = []
        if current:
            statements.append('\n'.join(current))

        def limpiar(statement):
            lineas_sql = []
            for linea in statement.split('\n'):
                linea_limpia = linea.strip()
                if not linea_limpia or linea_limpia.startswith('--') or linea_limpia.startswith('#'):
                    continue
                lineas_sql.append(linea)
            return '\n'.join(lineas_sql).strip()

        pendientes = list(statements)
        # Multi-pase: si una tabla con FK se crea antes que la tabla
        # referenciada (ej. detalles_rutina -> ejercicios), se reintenta
        # después de que las demás tablas ya existan.
        for pase in range(1, 6):
            if not pendientes:
                break
            nuevos_pendientes = []
            for statement in pendientes:
                sql_limpio = limpiar(statement)
                if not sql_limpio:
                    continue
                pase_ok = False
                try:
                    cursor.execute(sql_limpio)
                    pase_ok = True
                except Error as e:
                    if e.errno in (1824, 1146):
                        # FK a tabla que aún no existe (1824) o referencia a
                        # tabla dependiente que se crea en una pasada posterior (1146).
                        # Se reintenta en las siguientes pasadas.
                        nuevos_pendientes.append(statement)
                    elif e.errno in (1062, 1060):
                        # Duplicado (seed) o columna ya agregada (migración): ignorar
                        pass
                    else:
                        raise
                finally:
                    try:
                        if pase_ok:
                            conexion.commit()
                    except Exception:
                        pass
            pendientes = nuevos_pendientes
            if not pendientes:
                break
            print(f'[BD] Reintentando {len(pendientes)} sentencias en pasada {pase + 1}...')
        cursor.close()
        if pendientes:
            print(f'[BD] Hay {len(pendientes)} statements sin resolver (probablemente duplicados/FK).')
            return True
        print(f'[BD] Script SQL "{ruta_script}" ejecutado correctamente.')
        return True
    except Error as e:
        print(f'[BD] Error ejecutando script SQL: {e}')
        conexion.rollback()
        return False
    finally:
        if conexion and conexion.is_connected():
            conexion.close()


def cerrar_conexion(conexion):
    if conexion:
        try:
            conexion.close()
        except Exception as e:
            if 'Unread result found' in str(e):
                try:
                    conexion.close()
                except Exception:
                    pass
