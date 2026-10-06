from backend.meal_calculator import calcular_comida
from backend.nutrition_engine import calcular_objetivos
from backend.schemas import (
    PlanDiarioCalculado,
    RespuestaNutricional,
    SolicitudPlanDiario,
)


def calcular_plan_diario(
    solicitud: SolicitudPlanDiario,
) -> PlanDiarioCalculado:
    """Calcula y compara las comidas del día con el objetivo."""

    perfil = solicitud.perfil

    datos_objetivos = calcular_objetivos(
        peso_kg=perfil.peso_kg,
        altura_cm=perfil.altura_cm,
        edad=perfil.edad,
        sexo=perfil.sexo,
        actividad=perfil.actividad,
        objetivo=perfil.objetivo,
    )

    objetivos = RespuestaNutricional(
        **datos_objetivos
    )

    comidas_calculadas = [
        calcular_comida(comida)
        for comida in solicitud.comidas
    ]

    calorias_totales = sum(
        comida.calorias
        for comida in comidas_calculadas
    )

    proteina_total = sum(
        comida.proteina_g
        for comida in comidas_calculadas
    )

    carbohidratos_totales = sum(
        comida.carbohidratos_g
        for comida in comidas_calculadas
    )

    grasas_totales = sum(
        comida.grasas_g
        for comida in comidas_calculadas
    )

    fibra_total = sum(
        comida.fibra_g
        for comida in comidas_calculadas
    )

    cumplimiento = (
        calorias_totales
        / objetivos.calorias_objetivo
        * 100
    )

    if cumplimiento < 95:
        estado = "bajo"
    elif cumplimiento <= 105:
        estado = "dentro_objetivo"
    else:
        estado = "alto"

    alertas = []

    alergias_usuario = {
        alergia.strip().casefold()
        for alergia in perfil.alergias
    }

    alergenos_plan = {
        alergeno.strip().casefold()
        for comida in comidas_calculadas
        for alergeno in comida.alergenos
    }

    alergias_detectadas = sorted(
        alergias_usuario.intersection(
            alergenos_plan
        )
    )

    if alergias_detectadas:
        alertas.append(
            "El plan contiene alérgenos declarados: "
            + ", ".join(alergias_detectadas)
        )

    return PlanDiarioCalculado(
        objetivos=objetivos,
        comidas=comidas_calculadas,
        calorias_totales=round(
            calorias_totales,
            2,
        ),
        proteina_total_g=round(
            proteina_total,
            2,
        ),
        carbohidratos_totales_g=round(
            carbohidratos_totales,
            2,
        ),
        grasas_totales_g=round(
            grasas_totales,
            2,
        ),
        fibra_total_g=round(
            fibra_total,
            2,
        ),
        diferencia_calorias=round(
            calorias_totales
            - objetivos.calorias_objetivo,
            2,
        ),
        diferencia_proteina_g=round(
            proteina_total
            - objetivos.proteina_g,
            2,
        ),
        diferencia_carbohidratos_g=round(
            carbohidratos_totales
            - objetivos.carbohidratos_g,
            2,
        ),
        diferencia_grasas_g=round(
            grasas_totales
            - objetivos.grasas_g,
            2,
        ),
        cumplimiento_calorias_porcentaje=round(
            cumplimiento,
            2,
        ),
        estado_calorias=estado,
        alertas=alertas,
    )