import json
import urllib.request
import os
from http.server import BaseHTTPRequestHandler, HTTPServer

# ==========================================
# CONFIGURATION
# ==========================================
# Remplacez par votre lien Webhook Discord ou utilisez la variable d'environnement
DISCORD_WEBHOOK_URL = os.environ.get("DISCORD_WEBHOOK_URL", "https://discord.com/api/webhooks/1501539188011696248/H87Os7buRNYVGA-Pdwvo8r0xQN11PPcVqTDutslLlDCF3IFs-CQFHirLbO9xkbJcCfXl")
PORT = 8080

class RelayHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        """
        Gère les requêtes HTTP POST entrantes.
        """
        # 1. Vérifier qu'il y a bien du contenu
        content_length_str = self.headers.get('Content-Length')
        if not content_length_str:
            self.send_response(400)
            self.end_headers()
            self.wfile.write(b"Erreur: Content-Length manquant.")
            return
            
        content_length = int(content_length_str)
        
        # 2. Lire le corps de la requête (payload)
        post_data = self.rfile.read(content_length)
        text_content = ""
        
        # 3. Extraire le texte de la requête
        try:
            content_type = self.headers.get('Content-Type', '')
            # Si le contenu est au format JSON
            if 'application/json' in content_type:
                data = json.loads(post_data)
                # On cherche la présence de clés classiques pour un message
                # Si non trouvé, on convertit tout le JSON en chaîne de caractères
                text_content = data.get('content', data.get('text', data.get('message', str(data))))
            else:
                # Sinon on lit directement en tant que texte
                text_content = post_data.decode('utf-8')
        except Exception as e:
            print(f"Erreur lors de l'analyse des données: {e}")
            text_content = post_data.decode('utf-8', errors='ignore')

        if not text_content:
            self.send_response(400)
            self.end_headers()
            self.wfile.write(b"Erreur: Aucun contenu texte trouve.")
            return

        if DISCORD_WEBHOOK_URL == "VOTRE_LIEN_WEBHOOK_ICI":
            print("Attention: Le Webhook Discord n'est pas configure.")
            self.send_response(500)
            self.end_headers()
            self.wfile.write(b"Erreur: Webhook non configure cote serveur.")
            return

        # 4. Transférer le texte sur Discord via le Webhook
        try:
            # Format requis par l'API Discord
            discord_payload = {"content": str(text_content)}
            
            # Création de la requête vers Discord
            req = urllib.request.Request(
                DISCORD_WEBHOOK_URL,
                data=json.dumps(discord_payload).encode('utf-8'),
                headers={
                    'Content-Type': 'application/json',
                    'User-Agent': 'RelayServer/1.0'
                }
            )
            
            # Envoi effectif de la requête
            urllib.request.urlopen(req)
            
            # Réponse confirmant le succès
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b"Succes: Message relaye sur Discord.")
            print(f"Relayé avec succès: {text_content[:50]}...")
            
        except urllib.error.HTTPError as e:
            print(f"Erreur HTTP venant de Discord: {e.code} - {e.read().decode()}")
            self.send_response(500)
            self.end_headers()
            self.wfile.write(b"Erreur lors de l'envoi a Discord.")
        except Exception as e:
            print(f"Erreur interne lors de l'envoi a Discord: {e}")
            self.send_response(500)
            self.end_headers()
            self.wfile.write(b"Erreur interne du serveur relais.")

if __name__ == "__main__":
    server_address = ('', PORT)
    httpd = HTTPServer(server_address, RelayHandler)
    print(f"--- Serveur Relais HTTP vers Discord ---")
    print(f"Demarrage sur le port {PORT}...")
    if DISCORD_WEBHOOK_URL == "VOTRE_LIEN_WEBHOOK_ICI":
        print("[!] N'oubliez pas de configurer la variable DISCORD_WEBHOOK_URL dans le code !")
    print("En attente de requetes HTTP POST. Appuyez sur Ctrl+C pour arreter.")
    
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nArret du serveur demande par l'utilisateur.")
    
    httpd.server_close()
    print("Serveur arrete.")
