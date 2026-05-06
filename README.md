# Focus Timebox

Une application de lutte contre la procrastination qui surveille la navigation web en mode focus et humilie publiquement les distractions sur Discord via GPT.

## Concept

Quand un utilisateur active le **Mode Focus** sur une tâche définie, chaque site visité est analysé par une IA. Si le contenu n'est pas en rapport avec la tâche, un message d'humiliation généré par GPT est posté automatiquement sur un serveur Discord.

## Architecture

```
Extension Chrome
      |
      | GET /process?name=...&tâche=...&url=...
      v
   nginx :8800
      |
      +---> /process  ---> test-server (FastAPI)
      |                         |
      |                    GPT-3.5 juge
      |                         |
      |                  distraction ?
      |                         |
      +---> POST /  <-----------+
      |
      v
discord-relay ---> Webhook Discord ---> Message sur le serveur
```

## Composants

### Extension Chrome (`extension/chrome/`)

Extension Manifest V3 avec deux comportements :

- **Mode Focus** : à chaque navigation, envoie le nom, la tâche active et l'URL au serveur backend
- **Blocklist** : si un site bloqué est visité pendant une tâche active, déclenche un webhook Discord directement

Les données utilisateur (nom, tâches, blocklist, état focus) sont stockées dans `chrome.storage.local`.

### Backend (`test-server/`)

Serveur **FastAPI** qui reçoit les navigations et orchestre l'analyse :

1. Ignore l'accueil YouTube (navigation neutre)
2. Extrait les infos utiles selon le type d'URL :
   - YouTube : titre + description de la vidéo
   - Google Search : terme recherché
   - Autres sites : titre de la page (`<title>`)
3. Soumet le contenu à GPT-3.5 pour verdict (utile `1` / distraction `0`)
4. Si distraction : génère un clash agressif via GPT et l'envoie au relay Discord

### Relay Discord (`bot/`)

Serveur HTTP simple qui reçoit un message texte en POST et le transfère vers un **Webhook Discord**.

### Reverse Proxy (`nginx/`)

nginx écoute sur le port `8800` et route :
- `GET /process` → test-server
- `POST /` → discord-relay

## Installation

### Prérequis

- Docker + Docker Compose
- Une clé API OpenAI
- Un Webhook Discord

### Configuration

1. Créer un fichier `.env` à la racine :

```env
OPENAI_API_KEY=sk-proj-...
```

2. Configurer le Webhook Discord dans `bot/discord_relay.py` :

```python
DISCORD_WEBHOOK_URL = os.environ.get("DISCORD_WEBHOOK_URL", "https://discord.com/api/webhooks/...")
```

Ou via variable d'environnement dans `docker-compose.yaml`.

### Lancer le backend

```bash
docker compose up --build -d
```

### Installer l'extension Chrome

1. Ouvrir `chrome://extensions/`
2. Activer le **mode développeur**
3. Cliquer **Charger l'extension non empaquetée**
4. Sélectionner le dossier `extension/chrome/`

## Utilisation

1. Ouvrir le popup de l'extension
2. Renseigner ton **nom**
3. Ajouter une **tâche** avec ses horaires de début et fin
4. Activer le **Mode Focus**
5. Naviguer — les distractions sont détectées et postées sur Discord

## Structure du projet

```
.
├── extension/
│   └── chrome/
│       ├── manifest.json
│       ├── background.js   # Logique de surveillance des navigations
│       ├── popup.html
│       ├── popup.js        # Interface utilisateur du popup
│       └── popup.css
├── test-server/
│   ├── test-server.py      # FastAPI + logique GPT
│   └── Dockerfile
├── bot/
│   ├── discord_relay.py    # Relay HTTP → Discord Webhook
│   └── Dockerfile
├── nginx/
│   └── nginx.conf
├── code.py                 # Prototype standalone de la logique GPT
└── docker-compose.yaml
```
