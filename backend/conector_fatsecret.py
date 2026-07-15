import hashlib
import hmac
import base64
import time
import secrets
import os
import re
import requests
from urllib.parse import quote

CLIENTE_ID = os.environ.get('FATSECRET_CLIENT_ID', '')
CLIENTE_SECRETO = os.environ.get('FATSECRET_CLIENT_SECRET', '')
URL_BASE = 'https://platform.fatsecret.com/rest/server.api'


def _requerir_credenciales():
    if not CLIENTE_ID or not CLIENTE_SECRETO:
        raise RuntimeError('Se requieren credenciales de FatSecret (FATSECRET_CLIENT_ID y FATSECRET_CLIENT_SECRET)')


def _urlenc(valor):
    return quote(str(valor), safe='')


def _firmar_solicitud(parametros):
    parametros_ordenados = sorted(parametros.items())
    cadena_params = '&'.join(f'{_urlenc(k)}={_urlenc(v)}' for k, v in parametros_ordenados)
    cadena_firma = f'GET&{_urlenc(URL_BASE)}&{_urlenc(cadena_params)}'
    clave_firma = f'{_urlenc(CLIENTE_SECRETO)}&'
    firma = hmac.new(
        clave_firma.encode('utf-8'),
        cadena_firma.encode('utf-8'),
        hashlib.sha1
    ).digest()
    return base64.b64encode(firma).decode('utf-8')


def _parametros_base():
    return {
        'oauth_consumer_key': CLIENTE_ID,
        'oauth_signature_method': 'HMAC-SHA1',
        'oauth_timestamp': str(int(time.time())),
        'oauth_nonce': secrets.token_hex(16),
        'oauth_version': '1.0',
        'format': 'json'
    }


def _extraer_numero(texto, patron):
    m = re.search(patron, texto, re.IGNORECASE)
    return float(m.group(1)) if m else 0.0

def _extraer_descripcion(alimento):
    try:
        desc = alimento.get('food_description', '')
        if desc:
            cal = _extraer_numero(desc, r'Calories:\s*([\d.]+)')
            pro = _extraer_numero(desc, r'Protein:\s*([\d.]+)')
            car = _extraer_numero(desc, r'Carbs:\s*([\d.]+)')
            gra = _extraer_numero(desc, r'Fat:\s*([\d.]+)')
            if cal or pro or car or gra:
                desc_es = f"100g | Calorías: {cal:.0f} | Proteína: {pro}g | Carbohidratos: {car}g | Grasa: {gra}g"
                return (desc_es, {'calorias': cal, 'proteinas': pro, 'carbohidratos': car, 'grasas': gra})
        porcion = alimento.get('servings', {}).get('serving', [{}])
        if isinstance(porcion, dict):
            porcion = [porcion]
        p = porcion[0] if porcion else {}
        pd = f"{p.get('measurement_description', '100g')} | Calorías: {float(p.get('calories', 0)):.0f} | Proteína: {float(p.get('protein', 0))}g | Carbohidratos: {float(p.get('carbohydrate', 0))}g | Grasa: {float(p.get('fat', 0))}g"
        return (pd, {'calorias': float(p.get('calories', 0)), 'proteinas': float(p.get('protein', 0)), 'carbohidratos': float(p.get('carbohydrate', 0)), 'grasas': float(p.get('fat', 0))})
    except (ValueError, TypeError, AttributeError):
        return desc or '', {'calorias': 0, 'proteinas': 0, 'carbohidratos': 0, 'grasas': 0}


def buscar_alimentos(termino, max_resultados=10):
    _requerir_credenciales()
    params = _parametros_base()
    params['method'] = 'foods.search'
    params['search_expression'] = termino
    params['max_results'] = str(max_resultados)
    params['oauth_signature'] = _firmar_solicitud(params)
    try:
        url_completa = URL_BASE + '?' + '&'.join(
            f'{_urlenc(k)}={_urlenc(v)}' for k, v in sorted(params.items())
        )
        respuesta = requests.get(url_completa, timeout=10)
        respuesta.raise_for_status()
        datos = respuesta.json()
        foods = datos.get('foods', {}).get('food', [])
        if isinstance(foods, dict):
            foods = [foods]
        resultados = []
        for f in foods:
            desc, _ = _extraer_descripcion(f)
            resultados.append({
                'food_id': str(f.get('food_id', '')),
                'food_name': f.get('food_name', ''),
                'food_description': desc,
            })
        return {'results': resultados} if resultados else {'results': []}
    except requests.RequestException as e:
        print(f'[FatSecret] Error en búsqueda: {e}')
        return {'error': str(e)}
    except Exception as e:
        print(f'[FatSecret] Error parseando respuesta: {e}')
        return {'error': str(e)}


def obtener_info_alimento(id_alimento):
    _requerir_credenciales()
    params = _parametros_base()
    params['method'] = 'food.get'
    params['food_id'] = id_alimento
    params['oauth_signature'] = _firmar_solicitud(params)
    try:
        url_completa = URL_BASE + '?' + '&'.join(
            f'{_urlenc(k)}={_urlenc(v)}' for k, v in sorted(params.items())
        )
        respuesta = requests.get(url_completa, timeout=10)
        respuesta.raise_for_status()
        datos = respuesta.json()
        alimento = datos.get('food', {})
        _, macros = _extraer_descripcion(alimento)
        return macros
    except requests.RequestException as e:
        print(f'[FatSecret] Error al obtener alimento: {e}')
        return {'error': str(e)}
    except Exception as e:
        print(f'[FatSecret] Error parseando alimento: {e}')
        return {'error': str(e)}
