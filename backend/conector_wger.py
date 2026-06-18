import os
import re
import requests

CLAVE_API = os.environ.get('WGER_API_KEY', '')
URL_BASE = 'https://wger.de/api/v2'
IDIOMA = 2  # 2 = Spanish

EJERCICIOS_SIMULADOS = [
    {'id': 1, 'nombre': 'Flexiones de Pecho', 'descripcion': 'Ejercicio clásico para pectorales, hombros y tríceps. Mantén el cuerpo recto y baja hasta que el pecho casi toque el suelo.', 'imagen': '', 'video': ''},
    {'id': 2, 'nombre': 'Sentadillas', 'descripcion': 'Ejercicio fundamental para piernas y glúteos. Mantén la espalda recta y baja hasta que los muslos estén paralelos al suelo.', 'imagen': '', 'video': ''},
    {'id': 3, 'nombre': 'Dominadas', 'descripcion': 'Ejercicio de espalda y bíceps. Agarra la barra con las palmas hacia afuera y eleva tu cuerpo hasta que la barbilla sobrepase la barra.', 'imagen': '', 'video': ''},
    {'id': 4, 'nombre': 'Press Militar', 'descripcion': 'Ejercicio para hombros. De pie, presiona la barra desde los hombros hasta extender completamente los brazos.', 'imagen': '', 'video': ''},
    {'id': 5, 'nombre': 'Remo con Barra', 'descripcion': 'Ejercicio para espalda media. Inclínate hacia adelante con la espalda recta y lleva la barra hacia el abdomen.', 'imagen': '', 'video': ''},
    {'id': 6, 'nombre': 'Peso Muerto', 'descripcion': 'Ejercicio compuesto para cadena posterior. Levanta la barra desde el suelo manteniendo la espalda recta.', 'imagen': '', 'video': ''},
    {'id': 7, 'nombre': 'Fondos en Paralelas', 'descripcion': 'Ejercicio para tríceps y pectoral inferior. Baja tu cuerpo entre las barras y empuja hacia arriba.', 'imagen': '', 'video': ''},
    {'id': 8, 'nombre': 'Curl de Bíceps', 'descripcion': 'Ejercicio de aislamiento para bíceps. Con los codos fijos, lleva la barra hacia los hombros.', 'imagen': '', 'video': ''},
    {'id': 9, 'nombre': 'Plancha', 'descripcion': 'Ejercicio isométrico para core. Mantén el cuerpo recto apoyado en antebrazos y puntillas.', 'imagen': '', 'video': ''},
    {'id': 10, 'nombre': 'Zancadas', 'descripcion': 'Ejercicio para piernas y glúteos. Da un paso adelante y baja la rodilla trasera hacia el suelo.', 'imagen': '', 'video': ''},
    {'id': 11, 'nombre': 'Elevaciones Laterales', 'descripcion': 'Ejercicio para hombros laterales. Con mancuernas, eleva los brazos hacia los lados hasta la altura de los hombros.', 'imagen': '', 'video': ''},
    {'id': 12, 'nombre': 'Crunches', 'descripcion': 'Ejercicio para abdominales. Acostado boca arriba, eleva el torso contrayendo el abdomen.', 'imagen': '', 'video': ''},
    {'id': 13, 'nombre': 'Press Francés', 'descripcion': 'Ejercicio para tríceps. Acostado, extiende los brazos con la barra desde detrás de la cabeza.', 'imagen': '', 'video': ''},
    {'id': 14, 'nombre': 'Jalón al Pecho', 'descripcion': 'Ejercicio para espalda. Desde la polea alta, lleva la barra hacia el pecho.', 'imagen': '', 'video': ''},
    {'id': 15, 'nombre': 'Elevación de Talones', 'descripcion': 'Ejercicio para gemelos. De pie, eleva los talones contrayendo las pantorrillas.', 'imagen': '', 'video': ''},
]

IMAGENES_SIMULADAS = {
    1: 'https://raw.githubusercontent.com/wger-project/wger/master/wger/core/static/images/exercises/bench-press.png',
    2: 'https://raw.githubusercontent.com/wger-project/wger/master/wger/core/static/images/exercises/squat.png',
}


def _tiene_clave():
    return bool(CLAVE_API)


def _headers():
    h = {'Accept': 'application/json', 'User-Agent': 'SilverBack/1.0'}
    if CLAVE_API:
        h['Authorization'] = f'Token {CLAVE_API}'
    return h


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
        print(f'[Wger] Error al obtener imágenes: {e}')
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
        print(f'[Wger] Error al obtener videos: {e}')
        return []


def buscar_ejercicios(termino, max_resultados=10):
    if not _tiene_clave():
        resultados = [e for e in EJERCICIOS_SIMULADOS
                      if termino.lower() in e['nombre'].lower()][:max_resultados]
        if not resultados:
            resultados = EJERCICIOS_SIMULADOS[:max_resultados]
        return {'results': resultados}

    try:
        headers = _headers()
        respuesta = requests.get(
            f'{URL_BASE}/exercise-translation/',
            params={
                'language': IDIOMA,
                'name__icontains': termino,
                'limit': max_resultados,
            },
            headers=headers,
            timeout=10
        )
        respuesta.raise_for_status()
        datos = respuesta.json()
        resultados = []
        for t in datos.get('results', []):
            ex_id = t.get('exercise')
            ex_id_val = str(ex_id) if ex_id is not None else ''
            desc = _limpiar_html(t.get('description', ''))
            resultados.append({
                'id': ex_id_val,
                'nombre': t.get('name', ''),
                'descripcion': desc[:300] if desc else '',
                'imagen': '',
                'video': '',
            })
        return {'results': resultados[:max_resultados]}
    except Exception as e:
        print(f'[Wger] Error en búsqueda: {e}')
        return {'error': str(e)}


def obtener_info_ejercicio(id_ejercicio):
    imagenes = _obtener_imagenes(id_ejercicio)
    videos = _obtener_videos(id_ejercicio)

    if not _tiene_clave():
        for e in EJERCICIOS_SIMULADOS:
            if str(e['id']) == str(id_ejercicio):
                img_simulada = IMAGENES_SIMULADAS.get(e['id'], '')
                return {
                    'id': e['id'],
                    'nombre': e['nombre'],
                    'descripcion': e['descripcion'],
                    'imagen': img_simulada if not imagenes else (imagenes[0] if imagenes else ''),
                    'video': videos[0] if videos else '',
                }
        return None

    try:
        headers = _headers()
        respuesta = requests.get(
            f'{URL_BASE}/exercise-translation/',
            params={'language': IDIOMA, 'exercise': id_ejercicio, 'limit': 1},
            headers=headers,
            timeout=10
        )
        respuesta.raise_for_status()
        datos = respuesta.json()
        results = datos.get('results', [])
        if not results:
            return None
        t = results[0]
        desc = _limpiar_html(t.get('description', ''))
        return {
            'id': t.get('exercise'),
            'nombre': t.get('name', ''),
            'descripcion': desc,
            'imagen': imagenes[0] if imagenes else '',
            'video': videos[0] if videos else '',
        }
    except Exception as e:
        print(f'[Wger] Error al obtener ejercicio: {e}')
        return None
