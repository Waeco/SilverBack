import os
import re
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed

CLAVE_API = os.environ.get('WGER_API_KEY', '')
URL_BASE = 'https://wger.de/api/v2'
IDIOMA = 2  # 2 = Spanish


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


def _obtener_imagenes(id_ejercicio):
    try:
        headers = _headers()
        params = {'exercise': id_ejercicio, 'is_main': 'true', 'limit': 2}
        respuesta = requests.get(f'{URL_BASE}/exerciseimage/', params=params, headers=headers, timeout=10)
        respuesta.raise_for_status()
        datos = respuesta.json()
        return [r.get('image', '') for r in datos.get('results', []) if r.get('image')]
    except Exception as e:
        print(f'[Wger] Error al obtener imágenes ({id_ejercicio}): {e}')
        return []


def _obtener_videos(id_ejercicio):
    try:
        headers = _headers()
        respuesta = requests.get(f'{URL_BASE}/video/', params={'exercise': id_ejercicio, 'limit': 1}, headers=headers, timeout=10)
        respuesta.raise_for_status()
        datos = respuesta.json()
        resultados = datos.get('results', [])
        return [r.get('video', '') for r in resultados if r.get('video')]
    except Exception as e:
        print(f'[Wger] Error al obtener videos ({id_ejercicio}): {e}')
        return []


def _enriquecer_ejercicio(traduccion):
    """Obtiene descripción, imagen y video para un ejercicio."""
    ex_id = traduccion.get('exercise')
    desc = _limpiar_html(traduccion.get('description', ''))
    imgs = _obtener_imagenes(ex_id)
    vids = _obtener_videos(ex_id)
    return {
        'id': str(ex_id),
        'nombre': traduccion.get('name', ''),
        'descripcion': desc[:300] if desc else '',
        'imagen': imgs[0] if imgs else '',
        'video': vids[0] if vids else '',
    }


def buscar_ejercicios(termino, max_resultados=10):
    """Busca ejercicios en Wger paginando y filtrando localmente.
    Obtiene imagen y video en paralelo para los resultados."""
    try:
        headers = _headers()
        termino_lower = termino.lower()

        # Recolectar traducciones que coincidan paginando (máx 5 páginas = 500 ejercicios)
        traducciones = []
        url = f'{URL_BASE}/exercise-translation/?language={IDIOMA}&limit=100'
        paginas = 0
        while url and paginas < 5 and len(traducciones) < max_resultados:
            respuesta = requests.get(url, headers=headers, timeout=15)
            respuesta.raise_for_status()
            datos = respuesta.json()
            paginas += 1
            for t in datos.get('results', []):
                if termino_lower in t.get('name', '').lower():
                    traducciones.append(t)
                    if len(traducciones) >= max_resultados:
                        break
            url = datos.get('next')

        # Obtener imagen y video en paralelo para todos los resultados
        coincide = []
        with ThreadPoolExecutor(max_workers=5) as executor:
            futuros = {executor.submit(_enriquecer_ejercicio, t): t for t in traducciones}
            for futuro in as_completed(futuros):
                coincide.append(futuro.result())

        # Ordenar por el orden original de aparición
        orden = {t.get('exercise'): i for i, t in enumerate(traducciones)}
        coincide.sort(key=lambda x: orden.get(int(x['id']), 999))

        print(f'[Wger] Búsqueda "{termino}": {len(coincide)} resultados ({paginas} páginas)')
        return {'results': coincide}
    except Exception as e:
        print(f'[Wger] Error en búsqueda: {e}')
        return {'error': str(e)}


def obtener_info_ejercicio(id_ejercicio):
    """Obtiene info completa de un ejercicio (descripción, imagen, video) desde Wger."""
    try:
        headers = _headers()
        traduccion = None

        for lang in [IDIOMA, 1]:
            respuesta = requests.get(
                f'{URL_BASE}/exercise-translation/',
                params={'language': lang, 'exercise': id_ejercicio, 'limit': 1},
                headers=headers,
                timeout=10
            )
            if respuesta.status_code != 200:
                continue
            datos = respuesta.json()
            results = datos.get('results', [])
            if results:
                traduccion = results[0]
                break

        if not traduccion:
            respuesta = requests.get(
                f'{URL_BASE}/exercise-translation/',
                params={'exercise': id_ejercicio, 'limit': 1},
                headers=headers,
                timeout=10
            )
            if respuesta.status_code == 200:
                datos = respuesta.json()
                results = datos.get('results', [])
                if results:
                    traduccion = results[0]

        if not traduccion:
            return None

        # Obtener imagen y video en paralelo
        imagenes, videos = [], []
        with ThreadPoolExecutor(max_workers=2) as executor:
            f_img = executor.submit(_obtener_imagenes, id_ejercicio)
            f_vid = executor.submit(_obtener_videos, id_ejercicio)
            imagenes = f_img.result()
            videos = f_vid.result()

        return {
            'id': traduccion.get('exercise'),
            'nombre': traduccion.get('name', ''),
            'descripcion': _limpiar_html(traduccion.get('description', '')),
            'imagen': imagenes[0] if imagenes else '',
            'video': videos[0] if videos else '',
        }
    except Exception as e:
        print(f'[Wger] Error al obtener ejercicio {id_ejercicio}: {e}')
        return None
