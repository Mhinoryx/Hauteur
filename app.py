# app.py
# Serveur Backend Python pour le Jeu de Quiz Astral (Bleu Nuit)

import random
import string
from flask import Flask, request, session
from flask_socketio import SocketIO, emit, join_room, leave_room

# Configuration Flask
# On configure le dossier statique sur le répertoire courant '.' pour servir directement les fichiers frontend.
app = Flask(__name__, static_folder='.', static_url_path='')
app.config['SECRET_KEY'] = 'quiz_astral_secret_key_13579!'

# Configuration SocketIO (Support WebSockets direct avec simple-websocket)
socketio = SocketIO(app, cors_allowed_origins="*")

# --- BANQUE DE QUESTIONS DU CÔTÉ SERVEUR ---
# Utilisé pour valider les réponses et calculer les scores
QUESTIONS = [
  {
    "id": 1,
    "text": "En quelle année a été fondée Yamaha Motor Company ?",
    "options": ["1887", "1900", "1930", "1955"],
    "answer": 3,
    "difficulty": "niveau-3",
    "points": 3
  },
  {
    "id": 2,
    "text": "Quelle est l'activité principale de la marque Yamaha ?",
    "options": ["Les instruments de musique", "Les motos et motoneiges", "Les moteurs de bateaux", "Les circuits intégrés et appareils électroniques"],
    "answer": 0,
    "difficulty": "niveau-1",
    "points": 1
  },
  {
    "id": 3,
    "text": "Que signifie le sigle « MT » dans la gamme Yamaha actuelle ?",
    "options": ["Mega Torque", "Maximum Traction", "Master of Torque", "Moto Touring"],
    "answer": 2,
    "difficulty": "niveau-1",
    "points": 1
  },
  {
    "id": 4,
    "text": "Quelle est la cylindrée de la Yamaha R1 ?",
    "options": ["899 cm³", "998 cm³", "1 099 cm³", "1 198 cm³"],
    "answer": 1,
    "difficulty": "niveau-2",
    "points": 2
  },
  {
    "id": 5,
    "text": "Quelle est la particularité historique de la YA-1 ?",
    "options": ["Première Yamaha à moteur 4T", "Première Yamaha à injection", "Première moto produite par Yamaha", "Première Yamaha de compétition"],
    "answer": 2,
    "difficulty": "niveau-4",
    "points": 4
  },
  {
    "id": 6,
    "text": "Quel roadster a été remplacé par la MT-09 ?",
    "options": ["FZ8", "FZ1", "XJ6", "Aucun"],
    "answer": 3,
    "difficulty": "niveau-1",
    "points": 1
  },
  {
    "id": 7,
    "text": "En quelle année la Yamaha YZF-R1 originale est-elle apparue ?",
    "options": ["1994", "1996", "1998", "2000"],
    "answer": 2,
    "difficulty": "niveau-3",
    "points": 3
  },
  {
    "id": 8,
    "text": "Au maximum, combien de cylindres Yamaha a-t-il mis dans un seul moteur ?",
    "options": ["6", "8", "10", "12"],
    "answer": 3,
    "difficulty": "niveau-4",
    "points": 4
  },
  {
    "id": 9,
    "text": "Quel est le nom de la première moto équipée d'un turbo produite par Yamaha ?",
    "options": ["XJ650", "GTS1000", "FZ750", "Niken"],
    "answer": 0,
    "difficulty": "niveau-4",
    "points": 4
  },
  {
    "id": 10,
    "text": "Quelle voiture légendaire possède un moteur conçu en collaboration avec Yamaha ?",
    "options": ["Honda NSX", "Lexus LFA", "Porsche Carrera GT", "Toyota Supra"],
    "answer": 1,
    "difficulty": "niveau-5",
    "points": 5
  },
  {
    "id": 11,
    "text": "Quel pilote a remporté un championnat MotoGP avec Yamaha, devenant le premier Français champion du monde dans la catégorie reine ?",
    "options": ["Johann Zarco", "Fabio Quartararo", "Randy de Puniet", "Sylvain Guintoli"],
    "answer": 1,
    "difficulty": "niveau-2",
    "points": 2
  },
  {
    "id": 12,
    "text": "Dans quelle catégorie la Yamaha YZF-R6 a-t-elle particulièrement marqué l'histoire de la compétition ?",
    "options": ["Supersport", "Superbike", "Moto3", "Moto2"],
    "answer": 0,
    "difficulty": "niveau-1",
    "points": 1
  },
  {
    "id": 13,
    "text": "Parmi ces motos, laquelle n'est pas une Yamaha ?",
    "options": ["MT-OS", "Thundercat 600R", "RD-LC", "1000 MT X"],
    "answer": 3,
    "difficulty": "niveau-3",
    "points": 3
  },
  {
    "id": 14,
    "text": "Quelle couleur est historiquement très associée à Yamaha en compétition ?",
    "options": ["Rouge", "Bleu", "Vert", "Orange"],
    "answer": 1,
    "difficulty": "niveau-1",
    "points": 1
  },
  {
    "id": 15,
    "text": "À ce jour, quel est le sponsor majeur du team officiel Yamaha en MotoGP ?",
    "options": ["Monster Energy", "Petronas", "Alpine", "Yamalube"],
    "answer": 0,
    "difficulty": "niveau-2",
    "points": 2
  }
]

