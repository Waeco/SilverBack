from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


Sexo = Literal["hombre", "mujer"]

NivelActividad = Literal[
    "sedentario",
    "ligero",
    "moderado",
    "activo",
]

ObjetivoUsuario = Literal[
    "deficit",
    "definicion",
    "mantenimiento",
    "superavit",
    "volumen",
]

ObjetivoNormalizado = Literal[
    "deficit",
    "mantenimiento",
    "superavit",
]

MotivoSustitucion = Literal[
    "no_disponible",
    "no_gusta",
    "otro",
]

NutrienteReferencia = Literal[
    "calorias",
    "proteina",
    "carbohidratos",
    "grasas",
]


class SolicitudNutricional(BaseModel):
    """Datos que la página enviará al backend."""

    model_config = ConfigDict(
        str_strip_whitespace=True,
        extra="forbid",
    )

    peso_kg: float = Field(
        ge=30,
        le=300,
        description="Peso corporal en kilogramos",
    )

    altura_cm: float = Field(
        ge=120,
        le=250,
        description="Altura en centímetros",
    )

    edad: int = Field(
        ge=18,
        le=100,
        description="Edad en años",
    )

    sexo: Sexo
    actividad: NivelActividad
    objetivo: ObjetivoUsuario

    comidas_por_dia: int = Field(
        default=4,
        ge=2,
        le=6,
    )

    alergias: list[str] = Field(
        default_factory=list,
    )

    alimentos_excluidos: list[str] = Field(
        default_factory=list,
    )


class RespuestaNutricional(BaseModel):
    """Resultado calculado por el motor nutricional."""

    tmb: int
    calorias_mantenimiento: int
    calorias_objetivo: int

    objetivo: ObjetivoNormalizado
    ajuste_porcentaje: int

    proteina_g: int
    carbohidratos_g: int
    grasas_g: int

    calorias_calculadas_macros: int
    formula_utilizada: str
    aviso: str

class Alimento(BaseModel):
    """Información nutricional de un alimento por cada 100 gramos."""
    model_config = ConfigDict(
        str_strip_whitespace=True,
        extra="forbid",
    )

    id: str = Field(
        min_length=1,
        max_length=100,
  )

    nombre: str = Field(
        min_length=2,
        max_length=150,
    )

    nombre_original: str | None = Field(
        default=None,
        max_length=200,
        description="Descripción original proporcionada por USDA",
    )

    etiquetas: list[str] = Field(
        default_factory=list,
        description="Características como cocido, crudo o sin piel",
    )

    categoria: Literal[
        "proteina",
        "carbohidrato",
        "grasa",
        "fruta",
        "verdura",
        "lacteo",
        "leguminosa",
        "otro",
    ]

    estado: Literal[
        "crudo",
        "cocido",
        "preparado",
        "no_aplica",
    ]

    calorias: float = Field(ge=0)
    proteina_g: float = Field(ge=0)
    carbohidratos_g: float = Field(ge=0)
    grasas_g: float = Field(ge=0)
    fibra_g: float = Field(default=0, ge=0)

    fuente: str = Field(
        min_length=2,
        max_length=200,
    )

    fuente_id: str | None = None

    alergenos: list[str] = Field(
        default_factory=list,
    )

class PorcionCalculada(BaseModel):
    """Nutrientes calculados para una cantidad específica."""

    alimento_id: str
    nombre: str

    gramos: float = Field(
        gt=0,
        le=5000,
    )

    calorias: float = Field(ge=0)
    proteina_g: float = Field(ge=0)
    carbohidratos_g: float = Field(ge=0)
    grasas_g: float = Field(ge=0)
    fibra_g: float = Field(ge=0)

    fuente: str
    fuente_id: str | None = None

class SolicitudPorcion(BaseModel):
    """Alimento y cantidad solicitada por el usuario."""

    alimento: Alimento

    gramos: float = Field(
        gt=0,
        le=5000,
    )


class SolicitudSustitucion(BaseModel):
    """Datos necesarios para buscar sustituciones seguras."""

    model_config = ConfigDict(
        str_strip_whitespace=True,
        extra="forbid",
    )

    alimento_original: Alimento

    gramos_originales: float = Field(
        gt=0,
        le=5000,
    )

    candidatos: list[Alimento] = Field(
        min_length=1,
        max_length=50,
    )

    motivo: MotivoSustitucion = "otro"

    alergias: list[str] = Field(
        default_factory=list,
    )

    alimentos_excluidos: list[str] = Field(
        default_factory=list,
    )

    max_opciones: int = Field(
        default=5,
        ge=1,
        le=10,
    )

    solo_misma_categoria: bool = True


class OpcionSustitucion(BaseModel):
    """Alimento alternativo con su porción equivalente."""

    alimento: Alimento
    porcion: PorcionCalculada
    nutriente_referencia: NutrienteReferencia

    similitud_porcentaje: float = Field(
        ge=0,
        le=100,
    )

    diferencia_calorias: float
    diferencia_proteina_g: float
    diferencia_carbohidratos_g: float
    diferencia_grasas_g: float

    advertencias: list[str] = Field(
        default_factory=list,
    )


class ResultadoSustitucion(BaseModel):
    """Resultado ordenado sin modificar el plan del nutriólogo."""

    porcion_original: PorcionCalculada
    nutriente_referencia: NutrienteReferencia
    opciones: list[OpcionSustitucion]
    candidatos_descartados: int = Field(ge=0)
    mensaje: str

class IngredienteComida(BaseModel):
    """Alimento y cantidad utilizados en una comida."""

    alimento: Alimento

    gramos: float = Field(
        gt=0,
        le=5000,
    )


class SolicitudComida(BaseModel):
    """Datos necesarios para calcular una comida."""

    nombre: str = Field(
        min_length=2,
        max_length=100,
    )

    ingredientes: list[IngredienteComida] = Field(
        min_length=1,
        max_length=20,
    )


class ComidaCalculada(BaseModel):
    """Resultado nutricional de una comida completa."""

    nombre: str
    ingredientes: list[PorcionCalculada]

    calorias: float = Field(ge=0)
    proteina_g: float = Field(ge=0)
    carbohidratos_g: float = Field(ge=0)
    grasas_g: float = Field(ge=0)
    fibra_g: float = Field(ge=0)

    alergenos: list[str] = Field(
        default_factory=list,
    )

class SolicitudPlanDiario(BaseModel):
    """Perfil del usuario y comidas consumidas o planeadas."""

    perfil: SolicitudNutricional

    comidas: list[SolicitudComida] = Field(
        min_length=1,
        max_length=8,
    )


class PlanDiarioCalculado(BaseModel):
    """Resultado nutricional de todo el día."""

    objetivos: RespuestaNutricional
    comidas: list[ComidaCalculada]

    calorias_totales: float = Field(ge=0)
    proteina_total_g: float = Field(ge=0)
    carbohidratos_totales_g: float = Field(ge=0)
    grasas_totales_g: float = Field(ge=0)
    fibra_total_g: float = Field(ge=0)

    diferencia_calorias: float
    diferencia_proteina_g: float
    diferencia_carbohidratos_g: float
    diferencia_grasas_g: float

    cumplimiento_calorias_porcentaje: float

    estado_calorias: Literal[
        "bajo",
        "dentro_objetivo",
        "alto",
    ]

    alertas: list[str] = Field(
        default_factory=list,
    )
