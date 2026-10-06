from backend.daily_plan_calculator import (
    calcular_plan_diario,
)
from backend.schemas import (
    Alimento,
    IngredienteComida,
    SolicitudComida,
    SolicitudNutricional,
    SolicitudPlanDiario,
)


def crear_perfil(
    alergias: list[str] | None = None,
) -> SolicitudNutricional:
    return SolicitudNutricional(
        peso_kg=76,
        altura_cm=172,
        edad=25,
        sexo="hombre",
        actividad="moderado",
        objetivo="superavit",
        comidas_por_dia=4,
        alergias=alergias or [],
        alimentos_excluidos=[],
    )


def test_calcular_plan_diario() -> None:
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

    comida = SolicitudComida(
        nombre="Comida principal",
        ingredientes=[
            IngredienteComida(
                alimento=pollo,
                gramos=150,
            )
        ],
    )

    solicitud = SolicitudPlanDiario(
        perfil=crear_perfil(),
        comidas=[comida],
    )

    resultado = calcular_plan_diario(
        solicitud
    )

    assert resultado.objetivos.calorias_objetivo == 2924
    assert resultado.calorias_totales == 247.5
    assert resultado.proteina_total_g == 46.5
    assert resultado.estado_calorias == "bajo"
    assert resultado.diferencia_calorias < 0
    assert resultado.alertas == []


def test_detectar_alergeno() -> None:
    huevo = Alimento(
        id="huevo",
        nombre="Huevo entero cocido",
        categoria="proteina",
        estado="cocido",
        calorias=155,
        proteina_g=12.58,
        carbohidratos_g=1.12,
        grasas_g=10.61,
        fibra_g=0,
        fuente="USDA FoodData Central",
        fuente_id="huevo",
        alergenos=["huevo"],
    )

    desayuno = SolicitudComida(
        nombre="Desayuno con huevo",
        ingredientes=[
            IngredienteComida(
                alimento=huevo,
                gramos=100,
            )
        ],
    )

    solicitud = SolicitudPlanDiario(
        perfil=crear_perfil(
            alergias=["Huevo"],
        ),
        comidas=[desayuno],
    )

    resultado = calcular_plan_diario(
        solicitud
    )

    assert len(resultado.alertas) == 1
    assert "huevo" in resultado.alertas[0]