# --- STRUCTURES DE DONNÉES EN MÉMOIRE ---
ROOMS = {}
# Ex: {
#   "CODE": {
#       "master_sid": "sid",
#       "timer": 15,
#       "current_question_index": 0,
#       "game_started": False,
#       "players": {
#           "sid": { "pseudo": "Alice", "score": 0, "answered": False, "correct": None, "last_points": 0 }
#       }
#   }
# }

SID_TO_SESSION = {}
# Ex: { "sid": { "room": "CODE", "role": "mj"/"joueur" } }


# --- ROUTES HTTP FLASK ---
@app.route('/')
def index():
    return app.send_static_file('index.html')


# --- ÉVÉNEMENTS SOCKET.IO ---

@socketio.on('connect')
def handle_connect():
    print(f"[SOCKET] Connexion établie : {request.sid}")

@socketio.on('disconnect')
def handle_disconnect():
    print(f"[SOCKET] Déconnexion : {request.sid}")
    if request.sid in SID_TO_SESSION:
        session_info = SID_TO_SESSION[request.sid]
        room = session_info['room']
        role = session_info['role']
        
        # Nettoyer la session
        del SID_TO_SESSION[request.sid]
        
        if room in ROOMS:
            if role == 'mj':
                # Le MJ est parti
                ROOMS[room]['master_sid'] = None
                emit('chat_message', {
                    'sender': 'Système',
                    'text': 'Le Maître du Jeu s\'est déconnecté. ⚠️',
                    'isSystem': True
                }, to=room)
                print(f"[LOBBY] Le MJ a quitté la room : {room}")
            else:
                # Un joueur est parti
                if request.sid in ROOMS[room]['players']:
                    player = ROOMS[room]['players'][request.sid]
                    pseudo = player['pseudo']
                    del ROOMS[room]['players'][request.sid]
                    
                    # Annoncer le départ
                    emit('chat_message', {
                        'sender': 'Système',
                        'text': f'{pseudo} a quitté la partie. 🚪',
                        'isSystem': True
                    }, to=room)
                    
                    # Renvoyer la liste mise à jour
                    emit('lobby_state', {
                        'players': list(ROOMS[room]['players'].values()),
                        'timer': ROOMS[room]['timer']
                    }, to=room)
                    print(f"[LOBBY] Le joueur {pseudo} a quitté la room : {room}")

            # Supprimer la room si elle est vide (pas de MJ et pas de joueurs)
            if not ROOMS[room]['master_sid'] and not ROOMS[room]['players']:
                del ROOMS[room]
                print(f"[LOBBY] Room {room} supprimée car vide.")

@socketio.on('create_room')
def handle_create_room(data):
    pseudo = data.get('pseudo', 'MJ').strip()
    
    # Générer un code unique de 4 lettres
    chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    while True:
        room_code = ''.join(random.choices(chars, k=4))
        if room_code not in ROOMS:
            break
            
    ROOMS[room_code] = {
        "master_sid": request.sid,
        "timer": 15,
        "current_question_index": 0,
        "game_started": False,
        "players": {}
    }
    
    SID_TO_SESSION[request.sid] = {
        "room": room_code,
        "role": "mj"
    }
    
    join_room(room_code)
    emit('room_created', {'room': room_code})
    print(f"[LOBBY] Room créée : {room_code} par MJ ({pseudo})")

