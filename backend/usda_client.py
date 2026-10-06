import os
import re
import unicodedata

import httpx
from dotenv import load_dotenv

from backend.schemas import Alimento


load_dotenv()


USDA_SEARCH_URL = (
    "https://api.nal.usda.gov/fdc/v1/foods/search"
)


class USDAClientError(RuntimeError):
    """Error controlado al comunicarse con USDA."""


# La API de USDA busca mejor en inglés. Estas traducciones se aplican en el
# backend para que cualquier interfaz pueda enviar búsquedas en español.
TRADUCCIONES_BUSQUEDA = {
    "pechuga de pollo": "chicken breast",
    "pollo": "chicken",
    "carne molida": "ground beef",
    "carne de res": "beef",
    "cerdo": "pork",
    "pavo": "turkey",
    "pescado": "fish",
    "salmon": "salmon",
    "atun": "tuna",
    "camaron": "shrimp",
    "arroz blanco": "white rice",
    "arroz integral": "brown rice",
    "arroz": "rice",
    "huevo": "egg",
    "huevos": "eggs",
    "clara de huevo": "egg white",
    "avena": "oats",
    "frijoles": "beans",
    "lentejas": "lentils",
    "garbanzos": "chickpeas",
    "brocoli": "broccoli",
    "espinaca": "spinach",
    "lechuga": "lettuce",
    "zanahoria": "carrot",
    "papa": "potato",
    "camote": "sweet potato",
    "jitomate": "tomato",
    "tomate": "tomato",
    "aguacate": "avocado",
    "platano": "banana",
    "manzana": "apple",
    "naranja": "orange",
    "fresa": "strawberry",
    "tortilla de maiz": "corn tortilla",
    "tortilla": "tortilla",
    "pan": "bread",
    "pasta": "pasta",
    "leche": "milk",
    "yogur": "yogurt",
    "yogurt": "yogurt",
    "queso": "cheese",
    "cocido": "cooked",
    "cocida": "cooked",
    "crudo": "raw",
    "cruda": "raw",
    "asado": "roasted",
    "asada": "roasted",
    "hervido": "boiled",
    "hervida": "boiled",
    "a la parrilla": "grilled",
    "sin piel": "skinless",
}


# Cada entrada contiene palabras que deben aparecer en la descripción de USDA,
# el nombre sencillo que verá el usuario y la categoría interna de SilverBack.
ALIMENTOS_RECONOCIDOS = (
    (("peanut", "butter"), "Crema de cacahuate", "grasa"),
    (("sweet", "potato"), "Camote", "carbohidrato"),
    (("chicken", "breast"), "Pechuga de pollo", "proteina"),
    (("chicken", "thigh"), "Muslo de pollo", "proteina"),
    (("chicken",), "Pollo", "proteina"),
    (("turkey", "breast"), "Pechuga de pavo", "proteina"),
    (("turkey",), "Pavo", "proteina"),
    (("ground", "beef"), "Carne molida de res", "proteina"),
    (("beef",), "Carne de res", "proteina"),
    (("pork",), "Cerdo", "proteina"),
    (("salmon",), "Salmón", "proteina"),
    (("tuna",), "Atún", "proteina"),
    (("shrimp",), "Camarón", "proteina"),
    (("tilapia",), "Tilapia", "proteina"),
    (("egg", "white"), "Clara de huevo", "proteina"),
    (("egg", "yolk"), "Yema de huevo", "proteina"),
    (("egg",), "Huevo", "proteina"),
    (("brown", "rice"), "Arroz integral", "carbohidrato"),
    (("white", "rice"), "Arroz blanco", "carbohidrato"),
    (("rice",), "Arroz", "carbohidrato"),
    (("oatmeal",), "Avena", "carbohidrato"),
    (("oats",), "Avena", "carbohidrato"),
    (("bread",), "Pan", "carbohidrato"),
    (("tortilla",), "Tortilla", "carbohidrato"),
    (("spaghetti",), "Espagueti", "carbohidrato"),
    (("pasta",), "Pasta", "carbohidrato"),
    (("potato",), "Papa", "carbohidrato"),
    (("chickpea",), "Garbanzos", "leguminosa"),
    (("lentil",), "Lentejas", "leguminosa"),
    (("beans",), "Frijoles", "leguminosa"),
    (("bean",), "Frijoles", "leguminosa"),
    (("broccoli",), "Brócoli", "verdura"),
    (("spinach",), "Espinaca", "verdura"),
    (("lettuce",), "Lechuga", "verdura"),
    (("carrot",), "Zanahoria", "verdura"),
    (("tomato",), "Tomate", "verdura"),
    (("corn",), "Maíz", "verdura"),
    (("avocado",), "Aguacate", "grasa"),
    (("banana",), "Plátano", "fruta"),
    (("apple",), "Manzana", "fruta"),
    (("orange",), "Naranja", "fruta"),
    (("strawberry",), "Fresa", "fruta"),
    (("blueberry",), "Arándanos", "fruta"),
    (("greek", "yogurt"), "Yogur griego", "lacteo"),
    (("yogurt",), "Yogur", "lacteo"),
    (("cottage", "cheese"), "Queso cottage", "lacteo"),
    (("cheese",), "Queso", "lacteo"),
    (("milk",), "Leche", "lacteo"),
    (("almond",), "Almendras", "grasa"),
)


