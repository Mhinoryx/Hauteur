const QUESTIONS = [
  { text: "En quelle année a été fondée Yamaha Motor Company ?", options: ["1887", "1900", "1930", "1955"], answer: 3, difficulty: "niveau-3", points: 3 },
  { text: "Quelle est l'activité principale de la marque Yamaha ?", options: ["Les instruments de musique", "Les motos et motoneiges", "Les moteurs de bateaux", "Les circuits intégrés et appareils électroniques"], answer: 0, difficulty: "niveau-1", points: 1 },
  { text: "Que signifie le sigle « MT » dans la gamme Yamaha actuelle ?", options: ["Mega Torque", "Maximum Traction", "Master of Torque", "Moto Touring"], answer: 2, difficulty: "niveau-1", points: 1 },
  { text: "Quelle est la cylindrée de la Yamaha R1 ?", options: ["899 cm³", "998 cm³", "1 099 cm³", "1 198 cm³"], answer: 1, difficulty: "niveau-2", points: 2 },
  { text: "Quelle est la particularité historique de la YA-1 ?", options: ["Première Yamaha à moteur 4T", "Première Yamaha à injection", "Première moto produite par Yamaha", "Première Yamaha de compétition"], answer: 2, difficulty: "niveau-4", points: 4 },
  { text: "Quel roadster a été remplacé par la MT-09 ?", options: ["FZ8", "FZ1", "XJ6", "Aucun"], answer: 3, difficulty: "niveau-1", points: 1 },
  { text: "En quelle année la Yamaha YZF-R1 originale est-elle apparue ?", options: ["1994", "1996", "1998", "2000"], answer: 2, difficulty: "niveau-3", points: 3 },
  { text: "Au maximum, combien de cylindres Yamaha a-t-il mis dans un seul moteur ?", options: ["6", "8", "10", "12"], answer: 3, difficulty: "niveau-4", points: 4 },
  { text: "Quel est le nom de la première moto équipée d'un turbo produite par Yamaha ?", options: ["XJ650", "GTS1000", "FZ750", "Niken"], answer: 0, difficulty: "niveau-4", points: 4 },
  { text: "Quelle voiture légendaire possède un moteur conçu en collaboration avec Yamaha ?", options: ["Honda NSX", "Lexus LFA", "Porsche Carrera GT", "Toyota Supra"], answer: 1, difficulty: "niveau-5", points: 5 },
  { text: "Quel pilote a remporté un championnat MotoGP avec Yamaha, devenant le premier Français champion du monde dans la catégorie reine ?", options: ["Johann Zarco", "Fabio Quartararo", "Randy de Puniet", "Sylvain Guintoli"], answer: 1, difficulty: "niveau-2", points: 2 },
  { text: "Dans quelle catégorie la Yamaha YZF-R6 a-t-elle particulièrement marqué l'histoire de la compétition ?", options: ["Supersport", "Superbike", "Moto3", "Moto2"], answer: 0, difficulty: "niveau-1", points: 1 },
  { text: "Parmi ces motos, laquelle n'est pas une Yamaha ?", options: ["MT-OS", "Thundercat 600R", "RD-LC", "1000 MT X"], answer: 3, difficulty: "niveau-3", points: 3 },
  { text: "Quelle couleur est historiquement très associée à Yamaha en compétition ?", options: ["Rouge", "Bleu", "Vert", "Orange"], answer: 1, difficulty: "niveau-1", points: 1 },
  { text: "À ce jour, quel est le sponsor majeur du team officiel Yamaha en MotoGP ?", options: ["Monster Energy", "Petronas", "Alpine", "Yamalube"], answer: 0, difficulty: "niveau-2", points: 2 }
];

const emptyRoom = () => ({
  masterId: null,
  timer: 15,
  currentQuestionIndex: 0,
  gameStarted: false,
  players: {}
});

const makeClientId = () => crypto.randomUUID();

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/ws') {
      if (request.headers.get('Upgrade') !== 'websocket') {
        return new Response('WebSocket attendu', { status: 426 });
      }

      const roomCode = (url.searchParams.get('room') || '').trim().toUpperCase();
      if (!/^[A-Z2-9]{4,6}$/.test(roomCode)) {
        return new Response('Code de salon invalide', { status: 400 });
      }

      const id = env.QUIZ_ROOMS.idFromName(roomCode);
      return env.QUIZ_ROOMS.get(id).fetch(request);
    }

    return env.ASSETS.fetch(request);
  }
};