@socketio.on('join_room')
def handle_join_room(data):
    room = data.get('room', '').strip().upper()
    pseudo = data.get('pseudo', '').strip()
    
    if not room or not pseudo:
        emit('error_message', {'message': 'Pseudo ou code de salon manquant.'})
        return
        
    if room not in ROOMS:
        emit('error_message', {'message': f'Le salon {room} n\'existe pas.'})
        return
        
    # Vérifier l'unicité du pseudo
    existing_players = [p['pseudo'].lower() for p in ROOMS[room]['players'].values()]
    if pseudo.lower() in existing_players:
        emit('error_message', {'message': 'Ce pseudonyme est déjà utilisé dans ce salon.'})
        return
        
    # Ajouter le joueur
    ROOMS[room]['players'][request.sid] = {
        "pseudo": pseudo,
        "score": 0,
        "answered": False,
        "correct": None,
        "last_points": 0,
        "ready": False,
        "time_remaining": 0.0,
        "is_fastest": False
    }
    
    SID_TO_SESSION[request.sid] = {
        "room": room,
        "role": "joueur"
    }
    
    join_room(room)
    
    # Notifier le groupe
    emit('chat_message', {
        'sender': 'Système',
        'text': f'{pseudo} a rejoint la partie. 🚀',
        'isSystem': True
    }, to=room)
    
    # Envoyer l'état du lobby mis à jour
    emit('lobby_state', {
        'players': list(ROOMS[room]['players'].values()),
        'timer': ROOMS[room]['timer']
    }, to=room)
    
    print(f"[LOBBY] {pseudo} a rejoint la room {room}")

@socketio.on('toggle_ready')
def handle_toggle_ready(data):
    room = data.get('room', '')
    if room in ROOMS and request.sid in ROOMS[room]['players']:
        player = ROOMS[room]['players'][request.sid]
        player['ready'] = not player['ready']
        
        # Diffuser l'état du lobby mis à jour
        emit('lobby_state', {
            'players': list(ROOMS[room]['players'].values()),
            'timer': ROOMS[room]['timer']
        }, to=room)
        print(f"[LOBBY] {player['pseudo']} a changé son état Prêt à : {player['ready']}")

@socketio.on('update_timer')
def handle_update_timer(data):
    room = data.get('room', '')
    timer_val = int(data.get('timer', 15))
    
    if room in ROOMS and SID_TO_SESSION.get(request.sid, {}).get('role') == 'mj':
        ROOMS[room]['timer'] = timer_val
        emit('lobby_state', {
            'players': list(ROOMS[room]['players'].values()),
            'timer': timer_val
        }, to=room)

@socketio.on('start_game')
def handle_start_game(data):
    room = data.get('room', '')
    if room in ROOMS and SID_TO_SESSION.get(request.sid, {}).get('role') == 'mj':
        ROOMS[room]['game_started'] = True
        emit('start_game', to=room)
        print(f"[JEU] Partie démarrée dans la room {room}")

@socketio.on('start_question')
def handle_start_question(data):
    room = data.get('room', '')
    q_index = int(data.get('questionIndex', 0))
    
    if room in ROOMS and SID_TO_SESSION.get(request.sid, {}).get('role') == 'mj':
        ROOMS[room]['current_question_index'] = q_index
        
        # Réinitialiser l'état des réponses pour cette question
        for player in ROOMS[room]['players'].values():
            player['answered'] = False
            player['correct'] = None
            player['last_points'] = 0
            player['time_remaining'] = 0.0
            player['is_fastest'] = False
            
        question = QUESTIONS[q_index]
        
        # Diffuser le début de la question (sans la réponse !)
        emit('start_question', {
            'questionIndex': q_index,
            'question': {
                'text': question['text'],
                'options': question['options'],
                'difficulty': question['difficulty'],
                'duration': ROOMS[room]['timer']
            }
        }, to=room)
        print(f"[JEU] Question {q_index + 1} démarrée dans la room {room}")

