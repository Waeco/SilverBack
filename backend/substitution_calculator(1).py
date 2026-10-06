import unicodedata

from backend.portion_calculator import calcular_porcion
from backend.schemas import (
    Alimento,
    NutrienteReferencia,
    OpcionSustitucion,
    PorcionCalculada,
    ResultadoSustitucion,
    SolicitudSustitucion,
)


CAMPOS_NUTRIENTES = {
    "calorias": "calorias",
    "proteina": "proteina_g",
    "carbohidratos": "carbohidratos_g",
    "grasas": "grasas_g",
}


REFERENCIA_POR_CATEGORIA: dict[str, NutrienteReferencia] = {
    "proteina": "proteina",
    "carbohidrato": "carbohidratos",
    "fruta": "carbohidratos",
    "verdura": "carbohidratos",
    "leguminosa": "carbohidratos",
    "grasa": "grasas",
    "lacteo": "calorias",
    "otro": "calorias",
}


ALERGENOS_CANONICOS = {
    "milk": "leche",
    "dairy": "leche",
    "lacteos": "leche",
    "lactosa": "leche",
    "egg": "huevo",
    "eggs": "huevo",
    "peanut": "cacahuate",
    "peanuts": "cacahuate",
    "mani": "cacahuate",
    "tree nuts": "nueces",
    "nuez": "nueces",
    "almond": "nueces",
    "soy": "soya",
    "soja": "soya",
    "wheat": "trigo",
    "gluten": "trigo",
    "fish": "pescado",
    "shellfish": "mariscos",
}


TERMINOS_POR_ALERGENO = {
    "leche": {
        "leche",
        "milk",
        "yogur",
        "yogurt",
        "queso",
        "cheese",
        "whey",
        "casein",
    },
    "huevo": {"huevo", "egg", "eggs"},
    "cacahuate": {"cacahuate", "peanut", "peanuts", "mani"},
    "nueces": {
        "nuez",
        "nueces",
        "almond",
        "almendras",
        "walnut",
        "cashew",
        "pistachio",
        "hazelnut",
    },
    "soya": {"soya", "soja", "soy", "tofu"},
    "trigo": {
        "trigo",
        "wheat",
        "pan",
        "bread",
        "pasta",
        "harina",
        "flour",
    },
    "pescado": {
        "pescado",
        "fish",
        "salmon",
        "atun",
        "tuna",
        "tilapia",
    },
    "mariscos": {
        "mariscos",
        "shellfish",
        "camaron",
        "shrimp",
        "crab",
        "lobster",
    },
}


def _normalizar_texto(texto: str) -> str:
    """Normaliza texto para comparar alergias y exclusiones."""

    texto_sin_acentos = "".join(
        caracter
        for caracter in unicodedata.normalize("NFD", texto.casefold())
        if unicodedata.category(caracter) != "Mn"
    )

    return " ".join(texto_sin_acentos.split())


def _normalizar_alergeno(alergeno: str) -> str:
    """Unifica sinónimos frecuentes en español e inglés."""

    alergeno_normalizado = _normalizar_texto(alergeno)
    return ALERGENOS_CANONICOS.get(
        alergeno_normalizado,
        alergeno_normalizado,
    )


def _valor_por_100(
    alimento: Alimento,
    referencia: NutrienteReferencia,
) -> float:
    """Obtiene la densidad del nutriente por cada 100 gramos."""

    campo = CAMPOS_NUTRIENTES[referencia]
    return float(getattr(alimento, campo))


def _valor_porcion(
    porcion: PorcionCalculada,
    referencia: NutrienteReferencia,
) -> float:
    """Obtiene el nutriente de una porción ya calculada."""

    campo = CAMPOS_NUTRIENTES[referencia]
    return float(getattr(porcion, campo))


def _elegir_referencia(
    alimento: Alimento,
) -> NutrienteReferencia:
    """Elige el nutriente que debe conservar la sustitución."""

    referencia = REFERENCIA_POR_CATEGORIA[alimento.categoria]

    if _valor_por_100(alimento, referencia) > 0:
        return referencia

    referencias_alternativas: tuple[NutrienteReferencia, ...] = (
        "calorias",
        "proteina",
        "carbohidratos",
        "grasas",
    )

    for alternativa in referencias_alternativas:
        if _valor_por_100(alimento, alternativa) > 0:
            return alternativa

    raise ValueError(
        "El alimento original no contiene datos suficientes para calcular "
        "una sustitución."
    )


def _esta_excluido(
    alimento: Alimento,
    exclusiones: set[str],
) -> bool:
    """Comprueba el nombre español y la descripción original."""

    if not exclusiones:
        return False

    nombres = [alimento.nombre]

    if alimento.nombre_original:
        nombres.append(alimento.nombre_original)

    for nombre in nombres:
        nombre_normalizado = f" {_normalizar_texto(nombre)} "

        if any(
            f" {exclusion} " in nombre_normalizado
            for exclusion in exclusiones
        ):
            return True

    return False


def _contiene_alergeno(
    alimento: Alimento,
    alergias: set[str],
) -> bool:
    """Descarta candidatos con alérgenos declarados por el cliente."""

    alergenos_declarados = {
        _normalizar_alergeno(alergeno)
        for alergeno in alimento.alergenos
    }

    if alergenos_declarados.intersection(alergias):
        return True

    nombres = [alimento.nombre]

    if alimento.nombre_original:
        nombres.append(alimento.nombre_original)

    texto_alimento = f" {_normalizar_texto(' '.join(nombres))} "

    for alergia in alergias:
        terminos = TERMINOS_POR_ALERGENO.get(
            alergia,
            {alergia},
        )

        if any(
            f" {_normalizar_texto(termino)} " in texto_alimento
            for termino in terminos
        ):
            return True

    return False


