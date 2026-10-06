import pytest

from backend.nutrition_engine import calcular_objetivos


def test_calculo_superavit():
    resultado = calcular_objetivos(
        peso_kg=76,
        altura_cm=172,
        edad=25,
        sexo="hombre",
        actividad="moderado",
        objetivo="superavit",
    )

    assert resultado["objetivo"] == "superavit"
    assert (
        resultado["calorias_objetivo"]
        > resultado["calorias_mantenimiento"]
    )

    diferencia = abs(
        resultado["calorias_objetivo"]
        - resultado["calorias_calculadas_macros"]
    )

    assert diferencia <= 10


def test_calculo_deficit():
    resultado = calcular_objetivos(
        peso_kg=70,
        altura_cm=165,
        edad=30,
        sexo="mujer",
        actividad="ligero",
        objetivo="deficit",
    )

    assert resultado["objetivo"] == "deficit"
    assert (
        resultado["calorias_objetivo"]
        < resultado["calorias_mantenimiento"]
    )
    assert resultado["proteina_g"] > 0
    assert resultado["carbohidratos_g"] > 0
    assert resultado["grasas_g"] > 0


def test_calculo_mantenimiento():
    resultado = calcular_objetivos(
        peso_kg=80,
        altura_cm=180,
        edad=35,
        sexo="hombre",
        actividad="activo",
        objetivo="mantenimiento",
    )

    assert resultado["objetivo"] == "mantenimiento"
    assert (
        resultado["calorias_objetivo"]
        == resultado["calorias_mantenimiento"]
    )


def test_compatibilidad_con_volumen():
    resultado = calcular_objetivos(
        peso_kg=76,
        altura_cm=172,
        edad=25,
        sexo="hombre",
        actividad="moderado",
        objetivo="volumen",
    )

    assert resultado["objetivo"] == "superavit"


def test_rechaza_menores_de_edad():
    with pytest.raises(
        ValueError,
        match="solamente admite adultos",
    ):
        calcular_objetivos(
            peso_kg=60,
            altura_cm=165,
            edad=16,
            sexo="mujer",
            actividad="moderado",
            objetivo="mantenimiento",
        )


def test_rechaza_peso_invalido():
    with pytest.raises(ValueError, match="peso"):
        calcular_objetivos(
            peso_kg=10,
            altura_cm=172,
            edad=25,
            sexo="hombre",
            actividad="moderado",
            objetivo="superavit",
        )