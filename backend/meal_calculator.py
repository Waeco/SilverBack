from backend.portion_calculator import calcular_porcion
from backend.schemas import (
    ComidaCalculada,
    SolicitudComida,
)


def calcular_comida(
    solicitud: SolicitudComida,
) -> ComidaCalculada:
    """Calcula la suma nutricional de todos los ingredientes."""

    porciones = [
        calcular_porcion(
            alimento=ingrediente.alimento,
            gramos=ingrediente.gramos,
        )
        for ingrediente in solicitud.ingredientes
    ]

    calorias = sum(
        porcion.calorias
        for porcion in porciones
    )

    proteina = sum(
        porcion.proteina_g
        for porcion in porciones
    )

    carbohidratos = sum(
        porcion.carbohidratos_g
        for porcion in porciones
    )

    grasas = sum(
        porcion.grasas_g
        for porcion in porciones
    )

    fibra = sum(
        porcion.fibra_g
        for porcion in porciones
    )

    alergenos = sorted({
        alergeno
        for ingrediente in solicitud.ingredientes
        for alergeno in ingrediente.alimento.alergenos
    })

    return ComidaCalculada(
        nombre=solicitud.nombre,
        ingredientes=porciones,
        calorias=round(calorias, 2),
        proteina_g=round(proteina, 2),
        carbohidratos_g=round(
            carbohidratos,
            2,
        ),
        grasas_g=round(grasas, 2),
        fibra_g=round(fibra, 2),
        alergenos=alergenos,
    )