@socketio.on('submit_answer')
def handle_submit_answer(data):
    room = data.get('room', '')
    answer_idx = int(data.get('answerIndex', -1))
    time_rem = float(data.get('timeRemaining', 0))
    
    if room not in ROOMS or request.sid not in ROOMS[room]['players']:
        return
        
    player = ROOMS[room]['players'][request.sid]
    if player['answered']:
        return # Déjà répondu
        
    q_index = ROOMS[room]['current_question_index']
    question = QUESTIONS[q_index]
    
    is_correct = (answer_idx == question['answer'])
    
    # Calcul des points
    points = 0
    if is_correct and answer_idx != -1:
        points = question['points']
        
    # Mettre à jour le joueur
    player['answered'] = True
    player['correct'] = is_correct
    player['time_remaining'] = time_rem
    player['last_points'] = points
    player['score'] += points
    
    # Notifier le groupe qu'un joueur a répondu
    emit('player_answered', {'pseudo': player['pseudo']}, to=room)
    print(f"[JEU] {player['pseudo']} a répondu (Correct={is_correct}, Points={points})")

@socketio.on('show_answers')
def handle_show_answers(data):
    room = data.get('room', '')
    if room in ROOMS and SID_TO_SESSION.get(request.sid, {}).get('role') == 'mj':
        q_index = ROOMS[room]['current_question_index']
        correct_idx = QUESTIONS[q_index]['answer']
        
        # Trouver la personne qui a répondu le plus vite parmi les réponses correctes
        fastest_sid = None
        max_time_left = -1.0
        
        for sid, player in ROOMS[room]['players'].items():
            if player.get('correct') and player.get('answered'):
                # time_remaining est le temps restant. Plus il est grand, plus le joueur a été rapide.
                t_rem = player.get('time_remaining', 0.0)
                if t_rem > max_time_left:
                    max_time_left = t_rem
                    fastest_sid = sid
                    
        # Signaler le plus rapide sans modifier le barème de la question
        if fastest_sid:
            fastest_player = ROOMS[room]['players'][fastest_sid]
            fastest_player['is_fastest'] = True
            print(f"[JEU] {fastest_player['pseudo']} est le plus rapide")
            
        # Diffuser la correction avec la liste de tous les scores mis à jour
        emit('show_answer', {
            'correctIndex': correct_idx,
            'playersScores': list(ROOMS[room]['players'].values())
        }, to=room)
        print(f"[JEU] Révélation des réponses pour la question {q_index + 1} dans {room}")

@socketio.on('game_over')
def handle_game_over(data):
    room = data.get('room', '')
    if room in ROOMS and SID_TO_SESSION.get(request.sid, {}).get('role') == 'mj':
        emit('game_over', {
            'playersScores': list(ROOMS[room]['players'].values())
        }, to=room)
        print(f"[JEU] Fin du jeu dans la room {room}")

@socketio.on('chat_message')
def handle_chat_message(data):
    room = data.get('room', '')
    text = data.get('text', '').strip()
    
    if not room or not text:
        return
        
    # Trouver le pseudo de l'expéditeur
    sender = "Inconnu"
    if SID_TO_SESSION.get(request.sid, {}).get('role') == 'mj':
        sender = "Maître du Jeu"
    elif request.sid in ROOMS.get(room, {}).get('players', {}):
        sender = ROOMS[room]['players'][request.sid]['pseudo']
        
    emit('chat_message', {
        'sender': sender,
        'text': text,
        'isSystem': False
    }, to=room)

@socketio.on('emoji_reaction')
def handle_emoji_reaction(data):
    room = data.get('room', '')
    emoji = data.get('emoji', '').strip()
    
    if not room or not emoji:
        return
        
    # Trouver le pseudo de l'expéditeur
    sender = "Inconnu"
    if SID_TO_SESSION.get(request.sid, {}).get('role') == 'mj':
        sender = "Maître du Jeu"
    elif request.sid in ROOMS.get(room, {}).get('players', {}):
        sender = ROOMS[room]['players'][request.sid]['pseudo']
        
    emit('emoji_reaction', {
        'sender': sender,
        'emoji': emoji
    }, to=room)


# --- DÉMARRAGE DU SERVEUR ---
if __name__ == '__main__':
    # On lance l'application sur le port 5000 (accessible en local et réseau)
    socketio.run(app, host='0.0.0.0', port=5000, debug=True, allow_unsafe_werkzeug=True)
