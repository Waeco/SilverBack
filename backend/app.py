from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from backend.meal_calculator import calcular_comida
from backend.portion_calculator import calcular_porcion
from backend.daily_plan_calculator import calcular_plan_diario
from backend.substitution_calculator import calcular_sustituciones
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from backend.nutrition_engine import calcular_objetivos
from backend.schemas import (
    Alimento,
    ComidaCalculada,
    PlanDiarioCalculado,
    PorcionCalculada,
    RespuestaNutricional,
    ResultadoSustitucion,
    SolicitudComida,
    SolicitudNutricional,
    SolicitudPlanDiario,
    SolicitudPorcion,
    SolicitudSustitucion,
)
from backend.usda_client import (
    USDAClientError,
    buscar_alimentos_usda,
)


# Localización de la carpeta principal y del frontend
BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = BASE_DIR / "frontend"


app = FastAPI(
    title="SilverBack API",
    description="Motor de cálculo nutricional de SilverBack",
    version="1.0.0",
)


# Permite conectar la interfaz durante el desarrollo local
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://localhost:5500",
        "http://127.0.0.1:5500",
    ],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


@app.get(
    "/api/health",
    tags=["Sistema"],
)
def verificar_estado() -> dict:
    """Comprueba que la API se encuentra funcionando."""

    return {
        "estado": "funcionando",
        "servicio": "SilverBack API",
        "version": "1.0.0",
    }


@app.post(
    "/api/nutrition/targets",
    response_model=RespuestaNutricional,
    tags=["Nutrición"],
)
def obtener_objetivos(
    solicitud: SolicitudNutricional,
) -> RespuestaNutricional:
    """Calcula calorías y macronutrientes del usuario."""

    try:
        resultado = calcular_objetivos(
            peso_kg=solicitud.peso_kg,
            altura_cm=solicitud.altura_cm,
            edad=solicitud.edad,
            sexo=solicitud.sexo,
            actividad=solicitud.actividad,
            objetivo=solicitud.objetivo,
        )

        return RespuestaNutricional(**resultado)

    except ValueError as error:
        raise HTTPException(
            status_code=422,
            detail=str(error),
        ) from error


@app.get(
    "/api/foods/search",
    response_model=list[Alimento],
    tags=["Alimentos"],
)
def buscar_alimentos(
    query: str = Query(
        min_length=2,
        max_length=100,
        description="Nombre del alimento que se desea buscar",
    ),
    limit: int = Query(
        default=10,
        ge=1,
        le=25,
        description="Cantidad máxima de resultados",
    ),
) -> list[Alimento]:
    """Busca alimentos mediante USDA FoodData Central."""

    try:
        return buscar_alimentos_usda(
            consulta=query,
            limite=limit,
        )

    except USDAClientError as error:
        raise HTTPException(
            status_code=502,
            detail=str(error),
        ) from error


@app.post(
    "/api/foods/portion",
    response_model=PorcionCalculada,
    tags=["Alimentos"],
)
def obtener_porcion(
    solicitud: SolicitudPorcion,
) -> PorcionCalculada:
    """Calcula nutrientes para una cantidad específica."""

    try:
        return calcular_porcion(
            alimento=solicitud.alimento,
            gramos=solicitud.gramos,
        )

    except ValueError as error:
        raise HTTPException(
            status_code=422,
            detail=str(error),
        ) from error


@app.post(
    "/api/foods/substitutions",
    response_model=ResultadoSustitucion,
    tags=["Alimentos"],
)
def obtener_sustituciones(
    solicitud: SolicitudSustitucion,
) -> ResultadoSustitucion:
    """Calcula sustituciones sin cambiar el plan del nutriólogo."""

    try:
        return calcular_sustituciones(solicitud)

    except ValueError as error:
        raise HTTPException(
            status_code=422,
            detail=str(error),
        ) from error


@app.post(
    "/api/meals/calculate",
    response_model=ComidaCalculada,
    tags=["Comidas"],
)
def obtener_calculo_comida(
    solicitud: SolicitudComida,
) -> ComidaCalculada:
    """Calcula los nutrientes totales de una comida."""

    try:
        return calcular_comida(solicitud)

    except ValueError as error:
        raise HTTPException(
            status_code=422,
            detail=str(error),
        ) from error

@app.post(
    "/api/plans/daily/calculate",
    response_model=PlanDiarioCalculado,
    tags=["Planes"],
)
def obtener_plan_diario(
    solicitud: SolicitudPlanDiario,
) -> PlanDiarioCalculado:
    """Calcula y compara todas las comidas del día."""

    try:
        return calcular_plan_diario(
            solicitud
        )

    except ValueError as error:
        raise HTTPException(
            status_code=422,
            detail=str(error),
        ) from error


@app.get(
    "/",
    include_in_schema=False,
)
def mostrar_frontend() -> FileResponse:
    """Muestra la interfaz principal de SilverBack."""

    archivo_index = FRONTEND_DIR / "index.html"

    if not archivo_index.exists():
        raise HTTPException(
            status_code=404,
            detail="No se encontró frontend/index.html",
        )

    return FileResponse(archivo_index)
