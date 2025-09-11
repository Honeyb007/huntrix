let player = { 
  hp: 100, 
  energy: 100
};
let currentMusic;

// Load HUD with selected character
function loadCharacter() {
  const selected = JSON.parse(localStorage.getItem("selectedCharacter") || "null");
  if (!selected) return;

  document.getElementById("hud-img").src = selected.image || "images/default.png";
  document.getElementById("hud-name").textContent = selected.name;
}

// --- Scenes ---
const scenes = {
  start: {
    text: "You awaken in a neon-lit cave. A voice whispers: 'Hunter… will you fight the darkness or let it consume you?'",
    bg: "./images/intro.jpg",
    music: { file: "./images/How_Its_Done(128k).m4a", title: "Intro Theme" },
    changes: { energy: -5 },
    choices: [
      { text: "Follow the voice", next: "allyEncounter" },
      { text: "Explore a glowing tunnel", next: "hiddenChamber" }
    ]
  },
  allyEncounter: {
    text: "A fellow Hunter steps forward. Their eyes flicker with strange light.",
    bg: "./images/huntrix.jpg",
    music: { file: "music/mystery.mp3", title: "Mysterious Encounter" },
    changes: { energy: -10 },
    choices: [
      { text: "Trust them", next: "mentor" },
      { text: "Distrust them", next: "trap" }
    ]
  },
  hiddenChamber: {
    text: "You find a chamber filled with glowing crystals. A soft hum restores you.",
    bg: "./images/chamber.jpg",
    music: { file: "music/crystal.mp3", title: "Crystal Resonance" },
    changes: { hp: +15, energy: +20 },
    choices: [
      { text: "Absorb the energy", next: "mentor" },
      { text: "Leave quietly", next: "trap" }
    ]
  },
  mentor: {
    text: "A cloaked figure sings an ancient melody: 'Strength is choice, not fate.'",
    bg: "./images/mentor.jpg",
    music: { file: "music/mentor.mp3", title: "Mentor’s Song" },
    changes: { hp: +10, energy: -15 },
    choices: [
      { text: "Sing with them", next: "songPath" },
      { text: "Walk away", next: "gate" }
    ]
  },
  songPath: {
    text: "Your voice merges with theirs. A hidden path opens, glowing like a stage light.",
    bg: "./images/song.jpg",
    music: { file: "music/song.mp3", title: "Song of Hunters" },
    changes: { energy: +25 },
    choices: [
      { text: "Step onto the stage", next: "finalBossGood" }
    ]
  },
  trap: {
    text: "The ground splits beneath you. Shadows claw at your soul.",
    bg: "./images/trap.jpg",
    music: { file: "music/danger.mp3", title: "Shadow Trap" },
    changes: { hp: -40, energy: -20 },
    choices: [
      { text: "Climb out", next: "gate" },
      { text: "Give in", next: "badEnd" }
    ]
  },
  gate: {
    text: "You reach a massive gate pulsing with red energy. Beyond it lies the Demon King.",
    bg: "images/gate.jpg",
    music: { file: "music/gate.mp3", title: "Demon’s Gate" },
    changes: {},
    choices: [
      { text: "Enter bravely", next: "finalBossGood" },
      { text: "Retreat", next: "neutralEnd" }
    ]
  },
  finalBossGood: {
    text: "The Demon King rises. His roar shakes the cave. Will you burn your energy to fight?",
    bg: "./images/boss.jpg",
    music: { file: "./images/TAKEDOWN__JEONGYEON,_JIHYO,_CHAEYOUNG_(128k).m4a", title: "Boss Battle" },
    changes: { energy: -30 },
    choices: [
      { text: "Unleash your power", next: "goodEnd" },
      { text: "Hesitate", next: "badEnd" }
    ]
  },
  goodEnd: {
    text: "✨ The Demon King falls. Balance is restored. You emerge as legend.",
    bg: "./images/bb.jpg",
    music: { file: "./images/Golden(128k).m4a", title: "Victory Theme" },
    changes: {},
    choices: [],
    end: true
  },
  badEnd: {
    text: "☠️ You fall into the abyss. Huntrix ends here.",
    bg: "./images/trap.jpg",
    music: { file: "music/gameover.mp3", title: "Game Over" },
    changes: {},
    choices: [],
    end: true
  },
  neutralEnd: {
    text: "⚖️ The world remains in danger, but you survive. Someone sacrificed for you.",
    bg: "./images/sacrifice.jpg",
    music: { file: "music/neutral.mp3", title: "Neutral Ending" },
    changes: {},
    choices: [],
    end: true
  }
};

// --- Game Functions ---
function startGame() {
  player.hp = 100;
  player.energy = 100;
  showScene("start");
}

function showScene(id) {
  const scene = scenes[id];
  if (!scene) return;

  // Apply stat changes
  if (scene.changes) {
    player.hp = Math.max(0, player.hp + (scene.changes.hp || 0));
    player.energy = Math.max(0, player.energy + (scene.changes.energy || 0));
  }

  // Auto-fail
  if (player.hp <= 0) return showScene("badEnd");
  if (player.energy <= 0) return showScene("badEnd");

  // Story
  document.getElementById("story").textContent = scene.text;

  // Choices rendering
  const choicesContainer = document.getElementById("choices");
  if (scene.end) {
    // Update profile data
    let profileData = JSON.parse(localStorage.getItem("huntrix_profile")) || {
      endings: [],
      replays: 0,
      lastHP: 100,
      lastEnergy: 100
    };

    if (!profileData.endings.includes(id)) {
      profileData.endings.push(id);
    }
    profileData.lastHP = player.hp;
    profileData.lastEnergy = player.energy;

    localStorage.setItem("huntrix_profile", JSON.stringify(profileData));

    // Render replay / end game buttons
    choicesContainer.innerHTML = `
      <button class="replay" onclick="incrementReplay()">🔄 Replay</button>
      <button onclick="goDashboard()">🏠 End Game</button>
    `;
  } else {
    choicesContainer.innerHTML = scene.choices
      .map(c => `<button onclick="showScene('${c.next}')">${c.text}</button>`)
      .join("");
  }

  // Background
  document.getElementById("game-area").style.backgroundImage = `url('${scene.bg}')`;

  // Music
  if (currentMusic) {
    currentMusic.pause();
    currentMusic.currentTime = 0;
  }
  if (scene.music) {
    currentMusic = new Audio(scene.music.file);
    currentMusic.loop = true;
    currentMusic.volume = 0.6;
    currentMusic.play().catch(() => {});
    document.getElementById("music-title").textContent = scene.music.title;
  }

  // Update stats bars
  document.getElementById("hp-bar").style.width = player.hp + "%";
  document.getElementById("energy-bar").style.width = player.energy + "%";
}

// --- Replay Tracker ---
function incrementReplay() {
  let profileData = JSON.parse(localStorage.getItem("huntrix_profile")) || {};
  profileData.replays = (profileData.replays || 0) + 1;
  localStorage.setItem("huntrix_profile", JSON.stringify(profileData));
  startGame();
}

// --- Redirect ---
function goDashboard() {
  window.location.href = "dashboard.html";
}

// --- Boot Game ---
loadCharacter();
startGame();