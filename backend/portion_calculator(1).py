from backend.schemas import (
    Alimento,
    PorcionCalculada,
)


def calcular_porcion(
    alimento: Alimento,
    gramos: float,
) -> PorcionCalculada:
    """
    Calcula los nutrientes de una porción.

    Los valores originales del alimento representan 100 gramos.
    """

    if gramos <= 0:
        raise ValueError(
            "La cantidad de gramos debe ser mayor que cero."
        )

    if gramos > 5000:
        raise ValueError(
            "La cantidad no puede superar los 5000 gramos."
        )

    factor = gramos / 100

    return PorcionCalculada(
        alimento_id=alimento.id,
        nombre=alimento.nombre,
        gramos=round(gramos, 2),
        calorias=round(
            alimento.calorias * factor,
            2,
        ),
        proteina_g=round(
            alimento.proteina_g * factor,
            2,
        ),
        carbohidratos_g=round(
            alimento.carbohidratos_g * factor,
            2,
        ),
        grasas_g=round(
            alimento.grasas_g * factor,
            2,
        ),
        fibra_g=round(
            alimento.fibra_g * factor,
            2,
        ),
        fuente=alimento.fuente,
        fuente_id=alimento.fuente_id,
    )