import pytest

from backend.portion_calculator import calcular_porcion
from backend.schemas import Alimento


@pytest.fixture
def pollo() -> Alimento:
    return Alimento(
        id="pollo_prueba",
        nombre="Pechuga de pollo cocida",
        categoria="proteina",
        estado="cocido",
        calorias=165,
        proteina_g=31,
        carbohidratos_g=0,
        grasas_g=3.6,
        fibra_g=0,
        fuente="USDA FoodData Central",
        fuente_id="prueba",
        alergenos=[],
    )


def test_porcion_150_gramos(
    pollo: Alimento,
) -> None:
    resultado = calcular_porcion(
        alimento=pollo,
        gramos=150,
    )

    assert resultado.gramos == 150
    assert resultado.calorias == 247.5
    assert resultado.proteina_g == 46.5
    assert resultado.carbohidratos_g == 0
    assert resultado.grasas_g == 5.4


def test_porcion_50_gramos(
    pollo: Alimento,
) -> None:
    resultado = calcular_porcion(
        alimento=pollo,
        gramos=50,
    )

    assert resultado.calorias == 82.5
    assert resultado.proteina_g == 15.5
    assert resultado.grasas_g == 1.8


def test_rechaza_cero_gramos(
    pollo: Alimento,
) -> None:
    with pytest.raises(
        ValueError,
        match="mayor que cero",
    ):
        calcular_porcion(
            alimento=pollo,
            gramos=0,
        )


def test_rechaza_porcion_excesiva(
    pollo: Alimento,
) -> None:
    with pytest.raises(
        ValueError,
        match="5000 gramos",
    ):
        calcular_porcion(
            alimento=pollo,
            gramos=6000,
        )