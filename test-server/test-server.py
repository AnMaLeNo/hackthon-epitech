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
    # Cas Google Search : extraire le terme cherché depuis l'URL
    if "google.com/search" in lien:
        try:
            from urllib.parse import urlparse, parse_qs
            parsed = urlparse(lien)
            query = parse_qs(parsed.query).get("q", [""])[0]
            if query:
                return f"Recherche Google : \"{query}\""
        except Exception:
            pass

    try:
        req = urllib.request.Request(lien, headers={'User-Agent': 'Mozilla/5.0'})
        page = urllib.request.urlopen(req, timeout=5)
        html = page.read().decode("utf-8", errors="ignore")

        # Extraire le titre de la page
        titre = ""
        if "<title>" in html and "</title>" in html:
            titre = html.split("<title>")[1].split("</title>")[0].strip()

        # Cas YouTube : aussi extraire la description
        if "youtube.com" in lien or "youtu.be" in lien:
            titre = titre.replace(" - YouTube", "").strip()
            try:
                desc = html.split('name="description" content="')[1].split('">')[0][:300]
            except Exception:
                desc = ""
            return f"TITRE VIDEO: {titre}" + (f" | DESCRIPTION: {desc}" if desc else "")

        return f"TITRE DE LA PAGE: {titre}" if titre else lien

    except Exception:
        return lien


def juger(tache, cible):
    consigne = (
    f"Évalue la pertinence du contenu suivant : '{cible}' par rapport à l'objectif : '{tache}'. "
    "Sois flexible : si le contenu est une ressource d'apprentissage, un tutoriel, une documentation "
    "ou une source d'inspiration liée, considère que c'est utile. "
    "Ne rejette (0) que le divertissement pur, les réseaux sociaux sans rapport ou le hors-sujet total. "
    "Réponds avec une reponse binaire uniquement par 1 ou 0 comme tout dernier caractère (et rien d autre)."
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
