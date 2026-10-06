import json
from pathlib import Path

from backend.schemas import Alimento


BASE_DIR = Path(__file__).resolve().parent.parent
ARCHIVO_ALIMENTOS = BASE_DIR / "data" / "alimentos.json"


def cargar_alimentos() -> list[Alimento]:
    """Carga y valida los alimentos almacenados en el archivo JSON."""

    if not ARCHIVO_ALIMENTOS.exists():
        raise FileNotFoundError(
            f"No se encontró el archivo: {ARCHIVO_ALIMENTOS}"
        )

    contenido = ARCHIVO_ALIMENTOS.read_text(
        encoding="utf-8"
    )

    datos = json.loads(contenido)

    if not isinstance(datos, list):
        raise ValueError(
            "El archivo alimentos.json debe contener una lista."
        )

    return [
        Alimento.model_validate(alimento)
        for alimento in datos
    ]


def buscar_alimentos(
    texto: str = "",
    categoria: str | None = None,
) -> list[Alimento]:
    """Busca alimentos por nombre y categoría."""

    alimentos = cargar_alimentos()
    texto_normalizado = texto.strip().lower()

    resultados = []

    for alimento in alimentos:
        coincide_nombre = (
            not texto_normalizado
            or texto_normalizado in alimento.nombre.lower()
        )

        coincide_categoria = (
            categoria is None
            or alimento.categoria == categoria
        )

        if coincide_nombre and coincide_categoria:
            resultados.append(alimento)

    return resultados


def obtener_alimento_por_id(
    alimento_id: str,
) -> Alimento | None:
    """Obtiene un alimento específico mediante su identificador."""

    for alimento in cargar_alimentos():
        if alimento.id == alimento_id:
            return alimento

    return None