TIPOS_USDA_PRIORIDAD = {
    "Foundation": 0,
    "SR Legacy": 1,
    "Survey (FNDDS)": 2,
    "Experimental": 3,
    "Branded": 4,
}


def _normalizar_texto(texto: str) -> str:
    """Normaliza un texto para compararlo sin acentos ni puntuación."""

    texto_sin_acentos = "".join(
        caracter
        for caracter in unicodedata.normalize("NFD", texto.casefold())
        if unicodedata.category(caracter) != "Mn"
    )

    return " ".join(
        re.sub(r"[^a-z0-9]+", " ", texto_sin_acentos).split()
    )


def _traducir_consulta(consulta: str) -> str:
    """Convierte términos comunes del español al inglés para USDA."""

    consulta_normalizada = _normalizar_texto(consulta)

    if consulta_normalizada in TRADUCCIONES_BUSQUEDA:
        return TRADUCCIONES_BUSQUEDA[consulta_normalizada]

    resultado = consulta_normalizada

    for termino_espanol in sorted(
        TRADUCCIONES_BUSQUEDA,
        key=len,
        reverse=True,
    ):
        patron = rf"\b{re.escape(termino_espanol)}\b"
        resultado = re.sub(
            patron,
            TRADUCCIONES_BUSQUEDA[termino_espanol],
            resultado,
        )

    # La preposición aislada normalmente no aporta valor a la búsqueda inglesa.
    resultado = re.sub(r"\bde\b", " ", resultado)
    return " ".join(resultado.split()) or consulta.strip()


def _obtener_nutriente(
    alimento: dict,
    nombres: set[str],
    unidad: str | None = None,
) -> float:
    """Obtiene un nutriente específico de la respuesta de USDA."""

    nombres_normalizados = {
        nombre.casefold()
        for nombre in nombres
    }

    for nutriente in alimento.get("foodNutrients", []):
        nombre = str(
            nutriente.get("nutrientName", "")
        ).casefold()

        unidad_nutriente = str(
            nutriente.get("unitName", "")
        ).upper()

        if nombre not in nombres_normalizados:
            continue

        if unidad and unidad_nutriente != unidad.upper():
            continue

        try:
            return float(nutriente.get("value", 0))
        except (TypeError, ValueError):
            return 0.0

    return 0.0


