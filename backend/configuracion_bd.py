import mysql.connector
from mysql.connector import Error

CONFIG = {
    'host': 'localhost',
    'port': 3306,
    'user': 'root',
    'password': 'root',
    'database': 'silverback_db',
    'charset': 'utf8mb4',
    'collation': 'utf8mb4_unicode_ci',
    'raise_on_warnings': False
}


def obtener_conexion():
    try:
        conexion = mysql.connector.connect(**CONFIG)
        if conexion.is_connected():
            return conexion
    except Error as e:
        print(f'[BD] Error de conexión: {e}')
        return None


def inicializar_base_datos():
    conexion_sin_db = None
    try:
        config_sin_db = {k: v for k, v in CONFIG.items() if k not in ('database', 'collation', 'raise_on_warnings')}
        config_sin_db['charset'] = 'utf8mb4'
        conexion_sin_db = mysql.connector.connect(**config_sin_db)
        cursor = conexion_sin_db.cursor()
        cursor.execute(f"CREATE DATABASE IF NOT EXISTS {CONFIG['database']} "
                       "CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
        cursor.close()
        conexion_sin_db.close()
        print(f'[BD] Base de datos "{CONFIG["database"]}" creada/verificada.')
    except Error as e:
        print(f'[BD] No se pudo crear la base de datos: {e}')
        if conexion_sin_db and conexion_sin_db.is_connected():
            conexion_sin_db.close()


def ejecutar_script_sql(ruta_script):
    conexion = obtener_conexion()
    if not conexion:
        print('[BD] No hay conexión para ejecutar script SQL.')
        return False
    try:
        cursor = conexion.cursor()
        with open(ruta_script, 'r', encoding='utf-8') as f:
            sql = f.read()

        for statement in sql.split(';\n'):
            statement = statement.strip()
            if not statement or statement.startswith('--'):
                continue
            for linea in statement.split('\n'):
                linea_limpia = linea.strip()
                if linea_limpia.startswith('--') or linea_limpia.startswith('#'):
                    continue
            cursor.execute(statement)
        conexion.commit()
        cursor.close()
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
    if conexion and conexion.is_connected():
        conexion.close()
