/**
 * =============================================================================
 *  NeuroChat - Plateforme Multimodale IA
 *  Fichier  : frontend/app.js
 *  Rôle     : Logique applicative principale du frontend
 *  Description :
 *      Ce fichier orchestre toute l'interaction utilisateur côté client.
 *      Il gère l'historique des conversations, les appels à l'API Groq,
 *      la synthèse vocale (TTS), la reconnaissance vocale (STT),
 *      la génération d'images (via un serveur Colab/Localtunnel)
 *      ainsi que le rendu des messages en Markdown avec coloration syntaxique.
 * =============================================================================
 */

document.addEventListener('DOMContentLoaded', () => {

    // =========================================================================
    //  SECTION 1 : Récupération des éléments du DOM
    // =========================================================================

    // -- Barre latérale (Sidebar) --
    const sidebar         = document.getElementById('sidebar');
    const menuToggleBtn   = document.getElementById('menuToggleBtn');   // Bouton hamburger (mobile)
    const closeSidebarBtn = document.getElementById('closeSidebarBtn'); // Fermeture sidebar (mobile)
    const newChatBtn      = document.getElementById('newChatBtn');      // Nouvelle conversation
    const historyContainer = document.getElementById('historyContainer'); // Liste des conversations

    // -- Paramètres de configuration --
    const apiKeyInput      = document.getElementById('apiKeyInput');    // Clé API Groq
    const modelSelect      = document.getElementById('modelSelect');    // Sélecteur de modèle LLM
    const systemPromptInput = document.getElementById('systemPrompt'); // Personnalité de l'assistant

    // -- En-tête du chat --
    const chatTitle          = document.getElementById('chatTitle');         // Titre de la discussion
    const chatModelStatus    = document.getElementById('chatModelStatus');   // Modèle actif affiché
    const voiceToggleGlobalBtn = document.getElementById('voiceToggleGlobalBtn'); // Lecture auto (optionnel)
    const clearChatBtn       = document.getElementById('clearChatBtn');      // Vider la discussion
    const exportChatBtn      = document.getElementById('exportChatBtn');     // Exporter en Markdown

    // -- Zone de messages --
    const messagesContainer = document.getElementById('messagesContainer'); // Conteneur des bulles
    const welcomeScreen     = document.getElementById('welcomeScreen');     // Écran d'accueil initial
    const scrollBottomBtn   = document.getElementById('scrollBottomBtn');   // Bouton "↓ défiler"

    // -- Zone de saisie --
    const chatInput    = document.getElementById('chatInput');    // Zone de texte principale
    const voiceInputBtn = document.getElementById('voiceInputBtn'); // Microphone (STT)
    const imageGenBtn  = document.getElementById('imageGenBtn');  // Ouvre la modale image
    const sendBtn      = document.getElementById('sendBtn');      // Bouton d'envoi
    const charCounter  = document.getElementById('charCounter'); // Compteur de caractères

    // -- Génération d'images (module Colab) --
    const colabUrlInput    = document.getElementById('colabUrlInput');    // URL du serveur Colab
    const testConnectionBtn = document.getElementById('testConnectionBtn'); // Test de connexion
    const connectionStatus  = document.getElementById('connectionStatus');  // Résultat du test

    // -- Synthèse vocale (TTS) --
    const ttsEngineSelect = document.getElementById('ttsEngineSelect'); // Sélecteur de moteur TTS
    const ttsLangSelect   = document.getElementById('ttsLangSelect');   // Langue de synthèse
    const ttsLangGroup    = document.getElementById('ttsLangGroup');    // Groupe langue (affiché si moteur serveur)
    const autoSpeakCheckbox = document.getElementById('autoSpeakCheckbox'); // Lecture automatique des réponses


    // =========================================================================
    //  SECTION 2 : État global de l'application (State Management)
    // =========================================================================
    let state = {
        conversations:       [],       // Tableau de tous les objets conversation
        activeConversationId: null,    // ID de la conversation actuellement affichée
        autoSpeak:           false,    // Lecture automatique des réponses de l'IA
        isVoiceRecording:    false,    // Vrai si la dictée vocale est en cours
        colabUrl:            '',       // URL du serveur de génération d'images (Localtunnel)
        ttsEngine:           'browser', // Moteur TTS actif : 'browser', 'gtts', ou 'pyttsx3'
        ttsLang:             'fr'      // Code langue pour la synthèse : 'fr', 'en', 'ar'
    };

    // =========================================================================
    //  SECTION 3 : Variables de runtime (non persistantes)
    // =========================================================================
    let speechRecognition = null; // Instance Web Speech API (STT)
    let currentUtterance  = null; // Référence à l'utterance navigateur en cours de lecture
    let currentAudio      = null; // Référence à l'objet Audio (pour gTTS / pyttsx3)
    const synth = window.speechSynthesis; // Moteur de synthèse vocale natif du navigateur


    // =========================================================================
    //  SECTION 4 : Initialisation de l'application
    // =========================================================================
    initApp();

    /**
     * initApp — Point d'entrée principal (asynchrone).
     * Charge les données persistantes, configure les bibliothèques tierces,
     * charge les secrets depuis le .env du serveur, et initialise les écouteurs.
     */
    async function initApp() {
        loadStateFromStorage();   // Restauration de l'état depuis le localStorage
        await fetchServerConfig(); // Récupération de la configuration sécurisée du serveur (.env)

        // Configuration de la bibliothèque Marked.js (rendu Markdown)
        marked.setOptions({
            breaks: true,        // \n devient <br>
            gfm: true,           // Support de GitHub Flavored Markdown
            headerIds: false,    // Désactive les ancres automatiques sur les titres
            mangle: false        // Désactive l'encodage des caractères spéciaux
        });

        initSpeechRecognition(); // Initialisation de la reconnaissance vocale (STT)
        injectImageModal();      // Injection de la modale de génération d'images dans le DOM
        setupEventListeners();   // Attachement de tous les écouteurs d'événements

        renderHistory();         // Affichage de la liste des conversations dans la sidebar
        loadActiveConversation(); // Chargement et affichage de la conversation active
        updateVoiceGlobalUI();   // Synchronisation de l'interface du bouton de lecture auto
    }

    /**
     * fetchServerConfig — Interroge le serveur local sur /api/config pour récupérer
     * la clé API Groq et l'URL Colab stockées de façon sécurisée dans le fichier `.env`.
     */
    async function fetchServerConfig() {
        try {
            const res = await fetch('/api/config');
            if (res.ok) {
                const data = await res.json();
                if (data.success) {
                    // Si une clé API Groq est fournie par le .env, elle écrase la valeur locale
                    if (data.groqApiKey) {
                        apiKeyInput.value = data.groqApiKey;
                        localStorage.setItem('neurochat_api_key', data.groqApiKey);
                    }
                    // Si une URL Colab est fournie par le .env, elle écrase la valeur locale
                    if (data.colabUrl) {
                        colabUrlInput.value = data.colabUrl;
                        state.colabUrl = data.colabUrl;
                        saveStateToStorage();
                    }
                }
            }
        } catch (e) {
            console.warn("[INFO] Impossible de joindre l'API de configuration locale (mode standalone).");
        }
    }


    // =========================================================================
    //  SECTION 5 : Gestion de l'état et du stockage local
    // =========================================================================

    /**
     * loadStateFromStorage — Charge l'état sauvegardé depuis le localStorage.
     */
    function loadStateFromStorage() {
        const storedState = localStorage.getItem('neurochat_state');
        if (storedState) {
            try {
                state = JSON.parse(storedState);
                state.isVoiceRecording = false;
            } catch (e) {
                console.error("Erreur lors de la lecture de l'état sauvegardé :", e);
                createFirstConversation();
            }
        } else {
            createFirstConversation();
        }

        // Récupération de la clé API du cache local
        const savedApiKey = localStorage.getItem('neurochat_api_key');
        if (savedApiKey) {
            apiKeyInput.value = savedApiKey;
        }

        // Synchronisation de l'URL du serveur Colab
        if (state.colabUrl) {
            colabUrlInput.value = state.colabUrl;
        }

        // Synchronisation du moteur TTS sélectionné
        if (state.ttsEngine) {
            ttsEngineSelect.value = state.ttsEngine;
        } else {
            state.ttsEngine = 'browser';
        }

        // Synchronisation de la langue TTS
        if (state.ttsLang) {
            ttsLangSelect.value = state.ttsLang;
        } else {
            state.ttsLang = 'fr';
        }

        ttsLangGroup.style.display = (state.ttsEngine === 'browser') ? 'none' : 'block';
        autoSpeakCheckbox.checked = !!state.autoSpeak;
    }

    /**
     * saveStateToStorage — Sérialise et sauvegarde l'état global.
     */
    function saveStateToStorage() {
        localStorage.setItem('neurochat_state', JSON.stringify(state));
        localStorage.setItem('neurochat_api_key', apiKeyInput.value);
    }

    /**
     * createFirstConversation — Crée une première conversation vide par défaut.
     */
    function createFirstConversation() {
        const defaultConv = {
            id:           'conv_' + Date.now(),
            title:        'Nouvelle discussion',
            model:        modelSelect ? modelSelect.value : 'llama-3.3-70b-versatile',
            systemPrompt: systemPromptInput ? systemPromptInput.value : '',
            messages:     [],
            createdAt:    new Date().toISOString()
        };
        state.conversations = [defaultConv];
        state.activeConversationId = defaultConv.id;
        saveStateToStorage();
    }


    // =========================================================================
    //  SECTION 6 : Écouteurs d'événements (Event Listeners)
    // =========================================================================

    function setupEventListeners() {

        // ── Sidebar ───────────────────────────────────────────────────────
        menuToggleBtn.addEventListener('click', () => sidebar.classList.add('open'));
        closeSidebarBtn.addEventListener('click', () => sidebar.classList.remove('open'));

        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 900) {
                if (!sidebar.contains(e.target) && !menuToggleBtn.contains(e.target) && sidebar.classList.contains('open')) {
                    sidebar.classList.remove('open');
                }
            }
        });

        // ── Nouvelle conversation ─────────────────────────────────────────
        newChatBtn.addEventListener('click', () => {
            const newConv = {
                id:           'conv_' + Date.now(),
                title:        'Nouvelle discussion',
                model:        modelSelect ? modelSelect.value : 'llama-3.3-70b-versatile',
                systemPrompt: systemPromptInput ? systemPromptInput.value : '',
                messages:     [],
                createdAt:    new Date().toISOString()
            };
            state.conversations.unshift(newConv);
            state.activeConversationId = newConv.id;
            saveStateToStorage();
            renderHistory();
            loadActiveConversation();
            chatInput.focus();
            if (window.innerWidth <= 900) sidebar.classList.remove('open');
        });

        // ── Clé API ───────────────────────────────────────────────────────
        apiKeyInput.addEventListener('input', () => {
            localStorage.setItem('neurochat_api_key', apiKeyInput.value);
        });

        // ── Changement de modèle LLM ──────────────────────────────────────
        if (modelSelect) {
            modelSelect.addEventListener('change', () => {
                const activeConv = getActiveConversation();
                if (activeConv) {
                    activeConv.model = modelSelect.value;
                    chatModelStatus.textContent = modelSelect.value;
                    saveStateToStorage();
                }
            });
        }

        // ── Modification du prompt système ────────────────────────────────
        if (systemPromptInput) {
            systemPromptInput.addEventListener('input', () => {
                const activeConv = getActiveConversation();
                if (activeConv) {
                    activeConv.systemPrompt = systemPromptInput.value;
                    saveStateToStorage();
                }
            });
        }

        // ── Vider la conversation ─────────────────────────────────────────
        clearChatBtn.addEventListener('click', () => {
            const activeConv = getActiveConversation();
            if (activeConv && activeConv.messages.length > 0) {
                if (confirm('Voulez-vous vraiment vider tout l\'historique de cette discussion ?')) {
                    activeConv.messages = [];
                    activeConv.title = 'Nouvelle discussion';
                    saveStateToStorage();
                    renderHistory();
                    loadActiveConversation();
                }
            }
        });

        // ── Export ────────────────────────────────────────────────────────
        exportChatBtn.addEventListener('click', exportActiveConversation);

        // ── Lecture automatique global ────────────────────────────────────
        if (voiceToggleGlobalBtn) {
            voiceToggleGlobalBtn.addEventListener('click', () => {
                state.autoSpeak = !state.autoSpeak;
                saveStateToStorage();
                updateVoiceGlobalUI();
                if (!state.autoSpeak && synth.speaking) synth.cancel();
            });
        }

        // ── Zone de texte (Auto-grow) ─────────────────────────────────────
        chatInput.addEventListener('input', () => {
            adjustInputHeight();
            charCounter.textContent = `${chatInput.value.length} caractères`;
            sendBtn.disabled = chatInput.value.trim().length === 0;
        });

        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        sendBtn.addEventListener('click', sendMessage);

        // ── Bouton "Défiler vers le bas" ──────────────────────────────────
        messagesContainer.addEventListener('scroll', () => {
            const threshold = 150;
            const isScrolledUp = messagesContainer.scrollHeight - messagesContainer.clientHeight - messagesContainer.scrollTop > threshold;
            scrollBottomBtn.classList.toggle('visible', isScrolledUp);
        });
        scrollBottomBtn.addEventListener('click', () => scrollToBottom(true));

        window.addEventListener('resize', () => {
            if (window.innerWidth > 900) sidebar.classList.remove('open');
        });

        // ── URL Google Colab ──────────────────────────────────────────────
        colabUrlInput.addEventListener('input', () => {
            state.colabUrl = colabUrlInput.value.trim();
            saveStateToStorage();
            connectionStatus.innerHTML = '';
            testConnectionBtn.className = 'test-connection-btn';
            document.getElementById('testConnectionText').textContent = 'Tester la connexion';
        });
        testConnectionBtn.addEventListener('click', testColabConnection);

        // ── Bouton image dans la zone de saisie ───────────────────────────
        if (imageGenBtn) {
            imageGenBtn.addEventListener('click', () => openImageModal());
        }

        // ── Synthèse vocale ───────────────────────────────────────────────
        ttsEngineSelect.addEventListener('change', () => {
            state.ttsEngine = ttsEngineSelect.value;
            saveStateToStorage();
            ttsLangGroup.style.display = (state.ttsEngine === 'browser') ? 'none' : 'block';
        });

        ttsLangSelect.addEventListener('change', () => {
            state.ttsLang = ttsLangSelect.value;
            saveStateToStorage();
        });

        autoSpeakCheckbox.addEventListener('change', () => {
            state.autoSpeak = autoSpeakCheckbox.checked;
            saveStateToStorage();
            if (!state.autoSpeak && synth.speaking) synth.cancel();
        });
    }


    // =========================================================================
    //  SECTION 7 : Rendu de l'interface (UI Rendering)
    // =========================================================================

    function getActiveConversation() {
        return state.conversations.find(c => c.id === state.activeConversationId);
    }

    function renderHistory() {
        historyContainer.innerHTML = '';

        if (state.conversations.length === 0) {
            historyContainer.innerHTML = '<div style="color: var(--text-muted); font-size: 0.8rem; text-align: center; margin-top: 20px;">Aucun historique.</div>';
            return;
        }

        state.conversations.forEach(conv => {
            const chatItem = document.createElement('div');
            chatItem.className = `chat-item ${conv.id === state.activeConversationId ? 'active' : ''}`;
            chatItem.setAttribute('data-id', conv.id);

            const leftDiv = document.createElement('div');
            leftDiv.className = 'chat-item-left';
            const chatIcon = document.createElement('i');
            chatIcon.className = 'fa-regular fa-message';
            const titleSpan = document.createElement('span');
            titleSpan.className = 'chat-item-title';
            titleSpan.textContent = conv.title || 'Discussion vide';
            leftDiv.appendChild(chatIcon);
            leftDiv.appendChild(titleSpan);

            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'chat-item-actions';

            const editBtn = document.createElement('button');
            editBtn.className = 'chat-item-btn';
            editBtn.title = 'Renommer';
            editBtn.innerHTML = '<i class="fa-solid fa-pen"></i>';
            editBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const newTitle = prompt('Entrez le nouveau titre de cette discussion :', conv.title);
                if (newTitle && newTitle.trim()) {
                    conv.title = newTitle.trim();
                    saveStateToStorage();
                    renderHistory();
                    if (conv.id === state.activeConversationId) chatTitle.textContent = conv.title;
                }
            });

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'chat-item-btn delete-btn';
            deleteBtn.title = 'Supprimer';
            deleteBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm(`Supprimer définitivement la discussion "${conv.title}" ?`)) {
                    state.conversations = state.conversations.filter(c => c.id !== conv.id);
                    if (state.activeConversationId === conv.id) {
                        state.activeConversationId = state.conversations.length > 0 ? state.conversations[0].id : null;
                    }
                    if (state.conversations.length === 0) createFirstConversation();
                    saveStateToStorage();
                    renderHistory();
                    loadActiveConversation();
                }
            });

            actionsDiv.appendChild(editBtn);
            actionsDiv.appendChild(deleteBtn);
            chatItem.appendChild(leftDiv);
            chatItem.appendChild(actionsDiv);

            chatItem.addEventListener('click', () => {
                state.activeConversationId = conv.id;
                saveStateToStorage();
                document.querySelectorAll('.chat-item').forEach(item => item.classList.remove('active'));
                chatItem.classList.add('active');
                loadActiveConversation();
                if (window.innerWidth <= 900) sidebar.classList.remove('open');
            });

            historyContainer.appendChild(chatItem);
        });
    }

    function loadActiveConversation() {
        const conv = getActiveConversation();
        if (!conv) return;

        if (modelSelect) modelSelect.value = conv.model || 'llama-3.3-70b-versatile';
        if (systemPromptInput) systemPromptInput.value = conv.systemPrompt || '';

        chatTitle.textContent = conv.title || 'Discussion';
        chatModelStatus.textContent = conv.model || 'llama-3.3-70b-versatile';

        messagesContainer.querySelectorAll('.message-row').forEach(row => row.remove());

        const messages = conv.messages || [];
        if (messages.length === 0) {
            welcomeScreen.style.display = 'flex';
        } else {
            welcomeScreen.style.display = 'none';
            messages.forEach(msg => {
                if (msg.role === 'image') {
                    appendImageMessageToUI(msg.prompt, msg.content);
                } else {
                    appendMessageToUI(msg.role, msg.content, false);
                }
            });
        }

        chatInput.value = '';
        adjustInputHeight();
        charCounter.textContent = '0 caractères';
        sendBtn.disabled = true;

        scrollToBottom(false);
    }

    function appendMessageToUI(role, content, animate = true) {
        welcomeScreen.style.display = 'none';

        const row = document.createElement('div');
        row.className = `message-row ${role}`;
        if (!animate) row.style.animation = 'none';

        const avatar = document.createElement('div');
        avatar.className = 'avatar';
        avatar.innerHTML = role === 'user'
            ? '<i class="fa-solid fa-user"></i>'
            : '<i class="fa-solid fa-robot"></i>';

        const bubble = document.createElement('div');
        bubble.className = 'message-bubble';

        if (content) {
            bubble.innerHTML = parseMarkdown(content);
        } else {
            const loader = document.createElement('div');
            loader.className = 'typing-indicator';
            loader.innerHTML = `
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            `;
            bubble.appendChild(loader);
        }

        if (content) {
            const tools = createMessageTools(role, content, bubble);
            bubble.appendChild(tools);
        }

        row.appendChild(avatar);
        row.appendChild(bubble);
        messagesContainer.appendChild(row);

        highlightCodeBlocks(bubble);
        return row;
    }

    function createMessageTools(role, content, bubbleElement) {
        const toolsDiv = document.createElement('div');
        toolsDiv.className = 'message-tools';

        const speakBtn = document.createElement('button');
        speakBtn.className = 'tool-link';
        speakBtn.innerHTML = '<i class="fa-solid fa-volume-high"></i> Lire';
        speakBtn.addEventListener('click', () => speakText(content, speakBtn));

        const copyBtn = document.createElement('button');
        copyBtn.className = 'tool-link';
        copyBtn.innerHTML = '<i class="fa-solid fa-copy"></i> Copier';
        copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(content).then(() => {
                copyBtn.innerHTML = '<i class="fa-solid fa-check" style="color: #00e676"></i> Copié !';
                setTimeout(() => {
                    copyBtn.innerHTML = '<i class="fa-solid fa-copy"></i> Copier';
                }, 2000);
            });
        });

        toolsDiv.appendChild(speakBtn);
        toolsDiv.appendChild(copyBtn);
        return toolsDiv;
    }

    function parseMarkdown(text) {
        return marked.parse(text);
    }

    function highlightCodeBlocks(container) {
        container.querySelectorAll('pre code').forEach((block) => {
            hljs.highlightElement(block);

            const preElement = block.parentElement;
            if (preElement.parentElement.classList.contains('code-block-wrapper')) return;

            const wrapper = document.createElement('div');
            wrapper.className = 'code-block-wrapper';
            const header = document.createElement('div');
            header.className = 'code-header';

            let lang = 'code';
            block.classList.forEach(cls => {
                if (cls.startsWith('language-')) lang = cls.replace('language-', '');
            });

            header.innerHTML = `
                <span><i class="fa-solid fa-code"></i> ${lang.toUpperCase()}</span>
                <button class="copy-code-btn"><i class="fa-regular fa-copy"></i> Copier le code</button>
            `;

            const copyBtn = header.querySelector('.copy-code-btn');
            copyBtn.addEventListener('click', () => {
                navigator.clipboard.writeText(block.textContent).then(() => {
                    copyBtn.innerHTML = '<i class="fa-solid fa-check" style="color: #00e676"></i> Copié !';
                    setTimeout(() => {
                        copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i> Copier le code';
                    }, 2000);
                });
            });

            preElement.parentNode.insertBefore(wrapper, preElement);
            wrapper.appendChild(header);
            wrapper.appendChild(preElement);
        });
    }

    function adjustInputHeight() {
        chatInput.style.height = 'auto';
        chatInput.style.height = chatInput.scrollHeight + 'px';
    }

    function scrollToBottom(smooth = true) {
        messagesContainer.scrollTo({
            top: messagesContainer.scrollHeight,
            behavior: smooth ? 'smooth' : 'auto'
        });
    }

    function updateVoiceGlobalUI() {
        if (!voiceToggleGlobalBtn) return;
        if (state.autoSpeak) {
            voiceToggleGlobalBtn.classList.add('active');
            voiceToggleGlobalBtn.style.color = 'var(--accent-blue)';
            voiceToggleGlobalBtn.style.borderColor = 'var(--accent-blue-glow)';
            voiceToggleGlobalBtn.title = 'Désactiver la lecture automatique';
        } else {
            voiceToggleGlobalBtn.classList.remove('active');
            voiceToggleGlobalBtn.style.color = '';
            voiceToggleGlobalBtn.style.borderColor = '';
            voiceToggleGlobalBtn.title = 'Activer la lecture automatique';
        }
    }


    // =========================================================================
    //  SECTION 8 : Reconnaissance vocale (Speech-to-Text)
    // =========================================================================

    function initSpeechRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            voiceInputBtn.style.display = 'none';
            console.log("Reconnaissance vocale non supportée.");
            return;
        }

        speechRecognition = new SpeechRecognition();
        speechRecognition.continuous     = false;
        speechRecognition.interimResults  = false;
        speechRecognition.lang            = 'fr-FR';

        speechRecognition.onstart = () => {
            state.isVoiceRecording = true;
            voiceInputBtn.classList.add('voice-active');
            voiceInputBtn.innerHTML = '<i class="fa-solid fa-microphone-slash"></i>';
            chatInput.placeholder = "Écoute en cours...";
        };

        speechRecognition.onerror = (e) => {
            console.error("Erreur STT :", e);
            stopVoiceRecording();
        };

        speechRecognition.onend = () => stopVoiceRecording();

        speechRecognition.onresult = (e) => {
            const transcript = e.results[0][0].transcript;
            if (transcript) {
                const startPos = chatInput.selectionStart;
                const endPos   = chatInput.selectionEnd;
                chatInput.value = chatInput.value.substring(0, startPos) + transcript + chatInput.value.substring(endPos);
                adjustInputHeight();
                charCounter.textContent = `${chatInput.value.length} caractères`;
                sendBtn.disabled = chatInput.value.trim().length === 0;
            }
        };

        voiceInputBtn.addEventListener('click', () => {
            if (state.isVoiceRecording) {
                speechRecognition.stop();
            } else {
                if (synth.speaking) synth.cancel();
                if (currentAudio) { currentAudio.pause(); currentAudio = null; }
                speechRecognition.start();
            }
        });
    }

    function stopVoiceRecording() {
        state.isVoiceRecording = false;
        voiceInputBtn.classList.remove('voice-active');
        voiceInputBtn.innerHTML = '<i class="fa-solid fa-microphone"></i>';
        chatInput.placeholder = "Envoyer un message à l'assistant...";
    }


    // =========================================================================
    //  SECTION 9 : Synthèse vocale (Text-to-Speech)
    // =========================================================================

    function speakText(text, buttonElement) {
        if (synth.speaking) {
            synth.cancel();
            if (currentUtterance && currentUtterance.btn === buttonElement) {
                resetSpeakButton(buttonElement);
                currentUtterance = null;
                return;
            }
        }

        if (currentAudio) {
            currentAudio.pause();
            currentAudio = null;
            if (buttonElement && buttonElement.getAttribute('data-playing') === 'true') {
                buttonElement.removeAttribute('data-playing');
                resetSpeakButton(buttonElement);
                return;
            }
        }

        let cleanText = text
            .replace(/```[\s\S]*?```/g, '[bloc de code]')
            .replace(/`([^`]+)`/g, '$1')
            .replace(/[*#_\-\[\]\(\)]/g, '')
            .replace(/(https?:\/\/[^\s]+)/g, 'lien internet');

        if (state.ttsEngine === 'browser') {
            const utterance = new SpeechSynthesisUtterance(cleanText);
            utterance.btn = buttonElement;

            const voices = synth.getVoices();
            const frenchVoice = voices.find(v => v.lang.startsWith('fr-'));
            if (frenchVoice) utterance.voice = frenchVoice;

            utterance.rate  = 1.05;
            utterance.pitch = 1.0;

            utterance.onstart = () => {
                if (buttonElement) buttonElement.innerHTML = '<i class="fa-solid fa-stop-circle" style="color: #ff4d4d"></i> Arrêter';
                currentUtterance = utterance;
            };
            utterance.onend = () => {
                if (buttonElement) resetSpeakButton(buttonElement);
                if (currentUtterance === utterance) currentUtterance = null;
            };
            utterance.onerror = (e) => {
                console.error("Erreur TTS navigateur :", e);
                if (buttonElement) resetSpeakButton(buttonElement);
                currentUtterance = null;
            };

            synth.speak(utterance);

        } else {
            if (buttonElement) {
                buttonElement.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Génération...';
                buttonElement.setAttribute('data-playing', 'true');
            }

            fetch('/api/tts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text:   cleanText,
                    engine: state.ttsEngine,
                    lang:   state.ttsLang
                })
            })
            .then(res => {
                if (!res.ok) throw new Error("Erreur de l'API TTS");
                return res.json();
            })
            .then(data => {
                if (!data.success) throw new Error(data.error || "Erreur serveur");

                currentAudio = new Audio(data.audioUrl);
                currentAudio.onplay  = () => {
                    if (buttonElement) buttonElement.innerHTML = '<i class="fa-solid fa-stop-circle" style="color: #ff4d4d"></i> Arrêter';
                };
                currentAudio.onended = () => {
                    if (buttonElement) { buttonElement.removeAttribute('data-playing'); resetSpeakButton(buttonElement); }
                    currentAudio = null;
                };
                currentAudio.onerror = (err) => {
                    console.error("Erreur de lecture audio :", err);
                    if (buttonElement) { buttonElement.removeAttribute('data-playing'); resetSpeakButton(buttonElement); }
                    currentAudio = null;
                };
                currentAudio.play();
            })
            .catch(err => {
                console.error("Erreur TTS :", err);
                if (buttonElement) { buttonElement.removeAttribute('data-playing'); resetSpeakButton(buttonElement); }
                alert("Impossible de lire l'audio : " + err.message);
            });
        }
    }

    function resetSpeakButton(btn) {
        btn.innerHTML = '<i class="fa-solid fa-volume-high"></i> Lire';
    }


    // =========================================================================
    //  SECTION 10 : Export de conversation
    // =========================================================================

    function exportActiveConversation() {
        const conv = getActiveConversation();
        if (!conv || conv.messages.length === 0) {
            alert('Aucun message à exporter.');
            return;
        }

        let mdContent = `# Discussion : ${conv.title}\n`;
        mdContent += `*Date : ${new Date(conv.createdAt).toLocaleDateString('fr-FR')}*\n`;
        mdContent += `*Modèle : ${conv.model}*\n\n---\n\n`;

        conv.messages.forEach(msg => {
            const roleLabel = msg.role === 'user' ? '👤 **Utilisateur**' : '🤖 **Assistant IA**';
            mdContent += `### ${roleLabel}\n\n${msg.content}\n\n---\n\n`;
        });

        const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8;' });
        const url  = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const cleanTitle = conv.title.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 30);
        link.setAttribute('download', `conversation_${cleanTitle}.md`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }


    // =========================================================================
    //  SECTION 11 : Communication avec l'API Groq (LLM)
    // =========================================================================

    async function sendMessage() {
        const text = chatInput.value.trim();
        if (!text) return;

        // Commande /image
        if (text.toLowerCase().startsWith('/image ')) {
            const imagePrompt = text.substring(7).trim();
            if (!imagePrompt) {
                alert('Veuillez fournir une description.');
                return;
            }
            chatInput.value = '';
            adjustInputHeight();
            charCounter.textContent = '0 caractères';
            sendBtn.disabled = true;
            await generateImage(imagePrompt);
            return;
        }

        const apiKey = apiKeyInput.value.trim();
        if (!apiKey) {
            alert("Veuillez saisir votre clé d'accès API Groq dans la barre latérale.");
            sidebar.classList.add('open');
            return;
        }

        const activeConv = getActiveConversation();
        if (!activeConv) return;

        const userMsg = { role: 'user', content: text, timestamp: new Date().toISOString() };
        activeConv.messages.push(userMsg);

        if (activeConv.title === 'Nouvelle discussion') {
            activeConv.title = text.length > 25 ? text.substring(0, 25) + '...' : text;
        }

        saveStateToStorage();
        renderHistory();

        appendMessageToUI('user', text);
        chatInput.value = '';
        adjustInputHeight();
        charCounter.textContent = '0 caractères';
        sendBtn.disabled = true;
        scrollToBottom(true);

        if (synth.speaking) synth.cancel();
        if (currentAudio) { currentAudio.pause(); currentAudio = null; }

        const aiRow   = appendMessageToUI('assistant', '');
        const aiBubble = aiRow.querySelector('.message-bubble');
        const typingIndicator = aiBubble.querySelector('.typing-indicator');

        const apiMessages = [];
        if (activeConv.systemPrompt) {
            apiMessages.push({ role: 'system', content: activeConv.systemPrompt });
        }

        activeConv.messages.forEach(msg => {
            if (msg.role === 'image') return;
            if (msg.role === 'user' && msg.content.startsWith('/image ')) return;
            apiMessages.push({ role: msg.role, content: msg.content });
        });

        try {
            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model:    activeConv.model || 'llama-3.3-70b-versatile',
                    messages: apiMessages,
                    stream:   true
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error?.message || `Erreur API (${response.status})`);
            }

            if (typingIndicator) typingIndicator.remove();

            const reader  = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let aiResponseBuffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                    const cleanLine = line.trim();
                    if (!cleanLine || cleanLine === 'data: [DONE]') continue;

                    if (cleanLine.startsWith('data: ')) {
                        try {
                            const parsedData = JSON.parse(cleanLine.substring(6));
                            const delta = parsedData.choices[0]?.delta?.content || '';
                            aiResponseBuffer += delta;

                            aiBubble.innerHTML = parseMarkdown(aiResponseBuffer);
                            highlightCodeBlocks(aiBubble);
                            scrollToBottom(true);
                        } catch (parseError) {}
                    }
                }
            }

            activeConv.messages.push({
                role:      'assistant',
                content:   aiResponseBuffer,
                timestamp: new Date().toISOString()
            });
            saveStateToStorage();

            const tools = createMessageTools('assistant', aiResponseBuffer, aiBubble);
            aiBubble.appendChild(tools);

            if (state.autoSpeak) {
                const speakBtn = tools.querySelector('.tool-link');
                speakText(aiResponseBuffer, speakBtn);
            }

        } catch (error) {
            console.error("Erreur API :", error);
            if (typingIndicator) typingIndicator.remove();

            const errorElement = document.createElement('div');
            errorElement.style.cssText = 'color:#ff4d4d;font-weight:500;padding:8px 0;';
            errorElement.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> Une erreur est survenue :<br><small style="opacity:0.85">${error.message}</small>`;
            aiBubble.appendChild(errorElement);
            scrollToBottom(true);
        }
    }


    // =========================================================================
    //  SECTION 12 : Génération d'images (Google Colab / Stable Diffusion)
    // =========================================================================

    function injectImageModal() {
        const modalHTML = `
        <div class="image-modal-overlay" id="imageModalOverlay">
            <div class="image-modal">
                <div class="image-modal-header">
                    <div class="image-modal-title">
                        <i class="fa-solid fa-wand-magic-sparkles"></i>
                        Générer une Image
                    </div>
                    <button class="image-modal-close" id="imageModalClose">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
                <textarea class="image-modal-input" id="imageModalInput"
                    placeholder="Décrivez l'image à générer... ex: a futuristic city at night, neon lights, cinematic"></textarea>
                <button class="image-modal-generate-btn" id="imageModalGenerateBtn">
                    <i class="fa-solid fa-image"></i> Générer l'image
                </button>
                <p class="image-modal-hint">
                    <i class="fa-solid fa-circle-info"></i>
                    Vous pouvez aussi taper <code style="background:rgba(138,43,226,0.15);color:#00bfff;padding:1px 5px;border-radius:4px;font-family:monospace">/image description</code> directement dans le chat.
                </p>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        document.getElementById('imageModalClose').addEventListener('click', closeImageModal);
        document.getElementById('imageModalOverlay').addEventListener('click', (e) => {
            if (e.target === document.getElementById('imageModalOverlay')) closeImageModal();
        });

        const generateFromModal = async () => {
            const prompt = document.getElementById('imageModalInput').value.trim();
            if (!prompt) return;
            closeImageModal();
            await generateImage(prompt);
        };

        document.getElementById('imageModalGenerateBtn').addEventListener('click', generateFromModal);
        document.getElementById('imageModalInput').addEventListener('keydown', async (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                await generateFromModal();
            }
        });
    }

    function openImageModal() {
        document.getElementById('imageModalOverlay').classList.add('open');
        setTimeout(() => document.getElementById('imageModalInput').focus(), 100);
    }

    function closeImageModal() {
        document.getElementById('imageModalOverlay').classList.remove('open');
    }

    async function testColabConnection() {
        const url = colabUrlInput.value.trim();
        if (!url) {
            connectionStatus.innerHTML = '<i class="fa-solid fa-triangle-exclamation" style="color:#ff4d4d"></i> Veuillez entrer une URL.';
            return;
        }

        testConnectionBtn.className = 'test-connection-btn';
        document.getElementById('testConnectionText').textContent = 'Test en cours...';
        testConnectionBtn.disabled = true;
        connectionStatus.innerHTML = '';

        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 8000);
            await fetch(url, { method: 'GET', signal: controller.signal, mode: 'no-cors' });
            clearTimeout(timeout);

            testConnectionBtn.className = 'test-connection-btn success';
            document.getElementById('testConnectionText').textContent = '✓ Serveur accessible';
            connectionStatus.innerHTML = '<i class="fa-solid fa-circle-check" style="color:#00e676"></i> Connexion réussie. Prêt à générer !';
        } catch (err) {
            testConnectionBtn.className = 'test-connection-btn error';
            document.getElementById('testConnectionText').textContent = '✗ Connexion échouée';
            connectionStatus.innerHTML = '<i class="fa-solid fa-circle-xmark" style="color:#ff4d4d"></i> Impossible de joindre le serveur.';
        } finally {
            testConnectionBtn.disabled = false;
        }
    }

    async function generateImage(prompt) {
        const colabUrl = state.colabUrl || colabUrlInput.value.trim();
        if (!colabUrl) {
            alert('⚠️ Veuillez configurer l\'URL du serveur Colab dans la barre latérale.');
            sidebar.classList.add('open');
            return;
        }

        const activeConv = getActiveConversation();
        if (activeConv) {
            activeConv.messages.push({
                role:      'user',
                content:   `/image ${prompt}`,
                timestamp: new Date().toISOString()
            });
            if (activeConv.title === 'Nouvelle discussion') {
                activeConv.title = `🖼️ ${prompt.substring(0, 22)}...`;
            }
            saveStateToStorage();
            renderHistory();
        }

        appendMessageToUI('user', `/image ${prompt}`);
        scrollToBottom(true);

        const loadingRow = appendImageLoadingUI(prompt);
        scrollToBottom(true);

        try {
            const response = await fetch(`${colabUrl}/generate`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ prompt })
            });

            if (!response.ok) throw new Error(`Erreur serveur (${response.status})`);

            const blob     = await response.blob();
            const imageUrl = URL.createObjectURL(blob);

            loadingRow.remove();
            appendImageMessageToUI(prompt, imageUrl);

            if (activeConv) {
                const reader = new FileReader();
                reader.onloadend = () => {
                    activeConv.messages.push({
                        role:      'image',
                        content:   reader.result,
                        prompt:    prompt,
                        timestamp: new Date().toISOString()
                    });
                    saveStateToStorage();
                };
                reader.readAsDataURL(blob);
            }

        } catch (err) {
            loadingRow.remove();
            console.error('Erreur image :', err);

            const errRow    = appendMessageToUI('assistant', '');
            const errBubble = errRow.querySelector('.message-bubble');
            errBubble.innerHTML = `
                <div style="color:#ff4d4d; font-weight:500">
                    <i class="fa-solid fa-circle-exclamation"></i> Erreur de génération d'image<br>
                    <small style="opacity:0.8">${err.message}</small><br>
                    <small style="color:var(--text-muted);margin-top:6px;display:block">
                        Vérifiez que le notebook Colab est actif et que l'URL est correcte.
                    </small>
                </div>`;
            scrollToBottom(true);
        }
    }

    function appendImageLoadingUI(prompt) {
        welcomeScreen.style.display = 'none';

        const row = document.createElement('div');
        row.className = 'message-row assistant';

        const avatar = document.createElement('div');
        avatar.className = 'avatar';
        avatar.innerHTML = '<i class="fa-solid fa-robot"></i>';

        const bubble = document.createElement('div');
        bubble.className = 'message-bubble image-bubble';
        bubble.innerHTML = `
            <div class="image-command-badge">
                <i class="fa-solid fa-wand-magic-sparkles"></i> /image
            </div>
            <div class="image-loading-placeholder">
                <i class="fa-solid fa-spinner"></i>
                <p>Génération en cours...<br><small style="opacity:0.7">${prompt.substring(0, 60)}${prompt.length > 60 ? '...' : ''}</small></p>
                <div class="image-loading-progress">
                    <div class="image-loading-progress-bar"></div>
                </div>
            </div>`;

        row.appendChild(avatar);
        row.appendChild(bubble);
        messagesContainer.appendChild(row);
        return row;
    }

    function appendImageMessageToUI(prompt, imageUrl) {
        welcomeScreen.style.display = 'none';

        const row = document.createElement('div');
        row.className = 'message-row assistant';
        row.style.animation = 'fade-in-slide 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards';

        const avatar = document.createElement('div');
        avatar.className = 'avatar';
        avatar.innerHTML = '<i class="fa-solid fa-robot"></i>';

        const bubble = document.createElement('div');
        bubble.className = 'message-bubble image-bubble';

        const badge = document.createElement('div');
        badge.className = 'image-command-badge';
        badge.innerHTML = '<i class="fa-solid fa-image"></i> Image générée';

        const imgContainer = document.createElement('div');
        imgContainer.className = 'generated-image-container';

        const img = document.createElement('img');
        img.src     = imageUrl;
        img.alt     = prompt;
        img.loading = 'lazy';

        const overlay = document.createElement('div');
        overlay.className = 'image-overlay';

        const downloadBtn = document.createElement('button');
        downloadBtn.className = 'image-action-btn';
        downloadBtn.innerHTML = '<i class="fa-solid fa-download"></i> Télécharger';
        downloadBtn.addEventListener('click', () => {
            const a        = document.createElement('a');
            a.href         = imageUrl;
            const safeName = prompt.replace(/[^a-z0-9]/gi, '_').substring(0, 30).toLowerCase();
            a.download     = `image_${safeName}.png`;
            a.click();
        });

        const copyPromptBtn = document.createElement('button');
        copyPromptBtn.className = 'image-action-btn';
        copyPromptBtn.innerHTML = '<i class="fa-solid fa-copy"></i> Copier prompt';
        copyPromptBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(prompt).then(() => {
                copyPromptBtn.innerHTML = '<i class="fa-solid fa-check" style="color:#00e676"></i> Copié !';
                setTimeout(() => {
                    copyPromptBtn.innerHTML = '<i class="fa-solid fa-copy"></i> Copier prompt';
                }, 2000);
            });
        });

        overlay.appendChild(downloadBtn);
        overlay.appendChild(copyPromptBtn);
        imgContainer.appendChild(img);
        imgContainer.appendChild(overlay);

        const caption = document.createElement('div');
        caption.className = 'image-prompt-caption';
        caption.innerHTML = `<i class="fa-solid fa-quote-left"></i> ${prompt}`;

        bubble.appendChild(badge);
        bubble.appendChild(imgContainer);
        bubble.appendChild(caption);

        row.appendChild(avatar);
        row.appendChild(bubble);
        messagesContainer.appendChild(row);
        scrollToBottom(true);

        return row;
    }

});