def _datos_presentacion(
    descripcion: str,
) -> tuple[str, str, str, list[str]]:
    """Crea nombre, categoría, estado y etiquetas fáciles de entender."""

    descripcion_normalizada = _normalizar_texto(descripcion)
    palabras = set(descripcion_normalizada.split())

    nombre = descripcion.strip().capitalize()[:150]
    categoria = "otro"

    for requeridas, nombre_espanol, categoria_interna in ALIMENTOS_RECONOCIDOS:
        if all(palabra in palabras for palabra in requeridas):
            nombre = nombre_espanol
            categoria = categoria_interna
            break

    etiquetas: list[str] = []

    preparaciones_especificas = (
        ("grilled", "a la parrilla"),
        ("fried", "frito"),
        ("roasted", "asado"),
        ("baked", "horneado"),
        ("boiled", "hervido"),
        ("steamed", "al vapor"),
    )

    preparacion_encontrada = False

    if "raw" in palabras:
        etiquetas.append("crudo")
        estado = "crudo"
    else:
        estado = "no_aplica"

        for palabra, etiqueta in preparaciones_especificas:
            if palabra in palabras:
                etiquetas.append(etiqueta)
                preparacion_encontrada = True

        if "cooked" in palabras and not preparacion_encontrada:
            etiquetas.append("cocido")

        if preparacion_encontrada or "cooked" in palabras:
            estado = "cocido"

    reglas_adicionales = (
        (("breaded",), "empanizado"),
        (("skinless",), "sin piel"),
        (("skin", "not", "eaten"), "sin piel"),
        (("meat", "only"), "sin piel"),
        (("skin", "eaten"), "con piel"),
        (("boneless",), "sin hueso"),
        (("canned",), "enlatado"),
        (("drained",), "escurrido"),
        (("unsalted",), "sin sal"),
        (("lowfat",), "bajo en grasa"),
        (("nonfat",), "sin grasa"),
    )

    for requeridas, etiqueta in reglas_adicionales:
        if all(palabra in palabras for palabra in requeridas):
            etiquetas.append(etiqueta)

    if any(
        etiqueta in etiquetas
        for etiqueta in ("empanizado", "enlatado")
    ) and estado == "no_aplica":
        estado = "preparado"

    # Evita etiquetas duplicadas conservando su orden de lectura.
    etiquetas = list(dict.fromkeys(etiquetas))

    return nombre, categoria, estado, etiquetas


def _convertir_alimento_usda(
    alimento_usda: dict,
) -> Alimento:
    """Convierte el formato de USDA al formato interno de SilverBack."""

    fdc_id = str(alimento_usda.get("fdcId", ""))

    descripcion = " ".join(
        str(
            alimento_usda.get(
                "description",
                "Alimento sin nombre",
            )
        ).split()
    )[:200]

    nombre, categoria, estado, etiquetas = _datos_presentacion(
        descripcion
    )

    calorias = _obtener_nutriente(
        alimento_usda,
        {
            "Energy",
            "Energy (Atwater General Factors)",
            "Energy (Atwater Specific Factors)",
        },
        unidad="KCAL",
    )

    proteina = _obtener_nutriente(
        alimento_usda,
        {"Protein"},
        unidad="G",
    )

    carbohidratos = _obtener_nutriente(
        alimento_usda,
        {
            "Carbohydrate, by difference",
            "Carbohydrate, by summation",
        },
        unidad="G",
    )

    grasas = _obtener_nutriente(
        alimento_usda,
        {"Total lipid (fat)"},
        unidad="G",
    )

    fibra = _obtener_nutriente(
        alimento_usda,
        {"Fiber, total dietary"},
        unidad="G",
    )

    return Alimento(
        id=f"usda_{fdc_id}",
        nombre=nombre,
        nombre_original=descripcion,
        etiquetas=etiquetas,
        categoria=categoria,
        estado=estado,
        calorias=round(calorias, 2),
        proteina_g=round(proteina, 2),
        carbohidratos_g=round(carbohidratos, 2),
        grasas_g=round(grasas, 2),
        fibra_g=round(fibra, 2),
        fuente="USDA FoodData Central",
        fuente_id=fdc_id,
        alergenos=[],
    )


