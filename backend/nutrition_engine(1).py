# Factores aproximados de actividad física
FACTORES_ACTIVIDAD = {
    "sedentario": 1.20,
    "ligero": 1.375,
    "moderado": 1.55,
    "activo": 1.725,
}

# Ajustes sobre las calorías de mantenimiento
FACTORES_OBJETIVO = {
    "deficit": 0.85,
    "mantenimiento": 1.00,
    "superavit": 1.10,
}

# Compatibilidad con los nombres usados actualmente en index.html
ALIAS_OBJETIVOS = {
    "definicion": "deficit",
    "volumen": "superavit",
    "mantenimiento": "mantenimiento",
    "deficit": "deficit",
    "superavit": "superavit",
}

# Proteína diaria aproximada según el objetivo, en gramos por kg
PROTEINA_POR_KG = {
    "deficit": 2.0,
    "mantenimiento": 1.6,
    "superavit": 1.8,
}


def validar_datos(
    peso_kg: float,
    altura_cm: float,
    edad: int,
    sexo: str,
    actividad: str,
    objetivo: str,
) -> None:
    """Valida que los datos recibidos sean razonables."""

    if not 30 <= peso_kg <= 300:
        raise ValueError("El peso debe estar entre 30 y 300 kg.")

    if not 120 <= altura_cm <= 250:
        raise ValueError("La altura debe estar entre 120 y 250 cm.")

    if not 18 <= edad <= 100:
        raise ValueError("Esta versión solamente admite adultos de 18 a 100 años.")

    if sexo not in {"hombre", "mujer"}:
        raise ValueError("El sexo debe ser 'hombre' o 'mujer'.")

    if actividad not in FACTORES_ACTIVIDAD:
        raise ValueError(
            f"Actividad no válida. Opciones: {list(FACTORES_ACTIVIDAD)}"
        )

    if objetivo not in ALIAS_OBJETIVOS:
        raise ValueError(
            f"Objetivo no válido. Opciones: {list(ALIAS_OBJETIVOS)}"
        )


def calcular_tmb(
    peso_kg: float,
    altura_cm: float,
    edad: int,
    sexo: str,
) -> float:
    """Calcula la tasa metabólica basal con Mifflin-St Jeor."""

    calculo_base = (
        10 * peso_kg
        + 6.25 * altura_cm
        - 5 * edad
    )

    if sexo == "hombre":
        return calculo_base + 5

    return calculo_base - 161


def calcular_objetivos(
    peso_kg: float,
    altura_cm: float,
    edad: int,
    sexo: str,
    actividad: str,
    objetivo: str,
) -> dict:
    """
    Calcula TMB, calorías de mantenimiento, calorías objetivo
    y distribución diaria de macronutrientes.
    """

    validar_datos(
        peso_kg,
        altura_cm,
        edad,
        sexo,
        actividad,
        objetivo,
    )

    objetivo_normalizado = ALIAS_OBJETIVOS[objetivo]

    tmb = calcular_tmb(
        peso_kg=peso_kg,
        altura_cm=altura_cm,
        edad=edad,
        sexo=sexo,
    )

    calorias_mantenimiento = (
        tmb * FACTORES_ACTIVIDAD[actividad]
    )

    calorias_objetivo = (
        calorias_mantenimiento
        * FACTORES_OBJETIVO[objetivo_normalizado]
    )

    proteina_g = (
        peso_kg
        * PROTEINA_POR_KG[objetivo_normalizado]
    )

    # Inicialmente se asigna 25% de las calorías a grasas
    grasas_g = (calorias_objetivo * 0.25) / 9

    calorias_proteina = proteina_g * 4
    calorias_grasas = grasas_g * 9

    calorias_disponibles_carbohidratos = (
        calorias_objetivo
        - calorias_proteina
        - calorias_grasas
    )

    if calorias_disponibles_carbohidratos <= 0:
        raise ValueError(
            "No es posible distribuir los macronutrientes "
            "con los datos proporcionados."
        )

    carbohidratos_g = (
        calorias_disponibles_carbohidratos / 4
    )

    # Redondeo final para mostrar resultados comprensibles
    calorias_objetivo = round(calorias_objetivo)
    proteina_g = round(proteina_g)
    grasas_g = round(grasas_g)
    carbohidratos_g = round(carbohidratos_g)

    calorias_calculadas_macros = (
        proteina_g * 4
        + carbohidratos_g * 4
        + grasas_g * 9
    )

    return {
        "tmb": round(tmb),
        "calorias_mantenimiento": round(calorias_mantenimiento),
        "calorias_objetivo": calorias_objetivo,
        "objetivo": objetivo_normalizado,
        "ajuste_porcentaje": round(
            (FACTORES_OBJETIVO[objetivo_normalizado] - 1) * 100
        ),
        "proteina_g": proteina_g,
        "carbohidratos_g": carbohidratos_g,
        "grasas_g": grasas_g,
        "calorias_calculadas_macros": calorias_calculadas_macros,
        "formula_utilizada": "Mifflin-St Jeor",
        "aviso": (
            "Resultados estimados para adultos sanos. "
            "No sustituyen una valoración nutricional profesional."
        ),
    }