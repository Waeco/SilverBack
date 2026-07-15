FROM python:3.11-slim

WORKDIR /app/backend

# Instalar dependencias primero para aprovechar la cache de Docker
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# El código real se monta como volumen en docker-compose.yml (modo desarrollo),
# pero lo copiamos también para que la imagen funcione sola si hiciera falta.
COPY . .

EXPOSE 8000 8001

CMD ["python", "servidor.py"]
