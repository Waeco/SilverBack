from fastapi.testclient import TestClient

from backend.app import app


client = TestClient(app)


def test_estado_api():
    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json()["estado"] == "funcionando"


def test_calcular_objetivos():
    response = client.post(
        "/api/nutrition/targets",
        json={
            "peso_kg": 76,
            "altura_cm": 172,
            "edad": 25,
            "sexo": "hombre",
            "actividad": "moderado",
            "objetivo": "superavit",
            "comidas_por_dia": 4,
            "alergias": [],
            "alimentos_excluidos": [],
        },
    )

    assert response.status_code == 200

    resultado = response.json()

    assert resultado["calorias_objetivo"] > 0
    assert resultado["proteina_g"] > 0
    assert resultado["carbohidratos_g"] > 0
    assert resultado["grasas_g"] > 0

    diferencia = abs(
        resultado["calorias_objetivo"]
        - resultado["calorias_calculadas_macros"]
    )

    assert diferencia <= 10


def test_rechazar_peso_invalido():
    response = client.post(
        "/api/nutrition/targets",
        json={
            "peso_kg": 10,
            "altura_cm": 172,
            "edad": 25,
            "sexo": "hombre",
            "actividad": "moderado",
            "objetivo": "superavit",
        },
    )

    assert response.status_code == 422


def test_rechazar_campo_desconocido():
    response = client.post(
        "/api/nutrition/targets",
        json={
            "peso_kg": 76,
            "altura_cm": 172,
            "edad": 25,
            "sexo": "hombre",
            "actividad": "moderado",
            "objetivo": "superavit",
            "campo_inventado": "valor",
        },
    )

    assert response.status_code == 422