# -*- coding: utf-8 -*-
"""
=============================================================================
  NeuroChat - Plateforme Multimodale IA
  Fichier  : backend/server.py
  Rôle     : Serveur HTTP local principal & gestion des endpoints API
=============================================================================
"""

import http.server
import socketserver
import webbrowser
import threading
import sys
import time
import json
import os
import subprocess

# ── Installation automatique de python-dotenv si nécessaire ───────────────
try:
    from dotenv import load_dotenv
except ImportError:
    print("[INFO] Le module 'python-dotenv' est absent. Installation en cours...")
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "python-dotenv"])
        from dotenv import load_dotenv
        print("[OK] 'python-dotenv' installe avec succes.")
    except Exception as e:
        print(f"[ERREUR] Impossible d'installer 'python-dotenv' : {e}")
        sys.exit(1)

# Import du module TTS interne
from backend.tts import generate_speech

# Chargement du fichier .env à la racine
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
dotenv_path = os.path.join(BASE_DIR, '.env')
load_dotenv(dotenv_path)

# Chargement des configurations globales
HOST = "localhost"
PORT = int(os.getenv('PORT', 8000))

# Définition du répertoire frontend contenant les fichiers statiques
FRONTEND_DIR = os.path.join(BASE_DIR, 'frontend')


# ===========================================================================
#  Classe : ThreadingHTTPServer
#  Rôle   : Serveur HTTP multi-thread pour éviter le blocage des requêtes
# ===========================================================================
class ThreadingHTTPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    allow_reuse_address = True


# ===========================================================================
#  Classe : CustomHTTPRequestHandler
#  Rôle   : Routeur principal (Sert le frontend et gère les APIs)
# ===========================================================================
class CustomHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):

    def __init__(self, *args, **kwargs):
        # Initialisation avec le répertoire frontend/ pour servir les fichiers statiques
        super().__init__(*args, directory=FRONTEND_DIR, **kwargs)

    # -----------------------------------------------------------------------
    #  Méthode : do_GET
    #  Rôle    : Intercepte l'endpoint /api/config ou sert les fichiers
    # -----------------------------------------------------------------------
    def do_GET(self):
        if self.path == '/api/config':
            # Renvoie de manière sécurisée les configurations locales du fichier .env
            # sans les exposer dans le code source
            config_data = {
                "success": True,
                "groqApiKey": os.getenv('GROQ_API_KEY', ''),
                "colabUrl": os.getenv('COLAB_TUNNEL_URL', '')
            }
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(config_data).encode('utf-8'))
        else:
            # Comportement par défaut : sert les fichiers du dossier frontend/
            super().do_GET()

    # -----------------------------------------------------------------------
    #  Méthode : do_POST
    #  Rôle    : Reçoit les requêtes de synthèse vocale sur /api/tts
    # -----------------------------------------------------------------------
    def do_POST(self):
        if self.path == '/api/tts':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)

            try:
                data = json.loads(post_data.decode('utf-8'))
                text        = data.get('text', '')
                engine_type = data.get('engine', 'gtts')
                lang        = data.get('lang', 'fr')

                if not text.strip():
                    self.send_error_response("Le texte fourni est vide.")
                    return

                # Dossier de sortie audio à l'intérieur du répertoire statique du frontend
                audio_dir = os.path.join(FRONTEND_DIR, 'static', 'audio')

                # Génération du fichier audio via le module tts
                filename = generate_speech(
                    text=text, 
                    engine_type=engine_type, 
                    lang=lang, 
                    output_dir=audio_dir
                )

                # Réponse de succès vers le client
                response_data = {
                    "success": True,
                    "audioUrl": f"/static/audio/{filename}"
                }

                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps(response_data).encode('utf-8'))

            except Exception as e:
                self.send_error_response(f"Erreur lors de la synthese vocale : {str(e)}")

        else:
            self.send_response(404)
            self.end_headers()

    # -----------------------------------------------------------------------
    #  Méthode : send_error_response
    # -----------------------------------------------------------------------
    def send_error_response(self, message):
        self.send_response(400)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps({"success": False, "error": message}).encode('utf-8'))

    # Désactive le log systématique des requêtes dans la console
    def log_message(self, format, *args):
        pass


# ===========================================================================
#  Fonction : start_server
#  Rôle     : Démarre le serveur local
# ===========================================================================
def start_server():
    # S'assurer que le dossier statique des fichiers audio existe
    audio_dir = os.path.join(FRONTEND_DIR, 'static', 'audio')
    if not os.path.exists(audio_dir):
        os.makedirs(audio_dir)

    def run_server(port):
        server_address = (HOST, port)
        try:
            with ThreadingHTTPServer(server_address, CustomHTTPRequestHandler) as httpd:
                print(f"\n{'='*55}")
                print(f"  Serveur NeuroChat demarre avec succes !")
                print(f"  Adresse : http://{HOST}:{port}")
                print(f"  Appuyez sur CTRL+C pour arreter le serveur.")
                print(f"{'='*55}\n")
                httpd.serve_forever()
        except OSError as e:
            if e.errno in (98, 10048):
                print(f"[INFO] Port {port} occupé, essai sur le port {port + 1}...")
                run_server(port + 1)
            else:
                print(f"[ERREUR] Impossible de démarrer le serveur : {e}")
                sys.exit(1)

    def open_browser(port):
        time.sleep(1.0)
        url = f"http://{HOST}:{port}"
        print(f"[INFO] Ouverture de {url} dans le navigateur...")
        webbrowser.open(url)

    # Thread pour lancer automatiquement le navigateur par défaut
    browser_thread = threading.Thread(target=open_browser, args=(PORT,))
    browser_thread.daemon = True
    browser_thread.start()

    try:
        run_server(PORT)
    except KeyboardInterrupt:
        print("\n[INFO] Serveur arrêté. À bientôt !")
        sys.exit(0)
