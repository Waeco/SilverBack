import os
import re
import sys
import time
import requests
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from concurrent.futures import ThreadPoolExecutor, as_completed
from configuracion_bd import obtener_conexion

CLAVE_API = os.environ.get('WGER_API_KEY', '')
URL_BASE = 'https://wger.de/api/v2'
IDIOMA = 4


def _headers():
    hdrs = {'Accept': 'application/json', 'User-Agent': 'SilverBack/1.0'}
    if CLAVE_API:
        hdrs['Authorization'] = f'Token {CLAVE_API}'
    return hdrs


def _limpiar_html(texto):
    if not texto:
        return ''
    texto = re.sub(r'<[^>]+>', '', texto)
    texto = texto.replace('&nbsp;', ' ').replace('&amp;', '&').strip()
    return texto


def _insertar_ejercicios(traducciones, cursor, conn):
    insertados = 0
    for t in traducciones:
        ex_id = t.get('exercise')
        if not ex_id:
            continue
        nombre = t.get('name', '')
        desc = _limpiar_html(t.get('description', ''))[:500]
        try:
            cursor.execute(
                "INSERT INTO ejercicios (wger_id, nombre, descripcion) VALUES (%s, %s, %s) "
                "ON DUPLICATE KEY UPDATE nombre=VALUES(nombre), descripcion=VALUES(descripcion)",
                (ex_id, nombre, desc)
            )
            if cursor.rowcount > 0:
                insertados += 1
        except Exception as e:
            print(f'[Poblar] Error insertando {nombre}: {e}')
    conn.commit()
    return insertados


def _enriquecer_lote(pendientes, cursor, conn):
    def _obtener_media(wger_id):
        img, vid = None, None
        try:
            r = requests.get(f'{URL_BASE}/exerciseimage/', params={'exercise': wger_id, 'is_main': 'true', 'limit': 1}, headers=_headers(), timeout=10)
            if r.ok:
                imgs = r.json().get('results', [])
                if imgs and imgs[0].get('image'):
                    img = imgs[0]['image']
            r = requests.get(f'{URL_BASE}/video/', params={'exercise': wger_id, 'limit': 1}, headers=_headers(), timeout=10)
            if r.ok:
                vids = r.json().get('results', [])
                if vids and vids[0].get('video'):
                    vid = vids[0]['video']
        except Exception:
            pass
        return img, vid

    actualizados = 0
    with ThreadPoolExecutor(max_workers=3) as executor:
        futuros = {executor.submit(_obtener_media, wger_id): (ej_id, wger_id) for ej_id, wger_id in pendientes}
        for i, futuro in enumerate(as_completed(futuros)):
            img_url, vid_url = futuro.result()
            ej_id, wger_id = futuros[futuro]
            if img_url or vid_url:
                try:
                    cur = conn.cursor()
                    cur.execute("UPDATE ejercicios SET imagen_url=%s, video_url=%s WHERE id=%s", (img_url, vid_url, ej_id))
                    cur.close()
                    actualizados += 1
                except Exception:
                    pass
            if (i + 1) % 50 == 0:
                conn.commit()
                print(f'[Poblar] Enriquecidos {i + 1}/{len(pendientes)}...')
    conn.commit()
    return actualizados


def poblar():
    print('[Poblar] Iniciando sincronización de ejercicios desde wger (español)...')
    headers = _headers()

    traducciones = []
    url = f'{URL_BASE}/exercise-translation/?language={IDIOMA}&limit=100'
    paginas = 0

    while url and paginas < 30:
        try:
            resp = requests.get(url, headers=headers, timeout=15)
            resp.raise_for_status()
            datos = resp.json()
            paginas += 1
            traducciones.extend(datos.get('results', []))
            print(f'[Poblar] Página {paginas}: {len(datos.get("results", []))} ejercicios')
            url = datos.get('next')
            if url:
                time.sleep(0.3)
        except Exception as e:
            print(f'[Poblar] Error en página {paginas}: {e}')
            break

    total_api = len(traducciones)
    if total_api == 0:
        print('[Poblar] No se obtuvieron ejercicios. Verifica conexión o API key.')
        return

    print(f'[Poblar] Total obtenidos de API: {total_api}. Insertando en BD...')

    conn = obtener_conexion()
    if not conn:
        print('[Poblar] Error: no hay conexión a BD')
        return

    try:
        cursor = conn.cursor()
        insertados = _insertar_ejercicios(traducciones, cursor, conn)
        print(f'[Poblar] {insertados} ejercicios insertados/actualizados.')
    except Exception as e:
        print(f'[Poblar] Error en inserción: {e}')
        conn.rollback()
        return
    finally:
        cursor.close()
        conn.close()

    print('[Poblar] Fase 2: obteniendo imágenes y videos...')

    conn = obtener_conexion()
    if not conn:
        return
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT id, wger_id FROM ejercicios WHERE wger_id IS NOT NULL")
        todos = cursor.fetchall()
        print(f'[Poblar] {len(todos)} ejercicios totales.')

        actualizados = _enriquecer_lote(todos, cursor, conn)
        print(f'[Poblar] Completado. {actualizados} ejercicios con imagen/video.')
    finally:
        cursor.close()
        conn.close()

    conn = obtener_conexion()
    if conn:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM ejercicios")
        total = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM ejercicios WHERE imagen_url IS NOT NULL")
        con_img = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM ejercicios WHERE video_url IS NOT NULL")
        con_vid = cursor.fetchone()[0]
        cursor.close()
        conn.close()
        print(f'[Poblar] Total en BD: {total} | Con imagen: {con_img} | Con video: {con_vid}')


if __name__ == '__main__':
    poblar()
