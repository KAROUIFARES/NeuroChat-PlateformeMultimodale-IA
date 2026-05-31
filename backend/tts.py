# -*- coding: utf-8 -*-
"""
=============================================================================
  NeuroChat - Plateforme Multimodale IA
  Fichier  : backend/tts.py
  Rôle     : Logique isolée de synthèse vocale (Text-To-Speech)
=============================================================================
"""

import os
import sys
import subprocess
from datetime import datetime

# ── Vérification et installation automatique de pyttsx3 ───────────────────
try:
    import pyttsx3
    pyttsx3_available = True
except ImportError:
    print("[INFO] Le module 'pyttsx3' est absent. Installation en cours...")
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "pyttsx3"])
        import pyttsx3
        pyttsx3_available = True
        print("[OK] 'pyttsx3' installe avec succes.")
    except Exception as e:
        pyttsx3_available = False
        print(f"[AVERTISSEMENT] Impossible d'installer 'pyttsx3' : {e}")

# ── Vérification et installation automatique de gTTS ──────────────────────
try:
    from gtts import gTTS
    gtts_available = True
except ImportError:
    print("[INFO] Le module 'gtts' est absent. Installation en cours...")
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "gtts"])
        from gtts import gTTS
        gtts_available = True
        print("[OK] 'gtts' installe avec succes.")
    except Exception as e:
        gtts_available = False
        print(f"[AVERTISSEMENT] Impossible d'installer 'gtts' : {e}")


def generate_speech(text, engine_type='gtts', lang='fr', output_dir=''):
    """
    Génère un fichier audio à partir d'un texte et d'un moteur de synthèse donnés.
    
    Paramètres :
        text (str)        : Le texte à synthétiser.
        engine_type (str) : Le moteur à utiliser ('gtts' ou 'pyttsx3').
        lang (str)        : Le code langue ('fr', 'en', 'ar').
        output_dir (str)  : Le répertoire d'enregistrement des fichiers audio.
        
    Retourne :
        str : Le nom du fichier audio généré (avec extension .mp3 ou .wav).
    """
    if not text.strip():
        raise ValueError("Le texte fourni est vide.")

    # Création du dossier de sortie si nécessaire
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    # Génération d'un nom de fichier unique basé sur le timestamp
    timestamp = datetime.now().strftime('%Y%m%d%H%M%S_%f')
    
    # ── Moteur hors-ligne : pyttsx3 (SAPI5 sur Windows) ─────────────────
    if engine_type == 'pyttsx3':
        if not pyttsx3_available:
            raise RuntimeError("Le moteur hors-ligne 'pyttsx3' n'est pas disponible sur ce serveur.")

        # Initialisation du contexte COM de Windows (requis en environnement multi-thread)
        try:
            import pythoncom
            pythoncom.CoInitialize()
        except ImportError:
            pass  # Si pythoncom est absent (non-Windows), on continue

        try:
            tts_engine = pyttsx3.init()
            
            # Sélection de la voix correspondant à la langue
            voices = tts_engine.getProperty('voices')
            for voice in voices:
                voice_name = voice.name.lower()
                voice_id = voice.id.lower()
                if lang == 'fr' and ('french' in voice_name or 'fr_' in voice_id):
                    tts_engine.setProperty('voice', voice.id)
                    break
                elif lang == 'ar' and ('arabic' in voice_name or 'ar_' in voice_id):
                    tts_engine.setProperty('voice', voice.id)
                    break
                elif lang == 'en' and ('english' in voice_name or 'en_' in voice_id):
                    tts_engine.setProperty('voice', voice.id)
                    break

            # Vitesse de parole (160 mots/min pour une diction naturelle)
            tts_engine.setProperty('rate', 160)

            # Sous Windows, pyttsx3 génère directement du WAV (pas de MP3 natively)
            filename = f"speech_{timestamp}.wav"
            filepath = os.path.join(output_dir, filename)
            
            tts_engine.save_to_file(text, filepath)
            tts_engine.runAndWait()
            
            return filename

        finally:
            # Libération du contexte COM Windows
            try:
                import pythoncom
                pythoncom.CoUninitialize()
            except ImportError:
                pass

    # ── Moteur cloud : gTTS (Google Text-to-Speech) ──────────
    else:
        if not gtts_available:
            raise RuntimeError("Le moteur cloud 'gTTS' n'est pas disponible sur ce serveur.")

        filename = f"speech_{timestamp}.mp3"
        filepath = os.path.join(output_dir, filename)

        # Appel à l'API Google TTS et sauvegarde directe en MP3
        tts = gTTS(text=text, lang=lang)
        tts.save(filepath)
        
        return filename