export class QuizRoom {
  constructor(state) {
    this.state = state;
    this.room = emptyRoom();
    this.roomCode = '';
    state.blockConcurrencyWhile(async () => {
      this.room = (await state.storage.get('room')) || emptyRoom();
      this.roomCode = (await state.storage.get('roomCode')) || '';
    });
  }

  async fetch(request) {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    const url = new URL(request.url);

    if (!this.roomCode) {
      this.roomCode = (url.searchParams.get('room') || '').toUpperCase();
      await this.state.storage.put('roomCode', this.roomCode);
    }

    this.state.acceptWebSocket(server);
    server.serializeAttachment({ id: makeClientId(), role: null, pseudo: '' });
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(webSocket, rawMessage) {
    let message;
    try {
      message = JSON.parse(typeof rawMessage === 'string' ? rawMessage : new TextDecoder().decode(rawMessage));
    } catch {
      return this.send(webSocket, 'error_message', { message: 'Message invalide.' });
    }

    const data = message.data || {};
    const client = webSocket.deserializeAttachment() || { id: makeClientId(), role: null, pseudo: '' };

    switch (message.event) {
      case 'create_room':
        await this.createRoom(webSocket, client, data);
        break;
      case 'join_room':
        await this.joinRoom(webSocket, client, data);
        break;
      case 'toggle_ready':
        await this.toggleReady(client);
        break;
      case 'update_timer':
        await this.updateTimer(client, data);
        break;
      case 'start_game':
        await this.startGame(client);
        break;
      case 'start_question':
        await this.startQuestion(client, data);
        break;
      case 'submit_answer':
        await this.submitAnswer(client, data);
        break;
      case 'show_answers':
        await this.showAnswers(client);
        break;
      case 'game_over':
        this.gameOver(client);
        break;
      case 'chat_message':
        this.relayMessage(client, 'chat_message', data);
        break;
      case 'emoji_reaction':
        this.relayMessage(client, 'emoji_reaction', data);
        break;
    }
  }

  async createRoom(webSocket, client, data) {
    const activeMaster = this.findSocketById(this.room.masterId);
    if (activeMaster) {
      this.send(webSocket, 'error_message', { message: 'Ce code de salon est déjà utilisé. Réessaie.' });
      return;
    }

    this.room = emptyRoom();
    client.role = 'mj';
    client.pseudo = String(data.pseudo || 'MJ').trim().slice(0, 15);
    webSocket.serializeAttachment(client);
    this.room.masterId = client.id;
    await this.persist();
    this.send(webSocket, 'room_created', { room: this.roomCode });
  }

  async joinRoom(webSocket, client, data) {
    const pseudo = String(data.pseudo || '').trim().slice(0, 15);
    if (!pseudo || !this.room.masterId || !this.findSocketById(this.room.masterId)) {
      this.send(webSocket, 'error_message', { message: `Le salon ${this.roomCode} n'existe pas ou n'est plus actif.` });
      return;
    }
    if (this.room.gameStarted) {
      this.send(webSocket, 'error_message', { message: 'La partie a déjà commencé.' });
      return;
    }
    if (Object.values(this.room.players).some(player => player.pseudo.toLowerCase() === pseudo.toLowerCase())) {
      this.send(webSocket, 'error_message', { message: 'Ce pseudonyme est déjà utilisé dans ce salon.' });
      return;
    }

    client.role = 'joueur';
    client.pseudo = pseudo;
    webSocket.serializeAttachment(client);
    this.room.players[client.id] = {
      pseudo,
      score: 0,
      answered: false,
      correct: null,
      last_points: 0,
      ready: false,
      time_remaining: 0,
      is_fastest: false
    };
    await this.persist();
    this.broadcastLobby();
  }

  async toggleReady(client) {
    const player = this.room.players[client.id];
    if (!player) return;
    player.ready = !player.ready;
    await this.persist();
    this.broadcastLobby();
  }

  async updateTimer(client, data) {
    if (!this.isMaster(client)) return;
    const timer = Number.parseInt(data.timer, 10);
    this.room.timer = Number.isFinite(timer) ? Math.min(60, Math.max(5, timer)) : 15;
    await this.persist();
    this.broadcastLobby();
  }

  async startGame(client) {
    if (!this.isMaster(client)) return;
    const players = Object.values(this.room.players);
    if (!players.length || !players.every(player => player.ready)) return;
    this.room.gameStarted = true;
    await this.persist();
    this.broadcast('start_game', {});
  }

  async startQuestion(client, data) {
    if (!this.isMaster(client)) return;
    const questionIndex = Math.min(QUESTIONS.length - 1, Math.max(0, Number.parseInt(data.questionIndex, 10) || 0));
    this.room.currentQuestionIndex = questionIndex;
    Object.values(this.room.players).forEach(player => {
      player.answered = false;
      player.correct = null;
      player.last_points = 0;
      player.time_remaining = 0;
      player.is_fastest = false;
    });
    await this.persist();

    const question = QUESTIONS[questionIndex];
    this.broadcast('start_question', {
      questionIndex,
      question: {
        text: question.text,
        options: question.options,
        difficulty: question.difficulty,
        duration: this.room.timer
      }
    });
  }

  async submitAnswer(client, data) {
    const player = this.room.players[client.id];
    if (!player || player.answered) return;
    const question = QUESTIONS[this.room.currentQuestionIndex];
    const answerIndex = Number.parseInt(data.answerIndex, 10);
    const isCorrect = answerIndex === question.answer;
    const points = isCorrect && answerIndex !== -1 ? question.points : 0;

    player.answered = true;
    player.correct = isCorrect;
    player.time_remaining = Math.max(0, Number(data.timeRemaining) || 0);
    player.last_points = points;
    player.score += points;
    await this.persist();
    this.broadcast('player_answered', { pseudo: player.pseudo });
  }

  async showAnswers(client) {
    if (!this.isMaster(client)) return;
    const question = QUESTIONS[this.room.currentQuestionIndex];
    let fastestPlayer = null;
    for (const player of Object.values(this.room.players)) {
      player.is_fastest = false;
      if (player.correct && player.answered && (!fastestPlayer || player.time_remaining > fastestPlayer.time_remaining)) {
        fastestPlayer = player;
      }
    }
    if (fastestPlayer) fastestPlayer.is_fastest = true;
    await this.persist();
    this.broadcast('show_answer', {
      correctIndex: question.answer,
      playersScores: this.playersList()
    });
  }

  gameOver(client) {
    if (!this.isMaster(client)) return;
    this.broadcast('game_over', { playersScores: this.playersList() });
  }

  relayMessage(client, event, data) {
    const textKey = event === 'chat_message' ? 'text' : 'emoji';
    const value = String(data[textKey] || '').trim();
    if (!value) return;
    const player = this.room.players[client.id];
    const sender = this.isMaster(client) ? 'Maître du Jeu' : (player ? player.pseudo : 'Inconnu');
    this.broadcast(event, { sender, [textKey]: value, isSystem: false });
  }

  async webSocketClose(webSocket) {
    await this.removeClient(webSocket);
  }

  async webSocketError(webSocket) {
    await this.removeClient(webSocket);
  }

  async removeClient(webSocket) {
    const client = webSocket.deserializeAttachment();
    if (!client) return;

    if (client.role === 'mj' && this.room.masterId === client.id) {
      this.room.masterId = null;
    } else if (client.role === 'joueur' && this.room.players[client.id]) {
      delete this.room.players[client.id];
      this.broadcastLobby();
    }
    await this.persist();
  }

  isMaster(client) {
    return client.role === 'mj' && client.id === this.room.masterId;
  }

  findSocketById(id) {
    if (!id) return null;
    return this.state.getWebSockets().find(socket => socket.deserializeAttachment()?.id === id) || null;
  }

  playersList() {
    return Object.values(this.room.players);
  }

  broadcastLobby() {
    this.broadcast('lobby_state', { players: this.playersList(), timer: this.room.timer });
  }

  send(webSocket, event, data = {}) {
    try {
      webSocket.send(JSON.stringify({ event, data }));
    } catch {
      // La fermeture sera traitée par webSocketClose/webSocketError.
    }
  }

  broadcast(event, data = {}) {
    this.state.getWebSockets().forEach(socket => this.send(socket, event, data));
  }

  persist() {
    return this.state.storage.put('room', this.room);
  }
}
