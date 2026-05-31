#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
=============================================================================
  NeuroChat - Plateforme Multimodale IA
  Fichier  : run.py
  Rôle     : Script de lancement rapide de l'application
  Description :
      Ce fichier sert de point d'entrée commode à la racine du projet.
      Il se contente d'appeler la fonction de démarrage du serveur
      définie de manière modulaire dans le package backend.
=============================================================================
"""

import sys

# Ajout du dossier courant au chemin de recherche des modules Python
# pour s'assurer que le package backend est correctement résolu
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    from backend.server import start_server
except ImportError as e:
    print(f"[ERREUR] Impossible de charger le module serveur : {e}")
    print("[ASTUCE] Assurez-vous d'avoir installé les dépendances via: pip install -r requirements.txt")
    sys.exit(1)

if __name__ == "__main__":
    # Démarrage de l'application NeuroChat
    start_server()
