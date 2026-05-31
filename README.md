# 🧠 NeuroChat — Plateforme Multimodale IA

> Assistant conversationnel intelligent combinant **Texte**, **Image** et **Voix** dans une interface web moderne et hautement sécurisée.

---

## 📌 Description

**NeuroChat** est une application web multimodale avancée développée pour le traitement de données multimodales (IA Générative). Elle intègre plusieurs capacités cognitives au sein d'une interface utilisateur unique, fluide et responsive :

- 💬 **Chat textuel** avec de grands modèles de langage (LLM) via l'API **Groq** (réponses en streaming temps réel).
- 🖼️ **Génération d'images** via un serveur **Stable Diffusion** hébergé sur Google Colab (FastAPI + localtunnel).
- 🔊 **Synthèse vocale (TTS)** multilingue prenant en charge trois moteurs différents : Speech API du navigateur, Google TTS (cloud) ou pyttsx3 (hors-ligne).
- 🎙️ **Reconnaissance vocale (STT)** intégrée pour dicter ses messages directement au microphone.
- 🔐 **Sécurité renforcée** : isolation complète du code frontend et backend avec configuration des variables sensibles (clés d'accès, URL réseau) via un fichier local `.env` pour éviter toute fuite sur les dépôts de code publics.

---

## 🗂️ Structure professionnelle du projet

Le projet est structuré de manière modulaire, séparant clairement les responsabilités (modèle client-serveur) :

```
neurochat/
├── .env                  # Secrets locaux et configuration (ignoré par Git)
├── .env.example          # Gabarit des configurations d'environnement
├── .gitignore            # Fichiers et dossiers à exclure du versionnement
├── requirements.txt      # Dépendances Python (dont python-dotenv)
├── run.py                # Script de lancement principal à la racine
├── README.md             # Documentation générale du projet
│
├── backend/              # Module Serveur Python
│   ├── __init__.py
│   ├── server.py         # Serveur HTTP multi-thread & APIs de routage
│   └── tts.py            # Logique isolée de synthèse vocale (TTS)
│
├── frontend/             # Ressources et interface client (Statiques)
│   ├── index.html        # Structure sémantique HTML5 de l'interface
│   ├── style.css         # Système de design, variables et animations
│   └── app.js            # Logique frontend, streaming LLM et reconnaissance
│
└── notebooks/            # Notebooks de calcul cloud
    └── stable_diffusion_backend.ipynb # Notebook Colab sécurisé pour GPU
```

---

## 🚀 Installation et démarrage rapide

### Prérequis

- **Python 3.10+** installé localement
- Un navigateur moderne (Google Chrome ou MS Edge recommandés pour la dictée vocale)
- Une clé API **Groq** (gratuite sur [console.groq.com](https://console.groq.com))

### Étape 1 — Cloner le projet

```bash
git clone https://github.com/votre-username/neurochat.git
cd neurochat
```

### Étape 2 — Configurer l'environnement virtuel Python

```bash
# Sous Windows
python -m venv venv
venv\Scripts\activate

# Sous Linux ou macOS
python3 -m venv venv
source venv/bin/activate
```

### Étape 3 — Installer les dépendances

```bash
pip install -r requirements.txt
```

### Étape 4 — Sécuriser la configuration (`.env`)

1. Copiez le fichier `.env.example` et renommez-le en `.env` :
   ```bash
   cp .env.example .env
   ```
2. Ouvrez le fichier `.env` nouvellement créé et saisissez-y votre clé API Groq ainsi que les autres paramètres si disponibles :
   ```env
   PORT=8000
   GROQ_API_KEY=gsk_votreCleGroqIci...
   COLAB_TUNNEL_URL=https://votre-tunnel.loca.lt
   ```

### Étape 5 — Lancer NeuroChat

```bash
python run.py
```
Le serveur local démarre et l'application s'ouvre automatiquement dans votre navigateur par défaut à l'adresse **[http://localhost:8000](http://localhost:8000)**.

---

## 🛡️ Fonctionnalités & Sécurité

### Point d'accès de configuration sécurisé (`/api/config`)
La clé API Groq et l'URL du serveur Colab ne sont jamais exposées en clair dans le code frontend ou sauvegardées uniquement dans le navigateur. Au chargement, `app.js` interroge de manière transparente l'endpoint local `/api/config` du backend Python pour s'auto-configurer à partir des variables définies dans le fichier sécurisé `.env`.

### Modèles LLM disponibles
Vous pouvez basculer dynamiquement d'un modèle à un autre directement depuis le nouveau menu de sélection de la barre latérale :
- `llama-3.3-70b-versatile` (Recommandé, polyvalent et rapide)
- `llama-3.1-8b-instant` (Ultra-rapide)
- `mixtral-8x7b-32768` (Grand contexte)
- `gemma2-9b-it` (Google Gemma 2)

---

## 🖼️ Génération d'images (Google Colab & Stable Diffusion)

Le backend de génération d'images repose sur le notebook disponible dans [notebooks/stable_diffusion_backend.ipynb](file:///c:/Users/Fares/Desktop/projet_multimodal/notebooks/stable_diffusion_backend.ipynb).

### Démarrage du serveur de calcul
1. Importez le fichier `.ipynb` dans votre espace **Google Colab**.
2. Créez un secret nommé `HF_TOKEN` dans Google Colab (icône de clé 🔑 à gauche) et placez-y votre jeton d'accès Hugging Face pour permettre le téléchargement sécurisé du modèle Stable Diffusion v1.5.
3. Lancez les cellules du notebook.
4. Récupérez l'URL publique générée par Localtunnel (ex: `https://heavy-vans-hammer.loca.lt`).
5. Indiquez cette URL dans votre fichier `.env` ou collez-la directement dans le champ de la barre latérale pour la tester.

### Utilisation dans l'interface
Pour générer une image :
- Cliquez sur le bouton ✨ (icône baguette magique) à gauche de la barre de saisie pour ouvrir l'outil de génération.
- Ou tapez directement `/image [votre description en anglais]` dans le chat (ex: `/image a futuristic brain, neon lighting, digital art`).

---

## 🔊 Synthèse vocale (TTS) & Reconnaissance (STT)

### Écoute des réponses (TTS)
Trois moteurs de voix configurables en barre latérale :
- **Navigateur** : Utilise la synthèse native du système (gratuite et instantanée).
- **gTTS** : Voix Google haute fidélité (génère un flux MP3).
- **PyTTSx3** : Synthèse hors-ligne (génère un fichier audio WAV local).

### Dictée vocale (STT)
En cliquant sur le micro 🎙️, dictez votre message en français. Le navigateur convertit votre voix en texte et l'injecte dans le champ d'écriture principal.

---

## 📄 Licence

Projet académique — tous droits réservés.
<votre-nom@ecole.fr>
