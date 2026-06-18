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

ALIMENTOS_SIMULADOS = [
    {'food_id': '1', 'food_name': 'Avena Integral', 'food_description': '100g | Calorías: 389 | Proteína: 16.9g | Carbohidratos: 66.3g | Grasa: 6.9g'},
    {'food_id': '2', 'food_name': 'Huevo Entero', 'food_description': '100g | Calorías: 155 | Proteína: 13g | Carbohidratos: 1.1g | Grasa: 11g'},
    {'food_id': '3', 'food_name': 'Pechuga de Pollo', 'food_description': '100g | Calorías: 165 | Proteína: 31g | Carbohidratos: 0g | Grasa: 3.6g'},
    {'food_id': '4', 'food_name': 'Arroz Integral', 'food_description': '100g | Calorías: 111 | Proteína: 2.6g | Carbohidratos: 23g | Grasa: 0.9g'},
    {'food_id': '5', 'food_name': 'Plátano', 'food_description': '100g | Calorías: 89 | Proteína: 1.1g | Carbohidratos: 23g | Grasa: 0.3g'},
    {'food_id': '6', 'food_name': 'Salmón', 'food_description': '100g | Calorías: 208 | Proteína: 20g | Carbohidratos: 0g | Grasa: 13g'},
    {'food_id': '7', 'food_name': 'Yogur Griego', 'food_description': '100g | Calorías: 97 | Proteína: 9g | Carbohidratos: 3.6g | Grasa: 5g'},
    {'food_id': '8', 'food_name': 'Aguacate', 'food_description': '100g | Calorías: 160 | Proteína: 2g | Carbohidratos: 8.5g | Grasa: 15g'},
    {'food_id': '9', 'food_name': 'Proteína Whey', 'food_description': '30g | Calorías: 120 | Proteína: 24g | Carbohidratos: 3g | Grasa: 1g'},
    {'food_id': '10', 'food_name': 'Manzana', 'food_description': '100g | Calorías: 52 | Proteína: 0.3g | Carbohidratos: 14g | Grasa: 0.2g'},
]

INFO_SIMULADA = {
    '1': {'calorias': 389, 'proteinas': 16.9, 'carbohidratos': 66.3, 'grasas': 6.9},
    '2': {'calorias': 155, 'proteinas': 13, 'carbohidratos': 1.1, 'grasas': 11},
    '3': {'calorias': 165, 'proteinas': 31, 'carbohidratos': 0, 'grasas': 3.6},
    '4': {'calorias': 111, 'proteinas': 2.6, 'carbohidratos': 23, 'grasas': 0.9},
    '5': {'calorias': 89, 'proteinas': 1.1, 'carbohidratos': 23, 'grasas': 0.3},
    '6': {'calorias': 208, 'proteinas': 20, 'carbohidratos': 0, 'grasas': 13},
    '7': {'calorias': 97, 'proteinas': 9, 'carbohidratos': 3.6, 'grasas': 5},
    '8': {'calorias': 160, 'proteinas': 2, 'carbohidratos': 8.5, 'grasas': 15},
    '9': {'calorias': 120, 'proteinas': 24, 'carbohidratos': 3, 'grasas': 1},
    '10': {'calorias': 52, 'proteinas': 0.3, 'carbohidratos': 14, 'grasas': 0.2},
}


def _tiene_credenciales_reales():
    return bool(CLIENTE_ID) and bool(CLIENTE_SECRETO)


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
                return (desc, {'calorias': cal, 'proteinas': pro, 'carbohidratos': car, 'grasas': gra})
        porcion = alimento.get('servings', {}).get('serving', [{}])
        if isinstance(porcion, dict):
            porcion = [porcion]
        p = porcion[0] if porcion else {}
        pd = f"{p.get('measurement_description', '100g')} | Calorías: {float(p.get('calories', 0)):.0f} | Proteína: {float(p.get('protein', 0))}g | Carbohidratos: {float(p.get('carbohydrate', 0))}g | Grasa: {float(p.get('fat', 0))}g"
        return (pd, {'calorias': float(p.get('calories', 0)), 'proteinas': float(p.get('protein', 0)), 'carbohidratos': float(p.get('carbohydrate', 0)), 'grasas': float(p.get('fat', 0))})
    except (ValueError, TypeError, AttributeError):
        return desc or '', {'calorias': 0, 'proteinas': 0, 'carbohidratos': 0, 'grasas': 0}


def buscar_alimentos(termino, max_resultados=10):
    if not _tiene_credenciales_reales():
        resultados = [a for a in ALIMENTOS_SIMULADOS
                      if termino.lower() in a['food_name'].lower()][:max_resultados]
        return {'results': resultados} if resultados else {'results': ALIMENTOS_SIMULADOS[:max_resultados]}

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
    if not _tiene_credenciales_reales():
        return INFO_SIMULADA.get(id_alimento, {'calorias': 0, 'proteinas': 0, 'carbohidratos': 0, 'grasas': 0})

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
