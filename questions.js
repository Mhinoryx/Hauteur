// questions.js
// Liste des questions du quiz avec leurs difficultés et les 4 choix de réponse.

const QUESTIONS = [
  {
    id: 1,
    text: "En quelle année a été fondée Yamaha Motor Company ?",
    options: ["1887", "1900", "1930", "1955"],
    answer: 3,
    difficulty: "niveau-3",
    points: 3
  },
  {
    id: 2,
    text: "Quelle est l'activité principale de la marque Yamaha ?",
    options: ["Les instruments de musique", "Les motos et motoneiges", "Les moteurs de bateaux", "Les circuits intégrés et appareils électroniques"],
    answer: 0,
    difficulty: "niveau-1",
    points: 1
  },
  {
    id: 3,
    text: "Que signifie le sigle « MT » dans la gamme Yamaha actuelle ?",
    options: ["Mega Torque", "Maximum Traction", "Master of Torque", "Moto Touring"],
    answer: 2,
    difficulty: "niveau-1",
    points: 1
  },
  {
    id: 4,
    text: "Quelle est la cylindrée de la Yamaha R1 ?",
    options: ["899 cm³", "998 cm³", "1 099 cm³", "1 198 cm³"],
    answer: 1,
    difficulty: "niveau-2",
    points: 2
  },
  {
    id: 5,
    text: "Quelle est la particularité historique de la YA-1 ?",
    options: ["Première Yamaha à moteur 4T", "Première Yamaha à injection", "Première moto produite par Yamaha", "Première Yamaha de compétition"],
    answer: 2,
    difficulty: "niveau-4",
    points: 4
  },
  {
    id: 6,
    text: "Quel roadster a été remplacé par la MT-09 ?",
    options: ["FZ8", "FZ1", "XJ6", "Aucun"],
    answer: 3,
    difficulty: "niveau-1",
    points: 1
  },
  {
    id: 7,
    text: "En quelle année la Yamaha YZF-R1 originale est-elle apparue ?",
    options: ["1994", "1996", "1998", "2000"],
    answer: 2,
    difficulty: "niveau-3",
    points: 3
  },
  {
    id: 8,
    text: "Au maximum, combien de cylindres Yamaha a-t-il mis dans un seul moteur ?",
    options: ["6", "8", "10", "12"],
    answer: 3,
    difficulty: "niveau-4",
    points: 4
  },
  {
    id: 9,
    text: "Quel est le nom de la première moto équipée d'un turbo produite par Yamaha ?",
    options: ["XJ650", "GTS1000", "FZ750", "Niken"],
    answer: 0,
    difficulty: "niveau-4",
    points: 4
  },
  {
    id: 10,
    text: "Quelle voiture légendaire possède un moteur conçu en collaboration avec Yamaha ?",
    options: ["Honda NSX", "Lexus LFA", "Porsche Carrera GT", "Toyota Supra"],
    answer: 1,
    difficulty: "niveau-5",
    points: 5
  },
  {
    id: 11,
    text: "Quel pilote a remporté un championnat MotoGP avec Yamaha, devenant le premier Français champion du monde dans la catégorie reine ?",
    options: ["Johann Zarco", "Fabio Quartararo", "Randy de Puniet", "Sylvain Guintoli"],
    answer: 1,
    difficulty: "niveau-2",
    points: 2
  },
  {
    id: 12,
    text: "Dans quelle catégorie la Yamaha YZF-R6 a-t-elle particulièrement marqué l'histoire de la compétition ?",
    options: ["Supersport", "Superbike", "Moto3", "Moto2"],
    answer: 0,
    difficulty: "niveau-1",
    points: 1
  },
  {
    id: 13,
    text: "Parmi ces motos, laquelle n'est pas une Yamaha ?",
    options: ["MT-OS", "Thundercat 600R", "RD-LC", "1000 MT X"],
    answer: 3,
    difficulty: "niveau-3",
    points: 3
  },
  {
    id: 14,
    text: "Quelle couleur est historiquement très associée à Yamaha en compétition ?",
    options: ["Rouge", "Bleu", "Vert", "Orange"],
    answer: 1,
    difficulty: "niveau-1",
    points: 1
  },
  {
    id: 15,
    text: "À ce jour, quel est le sponsor majeur du team officiel Yamaha en MotoGP ?",
    options: ["Monster Energy", "Petronas", "Alpine", "Yamalube"],
    answer: 0,
    difficulty: "niveau-2",
    points: 2
  }
];

// Rendre la variable accessible dans le navigateur
window.QUESTIONS = QUESTIONS;
