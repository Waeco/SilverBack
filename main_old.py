import time
import json

# --- CONFIGURACIÓN DE PRUEBA (MOCK) ---
# Cambia esto a False cuando Google termine de propagar tu cuota mañana
USAR_SIMULADOR = True 

prompt = """
Calcula los macronutrientes diarios para un atleta de 76 kg y 1.72 m enfocado en aumento de masa muscular.
"""

print("Enviando petición limpia al backend de SilverBack...")
time.sleep(1) # Simula la espera del servidor

if USAR_SIMULADOR:
    print("\n Generando respuesta estructurada...")
    
    # Esta es la respuesta exacta en formato JSON puro que esperas de la IA
    respuesta_mock = {
        "calorias_totales": 3100,
        "proteinas_g": 165,
        "carbohidratos_g": 410,
        "grasas_g": 88,
        "explicacion_breve": "Superávit calórico óptimo basado en 40 kcal/kg, con 2.1g/kg de proteína para maximizar la síntesis muscular."
    }
    
    print("\n--- ¡ÉXITO! RESPUESTA DEL BACKEND ---")
    print(json.dumps(respuesta_mock, indent=2, ensure_ascii=False))

else:
    # Tu código real listo para cuando la cuota de Google despierte
    from google import genai
    try:
        client = genai.Client(api_key="CLAVE_ELIMINADA")
        resultado = client.models.generate_content(
            model='gemini-2.0-flash',
            contents=prompt
        )
        print("\n--- ¡ÉXITO! RESPUESTA DEL BACKEND REAL ---")
        print(resultado.text)
    except Exception as e:
        print(f"\n Ocurrió un error en la comunicación real: {e}")

def resolver_duda_atleta(client, mensaje_usuario, categoria="general"):
    """
    Módulo del backend de SilverBack para resolver dudas de sustitución
    de alimentos o variantes de ejercicios usando Inteligencia Artificial.
    """
    
    # Le damos un rol experto y reglas estrictas a la IA para que no invente cosas
    instruccion_sistema = """
    Eres el Asistente Experto en Nutrición y Entrenamiento de la plataforma SilverBack. 
    Tu trabajo es responder dudas de atletas de forma directa, breve (máximo 3-4 líneas) y motivadora.
    
    Reglas de negocio:
    1. Si piden sustituir un alimento: Sugiere equivalencias viables en macros (ej. pollo por atún, claras de huevo, lomo de cerdo) indicando cantidades aproximadas si es posible.
    2. Si piden sustituir un ejercicio: Sugiere variantes biomecanicamente equivalentes (ej. sentadilla libre por sentadilla prensa o goblet; dominadas por remo).
    3. Habla siempre en español y mantén un tono profesional pero cercano, enfocado al fitness.
    """
    
    # --- FLUJO REAL (Descomentar cuando la cuota de Google esté libre) ---
    # try:
    #     response = client.models.generate_content(
    #         model='gemini-2.0-flash',
    #         contents=f"Categoría: {categoria}\nPregunta del usuario: {mensaje_usuario}",
    #         config={"system_instruction": instruccion_sistema}
    #     )
    #     return response.text
    # except Exception as e:
    #     return f"Error al conectar con el asistente de SilverBack: {e}"

    # --- SIMULADOR LOCAL PARA CONTINUAR DESARROLLANDO HOY ---
    mensaje_min = mensaje_usuario.lower()
    if "alimento" in mensaje_min or "comer" in mensaje_min or "pollo" in mensaje_min or "huevo" in mensaje_min:
        return (
            "💪 En SilverBack cuidamos tus macros: Si no tienes pechuga de pollo a la mano, "
            "puedes sustituir 100g de pollo por 100g de lomo de cerdo limpio, o 1 lata de atún en agua. "
            "Cualquiera de estas opciones te aportará los ~30g de proteína que necesitas para tu comida."
        )
    else:
        return (
            "🔥 Ajuste de entrenamiento SilverBack: Si no tienes polea para hacer Tríceps, "
            "puedes sustituirlo perfectamente por Fondos en banca (utilizando tu peso corporal) o "
            "Extensión de tríceps tras nuca con mancuerna. ¡Mantén la intensidad!"
        )

# --- EJEMPLO DE CÓMO LO LLAMARÍAS DESDE TU ROUTER O CONTROLADOR ---
print("\n--- CONSULTA RECIBIDA DESDE LA APP ---")
pregunta_cliente = "No alcancé a preparar el pollo de mi dieta, ¿con qué lo puedo sustituir rápido?"
respuesta_backend = resolver_duda_atleta(client=None, mensaje_usuario=pregunta_cliente, categoria="nutricion")

print(f"Usuario: {pregunta_cliente}")
print(f"SilverBack Backend: {respuesta_backend}")