// app.js
// Logique principale du Jeu de Quiz Astral (Bleu Nuit) - Version WebSockets sans Tchat avec Prêt & Bonus Rapidité

document.addEventListener('DOMContentLoaded', () => {
  // Adaptateur WebSocket natif pour le déploiement Cloudflare Workers.
  // Il conserve la petite API on/emit utilisée par le reste de l'application.
  function createWorkerSocket() {
    const listeners = new Map();
    const pendingMessages = [];
    let webSocket = null;
    let connectionStarted = false;
    let connectionErrorSent = false;

    const dispatch = (event, data) => {
      (listeners.get(event) || []).forEach(handler => handler(data));
    };

    const connect = (room) => {
      connectionStarted = true;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const url = `${protocol}//${window.location.host}/ws?room=${encodeURIComponent(room)}`;
      webSocket = new WebSocket(url);

      webSocket.addEventListener('open', () => {
        pendingMessages.splice(0).forEach(message => webSocket.send(message));
      });

      webSocket.addEventListener('message', (event) => {
        try {
          const message = JSON.parse(event.data);
          dispatch(message.event, message.data);
        } catch (error) {
          console.error('Message WebSocket invalide', error);
        }
      });

      webSocket.addEventListener('error', () => {
        if (!connectionErrorSent) {
          connectionErrorSent = true;
          dispatch('connect_error');
        }
      });

      webSocket.addEventListener('close', () => dispatch('disconnect'));
    };

    return {
      on(event, handler) {
        if (!listeners.has(event)) listeners.set(event, []);
        listeners.get(event).push(handler);
      },
      emit(event, data = {}) {
        if (!connectionStarted) {
          const room = event === 'create_room'
            ? Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('')
            : String(data.room || '').toUpperCase();
          connect(room);
        }

        const message = JSON.stringify({ event, data });
        if (webSocket && webSocket.readyState === WebSocket.OPEN) {
          webSocket.send(message);
        } else {
          pendingMessages.push(message);
        }
      },
      disconnect() {
        if (webSocket && webSocket.readyState < WebSocket.CLOSING) webSocket.close(1000);
      }
    };
  }

  // --- ÉTATS DE L'APPLICATION ---
  let pseudo = '';
  let roomCode = '';
  let role = ''; // 'mj' ou 'joueur'
  let socket = null;
  let createRoomTimeout = null;
  
  // Données de jeu
  let players = []; // Liste des joueurs connectés [{ pseudo, score, answered, correct, lastPoints, ready, is_fastest }]
  let currentQuestionIndex = 0;
  let questionDuration = 15; // en secondes
  let timerInterval = null;
  let timeRemaining = 0;
  let selectedAnswerIndex = null;
  let hasAnswered = false;
  
  const totalQuestions = window.QUESTIONS.length;

  // --- ÉLÉMENTS DOM ---
  // Écrans (Sections SPA)
  const screenWelcome = document.getElementById('screen-welcome');
  const screenLobby = document.getElementById('screen-lobby');
  const screenGmDashboard = document.getElementById('screen-gm-dashboard');
  const screenPlayer = document.getElementById('screen-player');
  const screenLeaderboard = document.getElementById('screen-leaderboard');

  // Accueil
  const inputPseudo = document.getElementById('input-pseudo');
  const inputRoom = document.getElementById('input-room');
  const btnCreateGame = document.getElementById('btn-create-game');
  const btnJoinGame = document.getElementById('btn-join-game');

  // Lobby
  const shareLink = document.getElementById('share-link');
  const btnCopyLink = document.getElementById('btn-copy-link');
  const lobbyPlayersList = document.getElementById('lobby-players');
  const lobbyGmControls = document.getElementById('lobby-gm-controls');
  const lobbyPlayerMessage = document.getElementById('lobby-player-message');
  const inputTimer = document.getElementById('input-timer');
  const btnStartGame = document.getElementById('btn-start-game');

  // MJ Dashboard
  const gmStatQuestion = document.getElementById('gm-stat-question');
  const gmStatPlayers = document.getElementById('gm-stat-players');
  const gmStatTimer = document.getElementById('gm-stat-timer');
  const gmQuestionDiff = document.getElementById('gm-question-diff');
  const gmQuestionText = document.getElementById('gm-question-text');
  const gmQuestionOptions = document.getElementById('gm-question-options');
  const btnGmShowAnswers = document.getElementById('btn-gm-show-answers');
  const btnGmNextQuestion = document.getElementById('btn-gm-next-question');

  // Écran Joueur
  const playerQuestionCounter = document.getElementById('player-question-counter');
  const playerDifficulty = document.getElementById('player-difficulty');
  const timerProgress = document.getElementById('timer-progress');
  const playerTimerVal = document.getElementById('player-timer-val');
  const playerQuestionText = document.getElementById('player-question-text');
  const playerOptionsContainer = document.getElementById('player-options-container');
  const playerFeedback = document.getElementById('player-feedback');
  const optionButtons = document.querySelectorAll('.option-btn');

  // Classement
  const podiumView = document.getElementById('podium-view');
  const podiumName1 = document.getElementById('podium-name-1');
  const podiumName2 = document.getElementById('podium-name-2');
  const podiumName3 = document.getElementById('podium-name-3');
  const podiumNames = [podiumName1, podiumName2, podiumName3];
  const podiumScores = [1, 2, 3].map(rank => document.getElementById(`podium-score-${rank}`));
  const podiumAvatars = [1, 2, 3].map(rank => document.getElementById(`podium-avatar-${rank}`));
  const podiumPlaces = [1, 2, 3].map(rank => document.getElementById(`podium-place-${rank}`));
  const leaderboardRows = document.getElementById('leaderboard-rows');
  const btnReplay = document.getElementById('btn-replay');

  // Utilities
  const copyToast = document.getElementById('copy-toast');

  // --- INITIALISATION ---
  function init() {
    // Vérifier si un code de session est présent dans l'URL
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    if (roomParam) {
      inputRoom.value = roomParam.toUpperCase();
      btnCreateGame.textContent = "Créer une nouvelle partie alternative";
      btnCreateGame.classList.replace('btn-primary', 'btn-outline');
      btnJoinGame.classList.replace('btn-accent', 'btn-primary');
    }

    // Événements d'accueil
    btnCreateGame.addEventListener('click', () => startSession(true));
    btnJoinGame.addEventListener('click', () => startSession(false));

    // Événement copie lien
    btnCopyLink.addEventListener('click', copyShareLink);
    shareLink.addEventListener('click', (e) => {
      e.preventDefault();
      copyShareLink();
    });

    // Événement démarrage de partie (MJ)
    btnStartGame.addEventListener('click', startGame);

    // Événement Bouton Prêt (Joueur)
    const btnToggleReady = document.getElementById('btn-toggle-ready');
    if (btnToggleReady) {
      btnToggleReady.addEventListener('click', toggleReady);
    }

    // Événements MJ Dashboard
    btnGmShowAnswers.addEventListener('click', revealAnswersToPlayers);
    btnGmNextQuestion.addEventListener('click', loadNextQuestion);

    // Événements Joueur (Réponses)
    optionButtons.forEach(btn => {
      btn.addEventListener('click', selectAnswer);
    });

    // Événement Rejouer
    btnReplay.addEventListener('click', resetApp);

    // Configuration des timers ou inputs
    if (inputTimer) {
      inputTimer.addEventListener('change', () => {
        if (socket && role === 'mj') {
          socket.emit('update_timer', { room: roomCode, timer: inputTimer.value });
        }
      });
    }
  }

  // --- LOGIQUE DE SESSION / WEBSOCKETS ---

  function startSession(isGM) {
    pseudo = inputPseudo.value.trim();
    if (!pseudo) {
      flashInput(inputPseudo);
      return;
    }

    // Connecter la socket au serveur Flask
    if (!setupSocket()) {
      alert("Impossible de contacter le serveur de jeu. Recharge la page puis réessaie.");
      return;
    }

    if (isGM) {
      role = 'mj';
      setCreateButtonBusy(true);
      btnStartGame.disabled = true; // Désactivé jusqu'à ce que tous les joueurs soient prêts
      socket.emit('create_room', { pseudo: pseudo });
      clearTimeout(createRoomTimeout);
      createRoomTimeout = setTimeout(() => {
        setCreateButtonBusy(false);
        alert("Le serveur n'a pas répondu. Vérifie qu'il est bien lancé, puis réessaie.");
      }, 10000);
    } else {
      role = 'joueur';
      roomCode = inputRoom.value.trim().toUpperCase();
      if (!roomCode) {
        flashInput(inputRoom);
        return;
      }
      socket.emit('join_room', { room: roomCode, pseudo: pseudo });
      
      // Configuration Interface Joueur
      lobbyPlayerMessage.classList.remove('hidden');
      setupLobbyUI();
    }
  }

  function setupSocket() {
    if (socket) {
      socket.disconnect();
    }

    const isCloudflareHost = window.location.hostname.endsWith('.workers.dev')
      || window.location.hostname.endsWith('.pages.dev');
    const useSocketIo = typeof window.io === 'function' && !isCloudflareHost;
    socket = useSocketIo ? window.io() : createWorkerSocket();

    // Le serveur renvoie le code du salon créé
    socket.on('room_created', (data) => {
      clearTimeout(createRoomTimeout);
      createRoomTimeout = null;
      setCreateButtonBusy(false);
      roomCode = data.room;
      lobbyGmControls.classList.remove('hidden');
      setupLobbyUI();
      // Mettre à jour le timer par défaut
      socket.emit('update_timer', { room: roomCode, timer: inputTimer.value });
    });

    // Mise à jour de l'état du salon d'attente (Joueurs et Configuration)
    socket.on('lobby_state', (data) => {
      players = data.players;
      questionDuration = data.timer;
      if (inputTimer && role === 'joueur') {
        inputTimer.value = questionDuration;
      }
      updateLobbyPlayersList();

      // Mettre à jour mon propre bouton Prêt (si joueur)
      const me = players.find(p => p.pseudo === pseudo);
      const btnToggleReady = document.getElementById('btn-toggle-ready');
      if (me && btnToggleReady) {
        if (me.ready) {
          btnToggleReady.textContent = "Annuler le prêt ❌";
          btnToggleReady.className = "btn btn-outline";
        } else {
          btnToggleReady.textContent = "Je suis prêt 👍";
          btnToggleReady.className = "btn btn-accent";
        }
      }

      // Mettre à jour l'activation du bouton Lancer la partie (si MJ)
      if (role === 'mj') {
        // La partie ne commence que s'il y a des joueurs et s'ils sont TOUS prêts
        const allReady = players.length > 0 && players.every(p => p.ready);
        btnStartGame.disabled = !allReady;
      }
    });

    // Lancement de la partie
    socket.on('start_game', () => {
      if (role === 'joueur') {
        showScreen(screenPlayer);
      }
    });

    // Lancement d'une question
    socket.on('start_question', (data) => {
      if (role === 'joueur') {
        setupNewQuestionForPlayer(data.question, data.questionIndex);
      }
    });

    // Un joueur a répondu (mise à jour visuelle)
    socket.on('player_answered', (data) => {
      markPlayerAsAnswered(data.pseudo);
      if (role === 'mj') {
        updateGmAnswersCount();
        
        // Geler le timer du MJ si tous les joueurs connectés ont répondu !
        const allAnswered = players.every(p => p.answered);
        if (allAnswered) {
          clearInterval(timerInterval);
          gmStatTimer.textContent = "Tous répondus !";
          btnGmShowAnswers.disabled = false;
        }
      }
    });

    // Révélation des réponses
    socket.on('show_answer', (data) => {
      players = data.playersScores;
      if (role === 'joueur') {
        revealQuestionCorrection(data.correctIndex, data.playersScores);
      } else if (role === 'mj') {
        clearInterval(timerInterval);
        gmStatTimer.textContent = "Corrigé !";
        btnGmShowAnswers.disabled = true;
        btnGmNextQuestion.disabled = false;
        updateLobbyPlayersList(); 
      }
    });

    // Fin de la partie
    socket.on('game_over', (data) => {
      players = data.playersScores;
      displayFinalLeaderboard();
    });

    // Erreur réseau / Room inexistante
    socket.on('error_message', (data) => {
      clearTimeout(createRoomTimeout);
      createRoomTimeout = null;
      setCreateButtonBusy(false);
      alert(data.message);
      resetApp();
    });

    socket.on('connect_error', () => {
      clearTimeout(createRoomTimeout);
      createRoomTimeout = null;
      setCreateButtonBusy(false);
      alert("Connexion au serveur impossible. Vérifie qu'il est bien lancé, puis réessaie.");
    });

    socket.on('disconnect', () => {
      console.warn("Déconnecté du serveur... ⚠️");
    });

    return true;
  }

  function setupLobbyUI() {
    // Activer l'URL de partage
    history.pushState(null, '', `?room=${roomCode}`);
    const shareUrl = `${window.location.origin}${window.location.pathname}?room=${roomCode}`;
    shareLink.href = shareUrl;
    shareLink.textContent = shareUrl;

    // Afficher l'écran lobby
    showScreen(screenLobby);
  }

  // Actionneur de statut Prêt (Joueur)
  function toggleReady() {
    if (socket && roomCode) {
      socket.emit('toggle_ready', { room: roomCode });
    }
  }

  // --- LOGIQUE MAÎTRE DU JEU ---

  function startGame() {
    // Double vérification
    const allReady = players.length > 0 && players.every(p => p.ready);
    if (!allReady) {
      alert("Tous les joueurs doivent être prêts pour lancer la partie !");
      return;
    }
    
    socket.emit('start_game', { room: roomCode });
    showScreen(screenGmDashboard);
    loadQuestionForGM();
  }

  function loadQuestionForGM() {
    const question = window.QUESTIONS[currentQuestionIndex];
    
    // Réinitialiser les états locaux
    players.forEach(p => {
      p.answered = false;
      p.correct = null;
    });

    // Configurer le tableau de bord
    gmStatQuestion.textContent = `${currentQuestionIndex + 1} / ${totalQuestions}`;
    updateGmAnswersCount();
    
    timeRemaining = questionDuration;
    gmStatTimer.textContent = `${timeRemaining}s`;
    
    gmQuestionDiff.textContent = getDifficultyLabel(question.difficulty);
    gmQuestionDiff.className = `difficulty-badge diff-${question.difficulty}`;
    gmQuestionText.textContent = question.text;
    
    gmQuestionOptions.innerHTML = '';
    question.options.forEach((opt, idx) => {
      const li = document.createElement('li');
      li.innerHTML = `<strong>${String.fromCharCode(65 + idx)}.</strong> ${opt} ${idx === question.answer ? '✔️' : ''}`;
      if (idx === question.answer) {
        li.style.color = 'var(--color-success)';
      }
      gmQuestionOptions.appendChild(li);
    });

    btnGmShowAnswers.disabled = false;
    btnGmNextQuestion.disabled = true;

    // Notifier le serveur du lancement de la question
    socket.emit('start_question', {
      room: roomCode,
      questionIndex: currentQuestionIndex
    });

    // Chrono MJ
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      timeRemaining -= 0.1;
      
      const displaySeconds = Math.max(0, Math.ceil(timeRemaining));
      gmStatTimer.textContent = `${displaySeconds}s`;
      
      if (timeRemaining <= 0) {
        clearInterval(timerInterval);
      }
    }, 100);
  }

  function revealAnswersToPlayers() {
    clearInterval(timerInterval);
    socket.emit('show_answers', { room: roomCode });
  }

  function loadNextQuestion() {
    if (currentQuestionIndex < totalQuestions - 1) {
      currentQuestionIndex++;
      loadQuestionForGM();
    } else {
      socket.emit('game_over', { room: roomCode });
    }
  }

  function updateGmAnswersCount() {
    const answeredCount = players.filter(p => p.answered).length;
    gmStatPlayers.textContent = `${answeredCount} / ${players.length}`;
  }

  // --- LOGIQUE JOUEUR ---

  function setupNewQuestionForPlayer(questionData, qIndex) {
    hasAnswered = false;
    selectedAnswerIndex = null;
    timeRemaining = questionData.duration;

    playerFeedback.style.display = 'none';
    playerFeedback.className = 'feedback-box';

    playerQuestionCounter.textContent = `Question ${qIndex + 1} / ${totalQuestions}`;
    playerDifficulty.textContent = getDifficultyLabel(questionData.difficulty);
    playerDifficulty.className = `difficulty-badge diff-${questionData.difficulty}`;
    playerQuestionText.textContent = questionData.text;

    optionButtons.forEach((btn, idx) => {
      btn.textContent = questionData.options[idx];
      btn.className = 'option-btn';
      btn.disabled = false;
    });

    playerTimerVal.textContent = Math.ceil(timeRemaining);
    updateCircularTimer(1);

    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      timeRemaining -= 0.1;
      
      const displaySeconds = Math.max(0, Math.ceil(timeRemaining));
      playerTimerVal.textContent = displaySeconds;
      
      const ratio = Math.max(0, timeRemaining) / questionData.duration;
      updateCircularTimer(ratio);

      if (timeRemaining <= 3) {
        timerProgress.classList.add('timer-danger');
      } else {
        timerProgress.classList.remove('timer-danger');
      }

      if (timeRemaining <= 0) {
        clearInterval(timerInterval);
        if (!hasAnswered) {
          submitPlayerAnswer(-1);
          showFeedback("Temps écoulé ! En attente du Maître du Jeu...", 'pending');
        }
      }
    }, 100);
  }

  function updateCircularTimer(ratio) {
    const circumference = 176;
    const offset = circumference - (ratio * circumference);
    timerProgress.style.strokeDashoffset = offset;
  }

  function selectAnswer(e) {
    if (hasAnswered) return;

    const btn = e.currentTarget;
    selectedAnswerIndex = parseInt(btn.dataset.index);
    
    optionButtons.forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    
    submitPlayerAnswer(selectedAnswerIndex);
  }

  function submitPlayerAnswer(idx) {
    hasAnswered = true;
    optionButtons.forEach(btn => btn.disabled = true);

    if (idx !== -1) {
      showFeedback("Réponse enregistrée. En attente du Maître du Jeu...", 'pending');
    }

    socket.emit('submit_answer', {
      room: roomCode,
      answerIndex: idx,
      timeRemaining: Math.max(0, timeRemaining)
    });
  }

  function revealQuestionCorrection(correctIdx, scoresList) {
    clearInterval(timerInterval);
    optionButtons.forEach(btn => btn.disabled = true);
    
    players = scoresList;
    const me = players.find(p => p.pseudo === pseudo);
    const wonPoints = me ? me.last_points : 0;
    const isCorrect = me ? me.correct : false;

    optionButtons.forEach((btn, idx) => {
      btn.classList.remove('selected');
      if (idx === correctIdx) {
        btn.classList.add('correct');
      } else if (idx === selectedAnswerIndex && !isCorrect) {
        btn.classList.add('incorrect');
      }
    });

    if (selectedAnswerIndex === -1) {
      showFeedback(`⌛ Temps écoulé ! La bonne réponse était l'option ${String.fromCharCode(65 + correctIdx)}.`, 'error');
    } else if (isCorrect) {
      const speedText = (me && me.is_fastest) ? " ⚡ (Le plus rapide !)" : "";
      showFeedback(`🎉 Correct ! Félicitations, vous gagnez +${wonPoints} points.${speedText}`, 'success');
    } else {
      showFeedback(`❌ Incorrect ! La bonne réponse était l'option ${String.fromCharCode(65 + correctIdx)}.`, 'error');
    }
  }

  // --- RENDU LEADERBOARD / PODIUM ---

  function displayFinalLeaderboard() {
    clearInterval(timerInterval);
    showScreen(screenLeaderboard);

    // Trier les joueurs
    const sorted = [...players].sort((a, b) => b.score - a.score);

    podiumPlaces.forEach((place, index) => {
      const player = sorted[index];

      if (player) {
        const firstLetter = player.pseudo.trim().charAt(0).toUpperCase() || '?';
        podiumNames[index].textContent = player.pseudo;
        podiumScores[index].textContent = `${player.score} pts`;
        podiumAvatars[index].textContent = firstLetter;
        place.classList.remove('is-empty');
      } else {
        podiumNames[index].textContent = 'Place libre';
        podiumScores[index].textContent = '—';
        podiumAvatars[index].textContent = '?';
        place.classList.add('is-empty');
      }
    });

    leaderboardRows.innerHTML = '';
    sorted.forEach((player, idx) => {
      const row = document.createElement('div');
      row.className = 'leaderboard-row';
      row.innerHTML = `
        <div class="leaderboard-row-left">
          <span class="leaderboard-rank">${idx + 1}</span>
          <span class="player-name-wrapper">
            <strong>${player.pseudo}</strong>
            ${player.pseudo === pseudo ? '<span class="badge-role badge-joueur" style="font-size:0.6rem; padding:0.1rem 0.3rem;">Moi</span>' : ''}
          </span>
        </div>
        <span class="leaderboard-score">${player.score} pts</span>
      `;
      leaderboardRows.appendChild(row);
    });
  }

  // --- UTILS ---

  function showScreen(targetScreen) {
    const screens = [screenWelcome, screenLobby, screenGmDashboard, screenPlayer, screenLeaderboard];
    screens.forEach(screen => {
      if (screen === targetScreen) {
        screen.classList.remove('hidden');
      } else {
        screen.classList.add('hidden');
      }
    });
  }

  function updateLobbyPlayersList() {
    lobbyPlayersList.innerHTML = '';
    
    const activePlayers = players;
    if (activePlayers.length === 0) {
      lobbyPlayersList.innerHTML = '<div style="color:var(--text-muted); font-style:italic; font-size:0.9rem;">Aucun joueur n\'a encore rejoint...</div>';
      return;
    }

    activePlayers.forEach(player => {
      const item = document.createElement('div');
      item.className = 'player-item';
      
      const badgeHtml = player.pseudo === pseudo 
        ? `<span class="badge-role badge-joueur">Moi</span>`
        : `<span class="badge-role badge-joueur">Joueur</span>`;
      
      // Indicateur Prêt / En attente
      const readyText = player.ready ? "Prêt ✓" : "En attente...";
      const readyColor = player.ready ? "var(--color-success)" : "var(--color-warning)";
      const readyBadge = `<span class="badge-role" style="background:rgba(255,255,255,0.05); border:1px solid ${readyColor}; color:${readyColor}; font-size:0.7rem; padding:0.1rem 0.4rem; margin-left:0.5rem;">${readyText}</span>`;
      
      const statusDotColor = player.answered ? 'var(--color-success)' : 'var(--color-warning)';
      
      item.innerHTML = `
        <div class="player-name-wrapper">
          <div class="player-status-dot" style="background:${statusDotColor};"></div>
          <strong>${player.pseudo}</strong>
          ${badgeHtml}
          ${readyBadge}
        </div>
        <span style="font-size:0.9rem; font-weight:700; color:var(--color-accent);">${player.score} pts</span>
      `;
      lobbyPlayersList.appendChild(item);
    });
  }

  // Utilisé par le MJ pour cocher qui a répondu en temps réel
  function markPlayerAsAnswered(playerPseudo) {
    const player = players.find(p => p.pseudo === playerPseudo);
    if (player) {
      player.answered = true;
      updateLobbyPlayersList();
    }
  }

  function showFeedback(text, type) {
    playerFeedback.style.display = 'block';
    playerFeedback.textContent = text;
    playerFeedback.className = 'feedback-box';
    
    if (type === 'success') playerFeedback.classList.add('feedback-success');
    if (type === 'error') playerFeedback.classList.add('feedback-error');
    if (type === 'pending') playerFeedback.classList.add('feedback-pending');
  }

  function copyShareLink() {
    const url = shareLink.href;
    navigator.clipboard.writeText(url).then(() => {
      copyToast.classList.add('show');
      setTimeout(() => {
        copyToast.classList.remove('show');
      }, 2000);
    });
  }

  function getDifficultyLabel(diff) {
    if (diff === 'niveau-1') return '🟢 1 point';
    if (diff === 'niveau-2') return '🟡 2 points';
    if (diff === 'niveau-3') return '🟠 3 points';
    if (diff === 'niveau-4') return '🔴 4 points';
    if (diff === 'niveau-5') return '🟣 5 points';
    return diff;
  }

  function flashInput(inputEl) {
    inputEl.style.borderColor = 'var(--color-danger)';
    inputEl.style.boxShadow = '0 0 0 3px rgba(164, 68, 50, 0.14)';
    setTimeout(() => {
      inputEl.style.borderColor = '';
      inputEl.style.boxShadow = '';
    }, 1000);
    inputEl.focus();
  }

  function setCreateButtonBusy(isBusy) {
    if (!btnCreateGame.dataset.defaultLabel) {
      btnCreateGame.dataset.defaultLabel = btnCreateGame.innerHTML;
    }
    btnCreateGame.disabled = isBusy;
    if (isBusy) {
      btnCreateGame.textContent = 'Création du salon…';
    } else {
      btnCreateGame.innerHTML = btnCreateGame.dataset.defaultLabel;
    }
  }

  function resetApp() {
    clearInterval(timerInterval);
    clearTimeout(createRoomTimeout);
    createRoomTimeout = null;
    setCreateButtonBusy(false);
    if (socket) {
      socket.disconnect();
    }
    
    pseudo = '';
    roomCode = '';
    role = '';
    socket = null;
    players = [];
    currentQuestionIndex = 0;
    timerInterval = null;
    selectedAnswerIndex = null;
    hasAnswered = false;

    history.pushState(null, '', window.location.pathname);
    
    inputPseudo.value = '';
    inputRoom.value = '';
    inputTimer.value = '15';

    lobbyGmControls.classList.add('hidden');
    lobbyPlayerMessage.classList.add('hidden');

    podiumPlaces.forEach(place => place.classList.remove('is-empty'));

    // Reset du bouton Prêt
    const btnToggleReady = document.getElementById('btn-toggle-ready');
    if (btnToggleReady) {
      btnToggleReady.textContent = "Je suis prêt 👍";
      btnToggleReady.className = "btn btn-accent";
    }

    showScreen(screenWelcome);
  }

  init();
});
