FROM python:3.12-slim

# Définir le répertoire de travail
WORKDIR /app

# Copier le script serveur dans le conteneur
COPY discord_relay.py .

# Informer Docker que le conteneur écoute sur le port 8080
EXPOSE 8080

# Lancer le script. 
# Le flag "-u" (unbuffered) permet de voir les "print()" en temps réel dans les logs de Docker.
CMD ["python", "-u", "discord_relay.py"]
