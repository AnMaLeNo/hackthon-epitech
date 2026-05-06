import sys
import logging
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import HttpUrl

logging.basicConfig(
    stream=sys.stdout,
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

app = FastAPI()

# Déclaration explicite de la liste des origines autorisées
# "*" autorise toutes les origines (mode développement)
ORIGINES_AUTORISEES = ["*"]

# Injection du middleware CORS dans la pile ASGI
app.add_middleware(
    CORSMiddleware,
    allow_origins=ORIGINES_AUTORISEES,
    allow_credentials=False,            # Ne pas combiner credentials=True avec origins="*"
    allow_methods=["GET", "OPTIONS"],   # Restreint les verbes HTTP autorisés
    allow_headers=["*"],                # Autorise tous les en-têtes dans la requête
)

@app.get("/process")
async def handle_request(
    name: str = Query(..., description="Nom de l'utilisateur"),
    tâche: str = Query(..., description="Identifiant de la tâche au format string"),
    url: HttpUrl = Query(..., description="URL valide conforme à la syntaxe RFC 3986")
):
    logger.info(f"Paramètre 'name' extrait : {name}")
    logger.info(f"Paramètre 'tâche' extrait : {tâche}")
    logger.info(f"Paramètre 'url' extrait : {str(url)}")

    return {"status": "transmission_terminal_effectuee"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)