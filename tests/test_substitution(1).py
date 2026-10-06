import pytest

from backend.schemas import (
    Alimento,
    SolicitudSustitucion,
)
from backend.substitution_calculator import calcular_sustituciones


def crear_alimento(
    identificador: str,
    nombre: str,
    categoria: str,
    calorias: float,
    proteina: float,
    carbohidratos: float,
    grasas: float,
    alergenos: list[str] | None = None,
) -> Alimento:
    return Alimento(
        id=identificador,
        nombre=nombre,
        categoria=categoria,
        estado="cocido",
        calorias=calorias,
        proteina_g=proteina,
        carbohidratos_g=carbohidratos,
        grasas_g=grasas,
        fibra_g=0,
        fuente="Prueba",
        fuente_id=identificador,
        alergenos=alergenos or [],
    )


def test_sustituye_proteina_y_ajusta_gramos() -> None:
    pollo = crear_alimento(
        "pollo",
        "Pechuga de pollo",
        "proteina",
        165,
        31,
        0,
        3.6,
    )

    pavo = crear_alimento(
        "pavo",
        "Pechuga de pavo",
        "proteina",
        135,
        29,
        0,
        1.8,
    )

    arroz = crear_alimento(
        "arroz",
        "Arroz blanco",
        "carbohidrato",
        130,
        2.7,
        28,
        0.3,
    )

    solicitud = SolicitudSustitucion(
        alimento_original=pollo,
        gramos_originales=150,
        candidatos=[arroz, pavo],
        motivo="no_disponible",
    )

    resultado = calcular_sustituciones(solicitud)

    assert resultado.nutriente_referencia == "proteina"
    assert resultado.porcion_original.proteina_g == 46.5
    assert len(resultado.opciones) == 1
    assert resultado.candidatos_descartados == 1

    opcion = resultado.opciones[0]

    assert opcion.alimento.id == "pavo"
    assert opcion.porcion.gramos == pytest.approx(
        160.34,
        abs=0.01,
    )
    assert opcion.porcion.proteina_g == pytest.approx(
        46.5,
        abs=0.01,
    )
    assert opcion.similitud_porcentaje > 80


def test_descarta_alergeno_declarado() -> None:
    yogur = crear_alimento(
        "yogur",
        "Yogur natural",
        "lacteo",
        61,
        3.5,
        4.7,
        3.3,
    )

    yogur_griego = crear_alimento(
        "yogur_griego",
        "Yogur griego",
        "lacteo",
        97,
        9,
        4,
        5,
    )

    solicitud = SolicitudSustitucion(
        alimento_original=yogur,
        gramos_originales=200,
        candidatos=[yogur_griego],
        alergias=["Leche"],
    )

    resultado = calcular_sustituciones(solicitud)

    assert resultado.opciones == []
    assert resultado.candidatos_descartados == 1
    assert "No se encontraron" in resultado.mensaje


def test_descarta_alimento_excluido() -> None:
    pollo = crear_alimento(
        "pollo",
        "Pechuga de pollo",
        "proteina",
        165,
        31,
        0,
        3.6,
    )

    pavo = crear_alimento(
        "pavo",
        "Pechuga de pavo",
        "proteina",
        135,
        29,
        0,
        1.8,
    )

    solicitud = SolicitudSustitucion(
        alimento_original=pollo,
        gramos_originales=150,
        candidatos=[pavo],
        alimentos_excluidos=["pavo"],
    )

    resultado = calcular_sustituciones(solicitud)

    assert resultado.opciones == []
    assert resultado.candidatos_descartados == 1


def test_avisa_si_se_permite_otra_categoria() -> None:
    pollo = crear_alimento(
        "pollo",
        "Pechuga de pollo",
        "proteina",
        165,
        31,
        0,
        3.6,
    )

    lentejas = crear_alimento(
        "lentejas",
        "Lentejas",
        "leguminosa",
        116,
        9,
        20,
        0.4,
    )

    solicitud = SolicitudSustitucion(
        alimento_original=pollo,
        gramos_originales=150,
        candidatos=[lentejas],
        solo_misma_categoria=False,
    )

    resultado = calcular_sustituciones(solicitud)

    assert len(resultado.opciones) == 1
    assert any(
        "grupo alimenticio diferente" in advertencia
        for advertencia in resultado.opciones[0].advertencias
    )


def test_rechaza_original_sin_datos_nutricionales() -> None:
    original = crear_alimento(
        "sin_datos",
        "Alimento sin datos",
        "otro",
        0,
        0,
        0,
        0,
    )

    candidato = crear_alimento(
        "candidato",
        "Alimento candidato",
        "otro",
        100,
        1,
        10,
        5,
    )

    solicitud = SolicitudSustitucion(
        alimento_original=original,
        gramos_originales=100,
        candidatos=[candidato],
    )

    with pytest.raises(
        ValueError,
        match="datos suficientes",
    ):
        calcular_sustituciones(solicitud)
