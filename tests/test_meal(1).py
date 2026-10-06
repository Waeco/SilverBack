import pytest

from backend.meal_calculator import calcular_comida
from backend.schemas import (
    Alimento,
    IngredienteComida,
    SolicitudComida,
)


def test_calcular_comida_completa() -> None:
    pollo = Alimento(
        id="pollo",
        nombre="Pechuga de pollo cocida",
        categoria="proteina",
        estado="cocido",
        calorias=165,
        proteina_g=31,
        carbohidratos_g=0,
        grasas_g=3.6,
        fibra_g=0,
        fuente="USDA FoodData Central",
        fuente_id="pollo",
        alergenos=[],
    )

    arroz = Alimento(
        id="arroz",
        nombre="Arroz blanco cocido",
        categoria="carbohidrato",
        estado="cocido",
        calorias=130,
        proteina_g=2.69,
        carbohidratos_g=28.17,
        grasas_g=0.28,
        fibra_g=0.4,
        fuente="USDA FoodData Central",
        fuente_id="arroz",
        alergenos=[],
    )

    brocoli = Alimento(
        id="brocoli",
        nombre="Brócoli cocido",
        categoria="verdura",
        estado="cocido",
        calorias=35,
        proteina_g=2.38,
        carbohidratos_g=7.18,
        grasas_g=0.41,
        fibra_g=3.3,
        fuente="USDA FoodData Central",
        fuente_id="brocoli",
        alergenos=[],
    )

    solicitud = SolicitudComida(
        nombre="Pollo con arroz y brócoli",
        ingredientes=[
            IngredienteComida(
                alimento=pollo,
                gramos=150,
            ),
            IngredienteComida(
                alimento=arroz,
                gramos=200,
            ),
            IngredienteComida(
                alimento=brocoli,
                gramos=100,
            ),
        ],
    )

    resultado = calcular_comida(solicitud)

    assert resultado.nombre == "Pollo con arroz y brócoli"
    assert len(resultado.ingredientes) == 3

    assert resultado.calorias == pytest.approx(
        542.5,
        abs=0.01,
    )

    assert resultado.proteina_g == pytest.approx(
        54.26,
        abs=0.01,
    )

    assert resultado.carbohidratos_g == pytest.approx(
        63.52,
        abs=0.01,
    )

    assert resultado.grasas_g == pytest.approx(
        6.37,
        abs=0.01,
    )

    assert resultado.fibra_g == pytest.approx(
        4.1,
        abs=0.01,
    )

    assert resultado.alergenos == []