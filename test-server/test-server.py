import sys
import logging
import urllib.request
import json
import os
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import HttpUrl
from openai import OpenAI

logging.basicConfig(
    stream=sys.stdout,
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

app = FastAPI()

client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY", ""))

DISCORD_RELAY_URL = "http://discord-relay:8080/"

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "OPTIONS"],
    allow_headers=["*"],
)


def recup_infos(lien):
    cible = lien
    if "youtube.com" in lien or "youtu.be" in lien:
        try:
            req = urllib.request.Request(lien, headers={'User-Agent': 'Mozilla/5.0'})
            page = urllib.request.urlopen(req)
            html = page.read().decode("utf-8")
            titre = html.split('<title>')[1].split(' - YouTube</title>')[0]
            try:
                desc = html.split('name="description" content="')[1].split('">')[0][:300]
            except Exception:
                desc = "Pas de description."
            cible = f"TITRE VIDEO: {titre} | DESCRIPTION: {desc}"
        except Exception:
            cible = f"LIEN INCONNU: {lien}"
    return cible


def juger(tache, cible):
    consigne = (
        f"Tu es un auditeur strict. L'utilisateur DOIT travailler sur : '{tache}'. "
        f"Il regarde actuellement ce contenu : '{cible}'. "
        "Est-ce que ce contenu aide DIRECTEMENT à accomplir la tâche ? "
        "Si c'est du divertissement, de l'humour, ou un sujet différent, c'est INUTILE. "
        "Réponds par une phrase de jugement courte, puis finis par le chiffre 1 si c'est utile, ou 0 si c'est inutile. "
        "Le chiffre doit être le TOUT DERNIER caractère."
    )
    envoi = client.chat.completions.create(
        model="gpt-3.5-turbo",
        messages=[
            {"role": "system", "content": "Tu es un juge binaire qui détecte la procrastination."},
            {"role": "user", "content": consigne}
        ]
    )
    return envoi.choices[0].message.content.strip()


def engueuler_freaky(tache, cible, nom):
    consigne = (
        f"EXECUTION : {nom} fait sa petite merde sur '{cible}' au lieu de taffer sur '{tache}'. "
        f"Détruis {nom} en UNE SEULE LIGNE COURTE ET VIOLENTE. "
        "Oublie le vocabulaire compliqué, utilise un langage de rue, vulgaire et ultra-agressif (insultes autorisées). "
        f"Fais un lien direct entre sa distraction '{cible}' et sa tâche '{tache}' pour l'afficher comme un gros débile. "
        f"Cite {nom} et humilie-le bien : il doit avoir honte d'être sur ce serveur."
    )
    envoi = client.chat.completions.create(
        model="gpt-3.5-turbo",
        messages=[
            {"role": "system", "content": "Tu es une entité démoniaque qui humilie les procrastinateurs en public."},
            {"role": "user", "content": consigne}
        ]
    )
    return envoi.choices[0].message.content


def envoyer_discord(message):
    payload = json.dumps({"content": message}).encode("utf-8")
    req = urllib.request.Request(
        DISCORD_RELAY_URL,
        data=payload,
        headers={"Content-Type": "application/json"}
    )
    urllib.request.urlopen(req)
    logger.info(f"Clash envoyé sur Discord : {message[:80]}...")


@app.get("/process")
async def handle_request(
    name: str = Query(..., description="Nom de l'utilisateur"),
    tâche: str = Query(..., description="Identifiant de la tâche au format string"),
    url: HttpUrl = Query(..., description="URL valide conforme à la syntaxe RFC 3986")
):
    url_str = str(url)
    logger.info(f"name={name} | tâche={tâche} | url={url_str}")

    # Cas spécial : accueil YouTube → distraction directe, pas besoin de scraper
    if url_str.rstrip("/") in ("https://www.youtube.com", "http://www.youtube.com"):
        logger.info("Accueil YouTube → distraction directe")
        clash = engueuler_freaky(tâche, "Page d'accueil YouTube", name)
        envoyer_discord(clash)
        return {"status": "distraction_detectee", "action": "discord_notified"}

    # Récupération des infos du site (titre/desc YouTube ou URL brute)
    info_site = recup_infos(url_str)
    logger.info(f"Infos site : {info_site}")

    # Jugement GPT
    verdict = juger(tâche, info_site)
    logger.info(f"Verdict : {verdict}")

    if verdict.endswith("1"):
        logger.info("Contenu utile — aucune action.")
        return {"status": "utile"}

    elif verdict.endswith("0"):
        logger.info("Distraction détectée — envoi clash Discord.")
        clash = engueuler_freaky(tâche, info_site, name)
        envoyer_discord(clash)
        return {"status": "distraction_detectee", "action": "discord_notified"}

    else:
        logger.warning("Verdict IA non reconnu.")
        return {"status": "verdict_inconnu"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