def _ordenar_alimentos_usda(
    alimentos: list[dict],
    consulta: str,
) -> list[dict]:
    """Prioriza coincidencias relevantes y datos genéricos sobre marcas."""

    terminos_consulta = set(_normalizar_texto(consulta).split())

    def clave(item_con_indice: tuple[int, dict]) -> tuple:
        indice, alimento = item_con_indice
        descripcion = _normalizar_texto(
            str(alimento.get("description", ""))
        )
        palabras = set(descripcion.split())
        coincidencias = len(terminos_consulta.intersection(palabras))
        tipo = str(alimento.get("dataType", ""))
        prioridad_tipo = TIPOS_USDA_PRIORIDAD.get(tipo, 5)

        nutrientes_completos = sum(
            1
            for nutriente in alimento.get("foodNutrients", [])
            if nutriente.get("value") not in (None, "")
        )

        return (
            -coincidencias,
            prioridad_tipo,
            -nutrientes_completos,
            indice,
        )

    ordenados = sorted(
        enumerate(alimentos),
        key=clave,
    )

    return [alimento for _, alimento in ordenados]


def _convertir_sin_duplicados(
    alimentos_usda: list[dict],
    limite: int,
) -> list[Alimento]:
    """Convierte resultados y oculta opciones visualmente repetidas."""

    resultados: list[Alimento] = []
    claves_vistas: set[tuple[str, tuple[str, ...]]] = set()

    for alimento_usda in alimentos_usda:
        alimento = _convertir_alimento_usda(alimento_usda)

        if not any((
            alimento.calorias,
            alimento.proteina_g,
            alimento.carbohidratos_g,
            alimento.grasas_g,
        )):
            continue

        clave = (
            _normalizar_texto(alimento.nombre),
            tuple(alimento.etiquetas),
        )

        if clave in claves_vistas:
            continue

        claves_vistas.add(clave)
        resultados.append(alimento)

        if len(resultados) >= limite:
            break

    return resultados


def buscar_alimentos_usda(
    consulta: str,
    limite: int = 10,
) -> list[Alimento]:
    """Busca en USDA y devuelve resultados claros para el usuario."""

    api_key = os.getenv("USDA_API_KEY")

    if not api_key:
        raise USDAClientError(
            "No se encontró USDA_API_KEY en el archivo .env."
        )

    consulta = consulta.strip()

    if len(consulta) < 2:
        raise USDAClientError(
            "La búsqueda debe tener al menos dos caracteres."
        )

    limite = max(1, min(limite, 25))
    consulta_usda = _traducir_consulta(consulta)

    # Se solicitan candidatos adicionales porque después se ordenan y se
    # eliminan duplicados. La respuesta final respeta el límite solicitado.
    cantidad_candidatos = min(
        max(limite * 4, 24),
        50,
    )

    parametros = {
        "api_key": api_key,
        "query": consulta_usda,
        "pageSize": cantidad_candidatos,
    }

    try:
        with httpx.Client(timeout=15.0) as cliente:
            response = cliente.get(
                USDA_SEARCH_URL,
                params=parametros,
            )

            response.raise_for_status()

    except httpx.TimeoutException as error:
        raise USDAClientError(
            "USDA tardó demasiado en responder."
        ) from error

    except httpx.HTTPStatusError as error:
        codigo = error.response.status_code

        raise USDAClientError(
            f"USDA respondió con el código HTTP {codigo}."
        ) from None

    except httpx.RequestError as error:
        raise USDAClientError(
            "No fue posible conectarse con USDA."
        ) from error

    try:
        datos = response.json()
    except ValueError as error:
        raise USDAClientError(
            "USDA devolvió una respuesta inválida."
        ) from error

    alimentos_encontrados = datos.get("foods", [])

    if not isinstance(alimentos_encontrados, list):
        raise USDAClientError(
            "USDA devolvió una lista de alimentos inválida."
        )

    alimentos_ordenados = _ordenar_alimentos_usda(
        alimentos_encontrados,
        consulta_usda,
    )

    return _convertir_sin_duplicados(
        alimentos_ordenados,
        limite,
    )