def _diferencia_relativa(
    valor: float,
    objetivo: float,
) -> float:
    """Calcula una diferencia limitada para evitar valores extremos."""

    escala = max(abs(objetivo), 1.0)
    return min(abs(valor - objetivo) / escala, 2.0)


def _calcular_similitud(
    original: PorcionCalculada,
    alternativa: PorcionCalculada,
) -> float:
    """Compara calorías y macros sin delegar aritmética a la IA."""

    diferencias = (
        _diferencia_relativa(
            alternativa.calorias,
            original.calorias,
        ) * 0.40,
        _diferencia_relativa(
            alternativa.proteina_g,
            original.proteina_g,
        ) * 0.25,
        _diferencia_relativa(
            alternativa.carbohidratos_g,
            original.carbohidratos_g,
        ) * 0.20,
        _diferencia_relativa(
            alternativa.grasas_g,
            original.grasas_g,
        ) * 0.15,
    )

    penalizacion = min(sum(diferencias) * 100, 100)
    return round(100 - penalizacion, 2)


def _crear_advertencias(
    original: Alimento,
    candidato: Alimento,
    gramos: float,
    similitud: float,
) -> list[str]:
    """Genera avisos claros sin diagnosticar ni sustituir al nutriólogo."""

    advertencias: list[str] = []

    if candidato.categoria != original.categoria:
        advertencias.append(
            "Pertenece a un grupo alimenticio diferente."
        )

    estados_comparables = (
        original.estado != "no_aplica"
        and candidato.estado != "no_aplica"
    )

    if estados_comparables and candidato.estado != original.estado:
        advertencias.append(
            "La preparación es diferente a la indicada originalmente."
        )

    if gramos > 1000:
        advertencias.append(
            "La porción equivalente es inusualmente grande."
        )

    if similitud < 75:
        advertencias.append(
            "La equivalencia es aproximada; conviene revisarla con el "
            "nutriólogo."
        )

    return advertencias


def calcular_sustituciones(
    solicitud: SolicitudSustitucion,
) -> ResultadoSustitucion:
    """Calcula alternativas sin modificar el plan profesional original."""

    original = solicitud.alimento_original
    porcion_original = calcular_porcion(
        alimento=original,
        gramos=solicitud.gramos_originales,
    )

    referencia = _elegir_referencia(original)
    objetivo_referencia = _valor_porcion(
        porcion_original,
        referencia,
    )

    alergias = {
        _normalizar_alergeno(alergia)
        for alergia in solicitud.alergias
        if alergia.strip()
    }

    exclusiones = {
        _normalizar_texto(exclusion)
        for exclusion in solicitud.alimentos_excluidos
        if exclusion.strip()
    }

    opciones: list[OpcionSustitucion] = []
    identificadores_vistos: set[str] = set()

    for candidato in solicitud.candidatos:
        if candidato.id == original.id:
            continue

        if candidato.id in identificadores_vistos:
            continue

        identificadores_vistos.add(candidato.id)

        if (
            solicitud.solo_misma_categoria
            and candidato.categoria != original.categoria
        ):
            continue

        if _esta_excluido(candidato, exclusiones):
            continue

        if _contiene_alergeno(candidato, alergias):
            continue

        densidad_candidato = _valor_por_100(
            candidato,
            referencia,
        )

        if densidad_candidato <= 0:
            continue

        gramos_equivalentes = round(
            objetivo_referencia
            / densidad_candidato
            * 100,
            2,
        )

        if not 0 < gramos_equivalentes <= 5000:
            continue

        porcion_alternativa = calcular_porcion(
            alimento=candidato,
            gramos=gramos_equivalentes,
        )

        similitud = _calcular_similitud(
            porcion_original,
            porcion_alternativa,
        )

        opciones.append(
            OpcionSustitucion(
                alimento=candidato,
                porcion=porcion_alternativa,
                nutriente_referencia=referencia,
                similitud_porcentaje=similitud,
                diferencia_calorias=round(
                    porcion_alternativa.calorias
                    - porcion_original.calorias,
                    2,
                ),
                diferencia_proteina_g=round(
                    porcion_alternativa.proteina_g
                    - porcion_original.proteina_g,
                    2,
                ),
                diferencia_carbohidratos_g=round(
                    porcion_alternativa.carbohidratos_g
                    - porcion_original.carbohidratos_g,
                    2,
                ),
                diferencia_grasas_g=round(
                    porcion_alternativa.grasas_g
                    - porcion_original.grasas_g,
                    2,
                ),
                advertencias=_crear_advertencias(
                    original=original,
                    candidato=candidato,
                    gramos=gramos_equivalentes,
                    similitud=similitud,
                ),
            )
        )

    opciones.sort(
        key=lambda opcion: (
            -opcion.similitud_porcentaje,
            abs(opcion.diferencia_calorias),
            opcion.alimento.nombre.casefold(),
        )
    )

    opciones_seleccionadas = opciones[:solicitud.max_opciones]
    candidatos_descartados = max(
        len(solicitud.candidatos)
        - len(opciones_seleccionadas),
        0,
    )

    if opciones_seleccionadas:
        mensaje = (
            "Opciones calculadas sin modificar el plan original. "
            "Los cambios permanentes deben ser revisados por el nutriólogo."
        )
    else:
        mensaje = (
            "No se encontraron opciones compatibles con la categoría, "
            "las alergias y los alimentos excluidos."
        )

    return ResultadoSustitucion(
        porcion_original=porcion_original,
        nutriente_referencia=referencia,
        opciones=opciones_seleccionadas,
        candidatos_descartados=candidatos_descartados,
        mensaje=mensaje,
    )
