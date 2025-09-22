// ---------- State ----------
const player = { hp: 100, energy: 100 };

// ...existing code...

// At the very end of the file, after all functions are defined:
window.addEventListener('DOMContentLoaded', function() {
  // Secret menu icon triggers menuSceneSecret
  const menuSecretIcon = document.getElementById('menu-secret-icon');
  if (menuSecretIcon) {
    menuSecretIcon.addEventListener('click', function() {
      showScene('menuSceneSecret');
    });
    menuSecretIcon.addEventListener('mouseenter', function() { menuSecretIcon.style.opacity = 1; });
    menuSecretIcon.addEventListener('mouseleave', function() { menuSecretIcon.style.opacity = 0.5; });
  }
  // Try to resume from profile, else start new game
  if (typeof tryResumeFromProfile === 'function' && tryResumeFromProfile()) {
    // Resumed, do not start new game
  } else {
    if (typeof loadCharacter === 'function') loadCharacter();
    if (typeof startGame === 'function') startGame();
  }
});
const state = { hiddenQuestUnlocked: false };

let audioEl = null;         // currently playing HTMLAudioElement for music (for compatibility)
let fadeTimer = null;
let audioCtx = null;        // WebAudio context for sfx
const sfxBuffers = {};      // decoded buffers for sfx
const sfxFiles = {          // expected sfx filenames (you can add more)
  attack: 'sfx/attack.mp3',
  hurt:   'sfx/hurt.mp3',
  swing:  'sfx/swing.mp3',
  impact: 'sfx/impact.mp3'
  
};
let lastHP = player.hp;
// lightweight toast for game UI
(function(){
  function createToastContainer(){
    if (document.getElementById('toast-container')) return;
    const c = document.createElement('div');
    c.id = 'toast-container';
    document.body.appendChild(c);
  }
  createToastContainer();
})();

function showToast(message, type = 'info', ms = 1200) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<span class="emoji">${ type === 'success' ? '✅' : type === 'error' ? '⚠️' : 'ℹ️' }</span><div>${message}</div>`;
  container.appendChild(t);
  setTimeout(() => {
    t.style.opacity = '0';
    t.style.transform = 'translateY(6px) scale(.98)';
    setTimeout(()=> t.remove(), 220);
  }, ms);
}

// ---------- DOM refs ----------
const hudImg = document.getElementById('hud-img');
const hudName = document.getElementById('hud-name');
const hpBar = document.getElementById('hp-bar');
const enBar = document.getElementById('en-bar');
const musicTitle = document.getElementById('music-title');
const musicToggle = document.getElementById('music-toggle');
const musicMute = document.getElementById('music-mute');
const dialogWrap = document.getElementById('dialog');
const dialogImg = document.getElementById('dialog-img');
const dialogChar = document.getElementById('dialog-char');
const dialogText = document.getElementById('dialog-text');
const dialogNext = document.getElementById('dialog-next');
const storyEl = document.getElementById('story');
const choicesEl = document.getElementById('choices');
const gameArea = document.getElementById('game-area');

// --- Music Controls for currentMusic ---
function updateMusicToggleUI() {
  if (!currentMusic) return;
  if (musicToggle) musicToggle.textContent = currentMusic.paused ? '▶' : '⏸';
  if (musicMute) musicMute.textContent = currentMusic.muted ? 'Unmute' : 'Mute';
}

if (musicToggle) {
  musicToggle.addEventListener('click', function() {
    if (!currentMusic) return;
    if (currentMusic.paused) {
      currentMusic.play().catch(()=>{});
    } else {
      currentMusic.pause();
    }
    updateMusicToggleUI();
  });
}

if (musicMute) {
  musicMute.addEventListener('click', function() {
    if (!currentMusic) return;
    currentMusic.muted = !currentMusic.muted;
    updateMusicToggleUI();
  });
}

function observeCurrentMusic() {
  if (!currentMusic) return;
  currentMusic.addEventListener('play', updateMusicToggleUI);
  currentMusic.addEventListener('pause', updateMusicToggleUI);
  currentMusic.addEventListener('volumechange', updateMusicToggleUI);
  updateMusicToggleUI();
}

// Patch crossfadeTo to observe new currentMusic
const _origCrossfadeTo = crossfadeTo;
crossfadeTo = function(file, title, duration = 800) {
  _origCrossfadeTo(file, title, duration);
  setTimeout(observeCurrentMusic, 100); // Wait for currentMusic to be set
};

// --- Music Controls ---
function updateMusicToggleUI() {
  if (!audioEl) return;
  musicToggle.textContent = audioEl.paused ? '▶' : '⏸';
  musicMute.textContent = audioEl.muted ? 'Unmute' : 'Mute';
}

if (musicToggle) {
  musicToggle.addEventListener('click', function() {
    if (!audioEl) return;
    if (audioEl.paused) {
      audioEl.play().catch(()=>{});
    } else {
      audioEl.pause();
    }
    updateMusicToggleUI();
  });
}

if (musicMute) {
  musicMute.addEventListener('click', function() {
    if (!audioEl) return;
    audioEl.muted = !audioEl.muted;
    updateMusicToggleUI();
  });
}

// Update UI when music changes
function observeAudioEl() {
  if (!audioEl) return;
  audioEl.addEventListener('play', updateMusicToggleUI);
  audioEl.addEventListener('pause', updateMusicToggleUI);
  audioEl.addEventListener('volumechange', updateMusicToggleUI);
  updateMusicToggleUI();
}



// overlay for flash (must exist or will be created)
let flashEl = document.getElementById('hurt-flash');
if (!flashEl) {
  flashEl = document.createElement('div');
  flashEl.id = 'hurt-flash';
  document.body.appendChild(flashEl);
}
const scenes = {
  // MAIN MENU (boot here if you want a menu on start)
  menuScene: {
    text: "Welcome back, hunter. Neon city hums beneath a bruised sky. What will you do?",
    bg: "./images/end.jpg",
    choices: [
      { text: "Begin Journey", next: "start" },
      { text: "Resume Journey", next: "resumeScene", condition: (p)=> !!localStorage.getItem('huntrix_profile') },
      { text: "Quit", next: "quitScene" }
    ]
  },

  // ACT 1
  start: {
    text: "🌑 The streets are unnervingly quiet. Neon signs flicker, and the sound of distant drums echoes through the alleys. The Huntrix squad disbanded months ago, but tonight… demons crawl again. You stand at the edge of the abandoned subway station, the air thick with sulfur. A shadow stirs below.",
    bg: "./images/intro.jpg",
    music: { file: "music/intro.mp3", title: "Intro Theme" },
    changes: { energy: -5 },
    choices: [
      { text: "Descend into the subway tunnel", next: "subwayScene" },
      { text: "Call your squad for backup", next: "squadScene" }
    ]
  },

  subwayScene: {
    text: "🚇 The tunnel reeks of smoke and old blood. Graffiti glows faintly, written in a language no human should understand. As your footsteps echo, a pair of crimson eyes blink open in the dark.\n\n👹 Demon’s Whisper: *Hunter… we’ve been waiting.*",
    bg: "./images/tunnel.jpg",
    music: { file: "music/demonwhisper.mp3", title: "Whispers in the Dark" },
    changes: { energy: -10 },
    choices: [
      { text: "Draw your blade", next: "firstFight", sfx: 'attack' },
      { text: "Step back and observe", next: "observeScene" }
    ]
  },

  squadScene: {
    dialog: [
      { char: "You", img: "./images/playerPortrait.png", text: "Pressing the comm-link. I need backup — something moved below." },
      { char: "jisoo", img: "./images/jisooPortrait.jpg", text: "Took you long enough. Seoul’s burning, and you’re sightseeing? I’m on my way." },
      { char: "Narrator", text: "She drops from the rooftop above, twin pistols in hand. The air feels lighter—but danger still lurks." }
    ],
    bg: "./images/squad.jpg",
    music: { file: "music/squad.mp3", title: "Squad Reunion" },
    changes: { hp: +5 },
    choices: [
      { text: "Head into the subway with Jisoo", next: "subwayScene" },
      { text: "Ask Jisoo about the demons", next: "jisooTalk" }
    ]
  },

  jisooTalk: {
    dialog: [
      { char: "You", img: "./images/playerPortrait.png", text: "Why are the demons back? We ended this war." },
      { char: "Jisoo", img: "./images/jisooPortrait.jpg", text: "The seal is cracking. And… they’re calling your name, not mine." }
    ],
    bg: "./images/squad.jpg",
    music: { file: "music/mystery.mp3", title: "Whispers of Fate" },
    choices: [
      { text: "Demand answers", next: "subwayScene" },
      { text: "Stay silent and move on", next: "subwayScene" }
    ]
  },

  firstFight: {
    text: "⚔️ The demon lunges, claws like blades. You block with your cursed sword—the steel hums like it’s alive.\n\n👹 Demon: *That weapon isn’t yours. It’s ours.*\n\nYour arms shake as sparks fly in the dark.",
    bg: "./images/fight.jpg",
    music: { file: "music/fight.mp3", title: "First Blood" },
    changes: { hp: -20, energy: -15 },
    choices: [
      { text: "Strike harder", next: "escapeCollapse", sfx: 'attack' },
      { text: "Retreat and regroup", next: "escapeCollapse" }
    ]
  },

  observeScene: {
    text: "👀 You hold your breath, watching. The crimson eyes fade, but the whispers don’t.\n\n👹 Voice: *Not yet. We’ll meet again, child of the blade.*\n\nThe ground rumbles—the tunnel begins to collapse.",
    bg: "./images/shadow.jpg",
    music: { file: "music/rumble.mp3", title: "Collapse" },
    choices: [
      { text: "Escape quickly", next: "escapeCollapse" }
    ]
  },

  // ACT 2
  escapeCollapse: {
    text: "💨 Stone and steel rain down as the tunnels collapse. You barely make it out into the open night, lungs burning. The city is eerily silent… until the cathedral bells toll thirteen. Impossible. Midnight has already passed.",
    bg: "./images/collapse.jpg",
    music: { file: "music/rumble.mp3", title: "Thirteenth Bell" },
    changes: { hp: -10 },
    choices: [
      { text: "Head toward the cathedral", next: "cathedralScene" },
      { text: "Search the streets for survivors", next: "streetsScene" }
    ]
  },

  streetsScene: {
    text: "🚸 The streets are deserted, cars abandoned mid-turn. Neon signs flicker and die. A lone child stands in the middle of the road. Their eyes glow crimson.\n\n👶 Child: *You’re too late. He’s already waking.*",
    bg: "./images/street.jpg",
    music: { file: "music/child.mp3", title: "Harbinger" },
    changes: { energy: -10 },
    choices: [
      { text: "Approach the child", next: "childApproach", condition: (player) => player.energy > 0 },
      { text: "Run toward the cathedral", next: "cathedralScene" },
      {
        text: "Blade hums — follow its hidden whisper",
        next: "bladeWhisper",
        condition: (player) => (player.hp > 20 && player.energy > 15)
      }
    ]
  },

  childApproach: {
    dialog: [
      { char: "You", img: "./images/playerPortrait.png", text: "Hey—who are you? Why are you here?" },
      { char: "Child", img: "./images/childPortrait.jpg", text: "ALL: We are legion. We are the Lord Below." }
    ],
    text: "👶 The child tilts their head. Their voice doubles into a chorus. Their body dissolves into smoke, forming a colossal hand clawing at the sky.",
    bg: "./images/street.jpg",
    music: { file: "music/child.mp3", title: "Legion Rises" },
    changes: { hp: -15 },
    choices: [
      { text: "Fight the hand with your blade", next: "finalFight", sfx: 'attack' },
      { text: "Flee to regroup", next: "cathedralScene" }
    ]
  },

  cathedralScene: {
    text: "⛪ The cathedral stands broken yet defiant, gothic towers clawing at the storm. Inside, rows of shattered pews stretch into darkness. At the altar, fire burns cold blue. Whispers crawl along the walls.",
    bg: "./images/cathedral.jpg",
    music: { file: "music/cathedral.mp3", title: "The Last Church" },
    changes: { energy: -5 },
    choices: [
      { text: "Step toward the altar", next: "altarScene" },
      { text: "Search the side chambers", next: "sideChambers" }
    ]
  },

  altarScene: {
    dialog: [
      { char: "Narrator", text: "As you approach the altar, the blade trembles violently. A voice emerges—not the demon’s, but your father’s." },
      { char: "Father's Voice", img: "./images/fatherPortrait.jpg", text: "My child… this weapon is a curse. Destroy it before it destroys you." },
      { char: "You", img: "./images/playerPortrait.png", text: "You: It can’t be... you’re gone." }
    ],
    text: "🔥 As you approach the altar, the blade trembles violently. A voice emerges—not the demon’s, but your father’s.",
    bg: "./images/altar.jpg",
    music: { file: "music/altar.mp3", title: "Ghost at the Altar" },
    choices: [
      { text: "Answer the voice", next: "altarDialog" },
      { text: "Ignore it and touch the altar", next: "altarTouch" }
    ]
  },

  altarDialog: {
    dialog: [
      { char: "You", img: "./images/playerPortrait.png", text: "You’re not real. My father is gone." },
      { char: "Voice", img: "./images/fatherPortrait.jpg", text: "Then why do you still hear his screams when the demons took him?" }
    ],
    text: "💬 You: *You’re not real. My father is gone.*\n\nThe fire flickers. The voice sharpens.",
    bg: "./images/altar.jpg",
    music: { file: "music/altar.mp3", title: "Echoes" },
    choices: [
      { text: "Fight the hallucination", next: "hallucinationFight", sfx: 'attack' },
      { text: "Clutch the blade tighter", next: "bladeBond" }
    ]
  },

  altarTouch: {
    dialog: [
      { char: "You", img: "./images/playerPortrait.png", text: "The metal is warm... too warm." },
      { char: "Voice", img: "./images/fatherPortrait.jpg", text: "So close. Will you let it own you?" }
    ],
    text: "When you touch the altar the world bends, and a vision claws at the edge of reality.",
    bg: "./images/altar.jpg",
    music: { file: "music/altar.mp3", title: "Temptation" },
    changes: { energy: -8 },
    choices: [
      { text: "Fight the hallucination", next: "hallucinationFight", sfx: 'attack' },
      { text: "Clutch the blade tighter", next: "bladeBond" }
    ]
  },

  halluncinationFight: { // typo-safe fallback (unused) — kept minimal
    text: "The vision flares and fades — nothing resolved.",
    choices: [
      { text: "Regain composure", next: "altarScene" }
    ]
  },

  // fixed spelling version:
  hallucinationFight: {
    text: "Illusion and memory collide. You battle a shape that knows your every fear.",
    bg: "./images/hallucination.jpg",
    music: { file: "music/fight.mp3", title: "Mind's Battle" },
    changes: { hp: -15, energy: -10 },
    choices: [
      { text: "Hold the blade steady", next: "bladeBond" },
      { text: "Break the vision and run", next: "cathedralScene" }
    ]
  },

  bladeBond: {
    dialog: [
      { char: "Narrator", img: null, text: "You feel the blade's hunger and, for a heartbeat, it answers." },
      { char: "You", img: "./images/playerPortrait.png", text: "I won't let it control me — not yet." }
    ],
    text: "The bond deepens. The blade sings under your skin; a hidden path opens.",
    bg: "./images/blade_bond.jpg",
    music: { file: "music/fusion_theme.mp3", title: "Bond" },
    changes: { energy: +5 },
    choices: [
      { text: "Follow the hidden call", next: "bladeWhisper" },
      { text: "Seek the hunters' counsel", next: "leaderMeeting" }
    ]
  },

  sideChambers: {
    text: "🕯️ The side chambers are littered with warped relics: silver crosses twisted into claws, holy books that bleed when opened. A mural glows faintly—it shows a hunter, blade raised against an army. The hunter looks exactly like you.",
    bg: "./images/mural.jpg",
    music: { file: "music/prophecy.mp3", title: "Prophecy" },
    choices: [
      { text: "Study the prophecy closely", next: "prophecyScene" },
      { text: "Destroy the mural", next: "destroyProphecy" }
    ]
  },

  prophecyScene: {
    dialog: [
      { char: "You", img: "./images/playerPortrait.png", text: "Who's the hunter in the mural?" },
      { char: "Jisoo", img: "./images/jisooPortrait.jpg", text: "That’s you. It always was. Don’t you get it? You’re not just in this fight—you *are* the fight." }
    ],
    text: "🖼️ The mural’s eyes glow red. Jisoo’s voice breaks the silence.",
    bg: "./images/mural_red.jpg",
    music: { file: "music/prophecy.mp3", title: "Revelation" },
    choices: [
      { text: "Ask Jisoo what she knows", next: "truthJisoo" },
      { text: "Deny the prophecy", next: "denyScene" }
    ]
  },

  destroyProphecy: {
    text: "You tear the mural from the wall; the eyes flare and then go cold. Pain lances through your arm — a warning.",
    bg: "./images/mural_destroy.jpg",
    music: { file: "music/rumble.mp3", title: "Omen" },
    changes: { hp: -5 },
    choices: [
      { text: "Regroup at the altar", next: "altarScene" },
      { text: "Search the sanctum", next: "exploreSanctum" }
    ]
  },

  denyScene: {
    dialog: [
      { char: "You", img: "./images/playerPortrait.png", text: "This is lies and paint. I won't be its puppet." },
      { char: "Jisoo", img: "./images/jisooPortrait.jpg", text: "Fine. But choice cuts both ways." }
    ],
    text: "You deny the mural's claim. The world keeps turning, but the blade keeps whispering.",
    bg: "./images/chamber.jpg",
    music: { file: "music/mystery.mp3", title: "Deny" },
    choices: [
      { text: "Return to the cathedral", next: "cathedralScene" },
      { text: "Follow the blade's whisper", next: "bladeWhisper" }
    ]
  },

  truthJisoo: {
    dialog: [
      { char: "Jisoo", img: "./images/jisooPortrait.jpg", text: "The blade isn’t just a lock—it’s a prison. You’re the key, MC. That’s why the demons whisper your name." },
      { char: "You", img: "./images/playerPortrait.png", text: "If I'm the key, what choice do I have?" }
    ],
    text: "🎤 Jisoo lowers her pistols, her expression heavy.",
    bg: "./images/chamber.jpg",
    music: { file: "music/truth.mp3", title: "Truth Unveiled" },
    choices: [
      { text: "Accept the truth", next: "acceptScene" },
      { text: "Reject it violently", next: "rejectScene", sfx:'attack' }
    ]
  },

  acceptScene: {
    text: "You lower your blade. Acceptance feels heavier than battle. The prophecy is real. And it is you.",
    bg: "./images/chamber.jpg",
    music: { file: "music/accept.mp3", title: "Resolve" },
    changes: { energy: -5 },
    choices: [
      { text: "Train with the hunters", next: "prepareWithHunters" },
      { text: "Follow the hidden whisper", next: "bladeWhisper" }
    ]
  },

  rejectScene: {
    text: "You roar, denying fate itself. The mural cracks. Shadows pour out, twisting around you — your rejection summons the enemy faster.",
    bg: "./images/chamber.jpg",
    music: { file: "music/reject.mp3", title: "Rebellion" },
    changes: { hp: -10, energy: -5 },
    choices: [
      { text: "Fight your way forward", next: "finalFight", sfx: "attack" },
      { text: "Slip away to regroup", next: "cathedralScene" }
    ]
  },

  // ACT 3
  finalFight: {
    dialog: [
      { char: "Narrator", img: null, text: "You slash through the colossal hand, black smoke spilling across the skyline. Laughter echoes." },
      { char: "Voice from Below", img: "./images/fatherPortrait.jpg", text: "Key, open. Key, choose." }
    ],
    text: "🔥 You slash through the colossal hand, black smoke spilling across the skyline. But laughter doesn’t stop. The cathedral bell tolls one last time.",
    bg: "./images/lord.jpg",
    music: { file: "music/lord.mp3", title: "The Lord Below" },
    changes: { energy: -30 },
    choices: [
      { text: "Stand and fight", next: "finalStand", sfx: 'attack' },
      { text: "Offer yourself as sacrifice", next: "sacrificeScene" }
    ]
  },

  finalStand: {
    text: "⚔️ Your blade hums louder than ever, light pouring from its cracks. You scream, charging into the abyss itself. Demons swarm, claws tearing at your flesh. But for the first time, the Lord Below takes a step back. The fight for Seoul begins.",
    bg: "./images/lord.jpg",
    music: { file: "music/finalStand.mp3", title: "Final Stand" },
    changes: { hp: -30, energy: -10 },
    choices: [
      { text: "✨ To be continued…", next: "endScene" }
    ]
  },

  sacrificeScene: {
    type: "narration",
    text: "You press the blade into your own chest. Power surges, fire floods your veins. The demon horde collapses with your final scream. \n\nThe city is saved, but your story ends here — sung in whispers and tears.",
    end: true,
    choices: [
      { text: "Accept your fate", next: "credits" }
    ]
  },

  // === HIDDEN QUEST: bladeWhisper -> secretGate -> sanctum -> abyss (Acts IV-V) ===
  bladeWhisper: {
    dialog: [
      { char: "Narrator", img: null, text: "The blade hums, pulling you toward a side alley invisible in the rain. Neon bends around it; whispers coil like smoke." },
      { char: "Jisoo", img: "./images/jisooPortrait.jpg", text: "I don’t like this, but I don’t leave friends behind." },
      { char: "You", img: "./images/playerPortrait.png", text: "Then we go. Quietly." }
    ], 
    text: "The blade hums, pulling you toward a side alley invisible in the rain.",
    bg: "./images/hidden_alley.jpg",
    music: { file: "music/whisper_hidden.mp3", title: "Hidden Path" },
    changes: { energy: -5 },
    choices: [
      { text: "Follow the blade into the alley", next: "secretGate", condition: (p)=> p.energy > 10 },
      { text: "Ignore it and go to the cathedral", next: "cathedralScene" }
    ]
  },

  secretGate: {
    dialog: [
      { char: "Narrator", img: null, text: "A door hums in shadow, carved with symbols you almost recognize." },
      { char: "Blade (whisper)", img: "./images/bladePortrait.jpg", text: "\"Pass if you are worthy. Fail if you hesitate.\"" },
      { char: "You", img: "./images/playerPortrait.png", text: "Worth is a moving target. I’ll pass." }
    ],
    text: "A door hums in shadow, carved with symbols you almost recognize.",
    bg: "./images/secret_gate.jpg",
    music: { file: "music/secret_gate.mp3", title: "Threshold" },
    onEnter: (st) => { st.hiddenQuestUnlocked = true; },
    choices: [
      { text: "Touch the gate with your blade", next: "gateOpen", sfx:'attack' },
      { text: "Step back — it feels dangerous", next: "gateFade" }
    ]
  },

  gateFade: {
    text: "You hesitate. The whispers fall silent. The gate fades like mist — never to return.",
    bg: "./images/gate_fade.jpg",
    music: { file: "music/fade.mp3", title: "Faded Path" },
    onEnter: (st) => { st.hiddenQuestUnlocked = false; },
    choices: [
      { text: "Return to the cathedral", next: "cathedralScene" }
    ]
  },

  gateOpen: {
    dialog: [
      { char: "Narrator", img: null, text: "The gate folds into shadow, revealing a spiraling staircase descending into darkness." },
      { char: "You", img: "./images/playerPortrait.png", text: "Down we go." }
    ],
    text: "The gate folds into shadow, revealing a spiraling staircase descending into darkness.",
    bg: "./images/spiral_stairs.jpg",
    music: { file: "music/descent.mp3", title: "Into Darkness" },
    changes: { energy: -10 },
    choices: [
      { text: "Descend the staircase", next: "undergroundSanctum" },
      { text: "Return to the streets above", next: "streetsScene" }
    ]
  },

  undergroundSanctum: {
    text: "Torches flare to life as you descend. Figures in cloaks bow as you pass — the hunters of old, waiting for the keybearer. Their eyes gleam under hoods: respect, fear, expectation.",
    dialog: [
      { char: "Leader", img: "./images/kaelPortrait.jpg", text: "We knew a key would wake. The Lord Below stirs. Will you carry this burden or break the chain?" },
      { char: "You", img: "./images/playerPortrait.png", text: "If the world hangs on this, I’ll hang with it." }
    ],
    bg: "./images/sanctum.jpg",
    music: { file: "music/ancient_hall.mp3", title: "Sanctum" },
    choices: [
      { text: "Speak to the leader of the hunters", next: "leaderMeeting" },
      { text: "Explore the sanctum silently", next: "exploreSanctum" }
    ]
  },

  leaderMeeting: {
    dialog: [
      { char: "Leader", img: "./images/kaelPortrait.jpg", text: "The lock above stirs. You alone decide: confront the gate directly, or wield the hidden key with precision." },
      { char: "You", img: "./images/playerPortrait.png", text: "I’ll take the key. I’ll finish this." }
    ],
    text: "The leader offers counsel and tools — a choice between raw sacrifice or cunning.",
    bg: "./images/sanctum.jpg",
    music: { file: "music/ancient_hall.mp3", title: "Council" },
    choices: [
      { text: "Take the hidden key and descend to the gate", next: "abyssGate" },
      { text: "Prepare with hunters first", next: "prepareWithHunters" }
    ]
  },

  exploreSanctum: {
    text: "Ancient weapons, runed scrolls, and echoes of long-dead battles fill the room. A pedestal holds a sealed box; your blade reacts violently. Whatever is inside wants you to touch it.",
    bg: "./images/pedestal.jpg",
    music: { file: "music/mystic_loop.mp3", title: "Mystic Echoes" },
    choices: [
      { text: "Open the box", next: "hiddenArtifact" },
      { text: "Leave it — focus on the main mission", next: "leaderMeeting" }
    ]
  },

  hiddenArtifact: {
    dialog: [
      { char: "Narrator", img: null, text: "Inside the box, a shard of light hums — the other half of your blade." },
      { char: "You", img: "./images/playerPortrait.png", text: "This... completes it?" }
    ],
    text: "Inside the box, a shard of light hums — the other half of your blade.",
    bg: "./images/shard_blade.jpg",
    music: { file: "music/artifact_power.mp3", title: "Shard of Power" },
    changes: { energy: +15, hp: +10 },
    choices: [
      { text: "Fuse the shard with your blade", next: "bladeFusion" },
      { text: "Keep it separate — avoid temptation", next: "leaderMeeting" }
    ]
  },

  bladeFusion: {
    dialog: [
      { char: "Narrator", text: "The shards merge with a scream of steel and light. Your blade is now whole — sharper, alive, singing of destiny and war." },
      { char: "Jisoo", img: "./images/jisooPortrait.jpg", text: "Nice upgrade. Don’t let it go to your head." }
    ],
    text: "The shards merge with a scream of steel and light. Your blade is now whole.",
    bg: "./images/blade_fusion.jpg",
    music: { file: "music/fusion_theme.mp3", title: "Awakened Blade" },
    changes: { energy: +10 },
    choices: [
      { text: "Descend to confront the Lord Below", next: "abyssGate" },
      { text: "Train briefly with the hunters", next: "prepareWithHunters" }
    ]
  },

  prepareWithHunters: {
    text: "The hunters teach swift strikes, silent movement, and how to anticipate demons. You grow stronger, more precise. The blade hums in approval.",
    bg: "./images/training.jpg",
    music: { file: "music/training_loop.mp3", title: "Preparation" },
    changes: { hp: +15, energy: +10 },
    choices: [
      { text: "Now descend to the abyss gate", next: "abyssGate" }
    ]
  },

  abyssGate: {
    dialog: [
      { char: "Narrator", img: null, text: "The Lord Below awaits. The gate pulses, alive, whispering all your failures and fears." },
      { char: "Kael", img: "./images/kaelPortrait.jpg", text: "This is the choice: lock it or let it through." }
    ],
    text: "The Lord Below awaits. The gate pulses, alive, whispering all your failures and fears.",
    bg: "./images/abyss_gate.jpg",
    music: { file: "music/final_theme.mp3", title: "Final Confrontation" },
    choices: [
      { text: "Strike the Lord Below with the awakened blade", next: "finalBattleBlade", sfx: 'attack' },
      { text: "Invoke the sanctum’s hidden power", next: "finalBattleSanctum" }
    ]
  },

  finalBattleBlade: {
    text: "Steel and light clash. The Lord Below roars. Shadows tear, fire arcs, but your blade sings true. With one final strike, the gate shudders and collapses. Silence falls; neon above flickers peacefully.",
    bg: "./images/final_battle.jpg",
    music: { file: "music/victory.mp3", title: "Victory" },
    changes: { hp: -20, energy: -20 },
    choices: [
      { text: "End scene — the city breathes again", next: "endScene" }
    ]
  },

  finalBattleSanctum: {
    text: "Channelling the sanctum's hidden power, waves of energy clash with the Lord Below. Reality bends. The gate shatters from the inside; your body feels the cost.",
    bg: "./images/battle_sanctum.jpg",
    music: { file: "music/victory.mp3", title: "Victory" },
    changes: { hp: -15, energy: -25 },
    choices: [
      { text: "End scene — a new dawn over neon Seoul", next: "endScene" }
    ]
  },

  hiddenEnd: {
    type: "narration",
    text: "The blade fuses to your soul, no longer weapon, but voice. You step through the Abyss Gate, into a realm beyond mortal fire.\n\nWhispers crown you. You are no longer hunter — you are the thing even demons fear.",
    end: true,
    choices: [
      { text: "Embrace the Abyss", next: "credits" }
    ]
  },

  endScene: {
    dialog: [
      { char: "Narrator", img: null, text: "🌅 Dawn breaks. Rain-slicked streets shine with neon reflection. The city exhales. You, Jisoo, and the hunters watch from rooftops." },
      { char: "Jisoo", img: "./images/jisooPortrait.jpg", text: "We did it. For now." },
      { char: "You", img: "./images/playerPortrait.png", text: "For now." }
    ],
    text: "🌅 Dawn breaks. Rain-slicked streets shine with neon reflection.",
    bg: "./images/end.jpg",
    music: { file: "music/end.mp3", title: "New Dawn" },
    end: true,
    onEnter: (st) => {
      if (st && st.hiddenQuestUnlocked) {
        // append flavor text if hidden route was completed
        scenes.endScene.text += "\n\nBut a whisper lingers, curling at the edges of your mind...";
      }
    },
    choices: [
      { text: "Rest… at last.", next: "credits" }
    ]
  },

  credits: {
    type: "narration",
    text: "Huntrix: Shadows of the Fallen\n\n— Thank you for playing —",
    choices: [
      { text: "Return to Menu", next: "menuScene" }
    ]
  },

  resumeScene: {
    text: "Resuming saved journey...",
    onEnter: () => {
      // resume logic: read profile and jump to last saved scene (fallback to start)
      try {
        const profile = JSON.parse(localStorage.getItem('huntrix_profile') || '{}');
        const last = profile.lastScene || 'start';
        // small safety: only jump if scene exists
        if (last && scenes[last]) showScene(last);
        else showScene('start');
      } catch (e) {
        showScene('start');
      }
    },
    choices: []
  },

  menuResumeFallback: { // fallback node if resume fails
    text: "Resume failed — starting new journey.",
    choices: [ { text: "Begin Journey", next: "start" } ]
  },

  menuSceneSecret: { // optional easter egg/credits link
    text: "A small plaque reads: 'Those who listen will be heard.'",
    choices: [ { text: "Return", next: "menuScene" } ]
  },

  quitScene: {
    type: "narration",
    text: "The hunt waits for no one… but you close your eyes, for now.",
    choices: [  ]
  }
};

// Helper: load character from localStorage
function loadCharacter() {
  try {
    const sel = JSON.parse(localStorage.getItem('selectedCharacter') || 'null');
    if (!sel) { hudImg.src = 'images/default.png'; hudName.textContent = 'Stranger'; return; }
    hudImg.src = sel.image || 'images/default.png';
    hudName.textContent = sel.name || 'Huntrix';
  } catch (e) { console.warn('loadCharacter err', e); }
}

// ---------- Preload helpers ----------
function preloadImage(url) {
  return new Promise((res) => {
    if (!url) return res();
    const i = new Image();
    i.onload = () => res();
    i.onerror = () => res();
    i.src = url;
  });
}

function fetchArrayBuffer(url) {
  return fetch(url).then(r => {
    if (!r.ok) throw new Error('fetch failed: ' + url);
    return r.arrayBuffer();
  });
}

async function decodeSfxBuffers() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const keys = Object.keys(sfxFiles);
  const promises = keys.map(async (k) => {
    try {
      const buf = await fetchArrayBuffer(sfxFiles[k]);
      const decoded = await audioCtx.decodeAudioData(buf.slice(0));
      sfxBuffers[k] = decoded;
    } catch (e) {
      console.warn('Failed loading sfx', sfxFiles[k], e);
    }
  });
  await Promise.all(promises);
}

async function preloadMusicAndImages() {
  // collect music and image paths from scenes
  const musicSet = new Set();
  const images = new Set();
  for (const k in scenes) {
    const sc = scenes[k];
    if (sc.music && sc.music.file) musicSet.add(sc.music.file);
    if (sc.bg) images.add(sc.bg);
    if (Array.isArray(sc.dialog)) {
      sc.dialog.forEach(d => { if (d && d.img) images.add(d.img); });
    }
  }
  // preload images
  await Promise.all(Array.from(images).map(preloadImage));
  // we don't fully fetch music here (it streams), but we can prefetch the HEAD to warm cache,
  // and optionally create HTMLAudioElements to prime them (lightweight).
  Array.from(musicSet).forEach(path => {
    const a = new Audio();
    a.preload = 'metadata';
    a.src = path;
    // no play to avoid autoplay block — just let browser warm up
  });
}

// ---------- Web Audio SFX play ----------
function playBuffer(buffer, { volume = 1, pan = 0, playbackRate = 1 } = {}) {
  if (!audioCtx || !buffer) return;
  try {
    const src = audioCtx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = playbackRate;

    const gain = audioCtx.createGain();
    gain.gain.value = volume;

    // optional stereo pan node (not supported on all browsers)
    let node = gain;
    if (audioCtx.createStereoPanner) {
      const panNode = audioCtx.createStereoPanner();
      panNode.pan.value = pan;
      src.connect(gain);
      gain.connect(panNode);
      panNode.connect(audioCtx.destination);
    } else {
      src.connect(gain);
      gain.connect(audioCtx.destination);
    }

    src.connect(gain);
    src.start(0);
  } catch (e) { /* ignore play errors */ }
}

function playSfx(name, opts = {}) {
  if (!sfxBuffers[name]) return;
  playBuffer(sfxBuffers[name], opts);
}

// ---------- Music crossfade ----------
let currentMusic = null;
let currentFadeVol = 1;

function crossfadeTo(file, title, duration = 800) {
  // If same file, ignore
  if (currentMusic && currentMusic.src && currentMusic.src.includes(file)) {
    // still update title
    musicTitle.textContent = title || '';
    return;
  }
  // Prepare next audio
  const next = new Audio(file);
  next.loop = true;
  next.volume = 0;
  next.preload = 'auto';
  next.play().catch(()=>{}); // start playback (may be blocked until user gesture)
  // fade out currentMusic while fading in next
  const start = performance.now();
  const from = currentMusic ? currentMusic.volume : 0;
  const to = 1;
  // ensure next plays even if currentMusic null
  next.volume = 0;

  // simple linear fade using rAF
  function clamp(val, min, max) { return Math.max(min, Math.min(max, val)); }
  function tick(now) {
    const t = Math.min(1, (now - start) / duration);
    if (currentMusic) currentMusic.volume = clamp((1 - t) * from, 0, 1);
    next.volume = clamp(t * to, 0, 1);
    if (t < 1) requestAnimationFrame(tick);
    else {
      if (currentMusic) { try{ currentMusic.pause(); currentMusic.src = ''; }catch(e){} }
      currentMusic = next;
      musicTitle.textContent = title || '';
      observeCurrentMusic();
    }
  }
  requestAnimationFrame(tick);
}

// fallback simple setMusic for when crossfade undesired
function setMusicSimple(file, title) {
  if (audioEl) { audioEl.pause(); audioEl.src = ''; audioEl = null; }
  if (!file) { musicTitle.textContent = 'None'; musicToggle.textContent = '▶'; return; }
  audioEl = new Audio(file);
  audioEl.loop = true;
  audioEl.volume = 0.55;
  audioEl.play().catch(()=>{});
  musicTitle.textContent = title || '';
  musicToggle.textContent = '⏸';
}

// Choose crossfade by default (works with most browsers)
function setMusic(file, title) {
  if (!file) {
    if (currentMusic) { try{ currentMusic.pause(); }catch(e){} }
    currentMusic = null;
    musicTitle.textContent = 'None';
    musicToggle.textContent = '▶';
    return;
  }
  crossfadeTo(file, title, 900);
  musicToggle.textContent = '⏸';
}


// ---------- Visual feedback: screen-shake + hurt flash ----------
function doScreenShake(duration = 400, intensity = 6) {
  // add class to gameArea to trigger CSS keyframes
  gameArea.classList.add('shake');
  // set CSS variable intensity if you want to control magnitude
  gameArea.style.setProperty('--shake-int', intensity + 'px');
  setTimeout(() => {
    gameArea.classList.remove('shake');
    gameArea.style.removeProperty('--shake-int');
  }, duration);
}

function doHurtFlash(duration = 250) {
  flashEl.classList.add('flash-on');
  setTimeout(() => flashEl.classList.remove('flash-on'), duration);
}

// ---------- Auto-save & profile ----------
function saveProfile(sceneKey) {
  const profile = JSON.parse(localStorage.getItem('huntrix_profile') || '{}');
  profile.lastScene = sceneKey || null;
  profile.lastHP = player.hp;
  profile.lastEnergy = player.energy;
  profile.timestamp = new Date().toISOString();
  // ensure endings array exists
  profile.endings = profile.endings || [];
  // increment replays maybe done elsewhere
  localStorage.setItem('huntrix_profile', JSON.stringify(profile));
}

function recordEnding(sceneKey) {
  const profile = JSON.parse(localStorage.getItem('huntrix_profile') || '{}');
  profile.endings = profile.endings || [];
  if (sceneKey && !profile.endings.includes(sceneKey)) profile.endings.push(sceneKey);
  profile.lastHP = player.hp;
  profile.lastEnergy = player.energy;
  profile.timestamp = new Date().toISOString();
  localStorage.setItem('huntrix_profile', JSON.stringify(profile));
}

// Optional quick "save checkpoint" button you can wire to UI
window.saveCheckpoint = function(sceneKey) { saveProfile(sceneKey); };

// ---------- HUD / choices / dialog (core logic) ----------
function updateHUD() {
  hpBar.style.width = Math.max(0, Math.min(100, player.hp)) + '%';
  enBar.style.width = Math.max(0, Math.min(100, player.energy)) + '%';
}

function renderChoices(scene) {
  choicesEl.innerHTML = '';
  if (scene.end) {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.className = 'choice-anim';
    btn.innerText = '🔄 Replay';
    btn.onclick = () => {
      // increment replays counter
      const p = JSON.parse(localStorage.getItem('huntrix_profile') || '{}');
      p.replays = (p.replays || 0) + 1;
      localStorage.setItem('huntrix_profile', JSON.stringify(p));
      startGame();
    };
    li.appendChild(btn);
    // add "view profile" button
    const li2 = document.createElement('li');
    const btn2 = document.createElement('button');
    btn2.innerText = '🏠 Profile';
    btn2.onclick = () => { window.location.href = 'profile.html'; };
    li2.appendChild(btn2);
    choicesEl.appendChild(li);
    choicesEl.appendChild(li2);
    return;
  }

  const list = (scene.choices || []).filter(c => {
    if (!c) return false;
    if (!c.condition) return true;
    try { return !!c.condition(player); } catch (e) { return false; }
  });

  if (list.length === 0) {
    choicesEl.innerHTML = '<div class="no-choices">No available choices — restart? <button onclick="startGame()">Restart</button></div>';
    return;
  }

  list.forEach((c, i) => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.className = 'choice-anim';
    btn.innerText = c.text || `Choice ${i + 1}`;
    btn.onclick = () => {
      // SFX mapping: choices can set c.sfx (string key) to trigger sound
      if (c.sfx) { playSfx(c.sfx, { volume: 1, pan: 0 }); doScreenShake(220, 4); }
      if (typeof c.onChoose === 'function') c.onChoose(player);
      showScene(c.next);
    };
    li.appendChild(btn);
    choicesEl.appendChild(li);
  });
}

// Dialog system (same as before but also triggers small SFX when dialog line contains "!" or attack)
let dialogIndex = 0; let dialogScene = null;
function playDialog(scene) {
  dialogScene = scene; dialogIndex = 0; dialogWrap.classList.remove('dialog-hidden'); renderDialogLine();
}
function getPlayerData() {
  try {
    const sel = JSON.parse(localStorage.getItem('selectedCharacter') || 'null'); // older pattern you used
    const alt = JSON.parse(localStorage.getItem('huntrix_character') || 'null'); // optional helper key
    const prof = JSON.parse(localStorage.getItem('huntrix_profile') || '{}'); // store meta here sometimes

    const name = (sel && sel.name) || (alt && alt.name) || prof.charName || prof.char || 'You';
    const img  = (sel && sel.image) || (alt && alt.img) || prof.charPortrait || prof.charImg || './images/playerPortrait.png';

    return { name, img };
  } catch (e) {
    console.warn('getPlayerData parse err', e);
    return { name: 'You', img: './images/playerPortrait.png' };
  }
}

function getPlayerName() { return getPlayerData().name; }
function getPlayerPortrait() { return getPlayerData().img; }

/* ---------------------
   HUD loader (use at boot)
   --------------------- */
function loadCharacter() {
  const p = getPlayerData();
  if (hudImg) hudImg.src = p.img || 'images/default.png';
  if (hudName) hudName.textContent = p.name || 'Huntrix';
}

/* ---------------------
   Dialog renderer (dynamic char/img support)
   --------------------- */
function renderDialogLine() {
  const line = dialogScene.dialog[dialogIndex];
  if (!line) {
    dialogNext.style.display = 'none';
    dialogWrap.classList.add('dialog-hidden');
    storyEl.textContent = dialogScene.text || '';
    renderChoices(dialogScene);
    // Save checkpoint on finishing dialog scene
    saveProfile(findSceneKey(dialogScene));
    return;
  } else {
    dialogNext.style.display = '';
  }

  // char may be a string (e.g. "You" or "Jisoo") or a function that returns a string
  let charVal = line.char;
  if (typeof charVal === 'function') {
    try { charVal = charVal(); } catch (e) { charVal = String(charVal); }
  }

  // img may be a string path or a function returning a path
  let imgVal = line.img;
  if (typeof imgVal === 'function') {
    try { imgVal = imgVal(); } catch (e) { imgVal = null; }
  }

  // If char is exactly "You" (or missing), substitute player's name
  if (!charVal || String(charVal).toLowerCase() === 'you') {
    charVal = getPlayerName();
  }

  // If img is missing or explicitly the generic player image, use the player's selected portrait
  const genericPlayerPaths = new Set(['./images/playerPortrait.png', 'images/playerPortrait.png', './images/player.png', 'playerPortrait.png', null, undefined, '']);
  if (genericPlayerPaths.has(imgVal)) {
    imgVal = getPlayerPortrait();
  }

  // Hide portrait if no dialog, or if speaker is 'Narrator'
  if (!imgVal || (charVal && String(charVal).toLowerCase() === 'narrator')) {
    dialogImg.src = '';
    dialogImg.style.display = 'none';
  } else {
    dialogImg.src = imgVal;
    dialogImg.style.display = 'block';
  }

  dialogChar.textContent = charVal || '';
  dialogText.textContent = line.text || '';

  // small emphasis audio if line contains punctuation or weapon icons
  if (/(⚔️|!)/.test(line.text || '')) playSfx('impact', { volume: 0.9, pan: 0 });

  dialogNext.onclick = () => {
    dialogIndex++;
    renderDialogLine();
  };
}
function hideDialog() {
  dialogWrap.classList.add('dialog-hidden');
  dialogImg.src = '';
  dialogImg.style.display = 'none';
  dialogChar.textContent = '';
  dialogText.textContent = '';
  dialogNext.onclick = null;
  dialogNext.style.display = 'none';
}

function findSceneKey(obj) {
  for (const k in scenes) if (scenes[k] === obj) return k;
  return null;
}
function tryResumeFromProfile() {
  const resumeKey = localStorage.getItem('huntrix_resume_scene');
  if (!resumeKey) return false;
  const profile = JSON.parse(localStorage.getItem('huntrix_profile') || '{}');
  localStorage.removeItem('huntrix_resume_scene');

  if (scenes && scenes[resumeKey]) {
    player.hp = typeof profile.lastHP === 'number' ? profile.lastHP : player.hp;
    player.energy = typeof profile.lastEnergy === 'number' ? profile.lastEnergy : player.energy;
    updateHUD();
    showScene(resumeKey);
    showToast(`Resumed: ${prettifySceneKey ? prettifySceneKey(resumeKey) : resumeKey}`, 'success', 1600);
    return true;
  } else {
    showToast('Resume failed — save not found. Starting new game.', 'error', 1800);
    console.warn('Resume failed — scene not found:', resumeKey);
    return false;
  }
}


// ---------- Show Scene (main) ----------
function showScene(key) {
  const scene = scenes[key];
  if (!scene) { console.error('scene missing', key); return; }
  

  // apply immediate stat changes
  if (scene.changes) {
    if ('hp' in scene.changes) {
      const delta = scene.changes.hp;
      const old = player.hp;
      player.hp = Math.max(0, player.hp + delta);
      // if hurt, play hurt SFX + visual
      if (delta < 0) {
        // layered hurt: small swing + impact
        playSfx('hurt', { volume: 1 });
        doHurtFlash(260);
        doScreenShake(260, 6);
      }
      lastHP = player.hp;
    }
    if ('energy' in scene.changes) {
      player.energy = Math.max(0, player.energy + scene.changes.energy);
    }
  }

  // Don't redirect to sacrificeScene if in an ending scene
  const endingScenes = ['sacrificeScene', 'credits', 'hiddenEnd', 'endScene'];
  if ((player.hp <= 0 || player.energy <= 0) && !endingScenes.includes(key)) {
    return showScene('sacrificeScene');
  }

  // set background
  document.getElementById('game-area').style.backgroundImage = scene.bg ? `url('${scene.bg}')` : '';

  // music: prefer crossfade version
  if (scene.music && scene.music.file) setMusic(scene.music.file, scene.music.title || '');
  else setMusic(null, '');

  // dialog vs text
  if (Array.isArray(scene.dialog) && scene.dialog.length) playDialog(scene);
  else { hideDialog(); storyEl.textContent = scene.text || ''; renderChoices(scene); }
const profile = JSON.parse(localStorage.getItem("huntrix_profile") || "{}");


  updateHUD();

  // auto-save checkpoint for scene
  saveProfile(key);

  // If this scene is an ending, record it
  if (scene.end) recordEnding(key);
}
// Quit button handler (safe to paste even if showToast doesn't exist)
(function(){
  // create handler function
  (function(){
  function triggerQuit() {
    const ok = confirm("Are you sure you want to quit? Progress will be saved.");
    if (!ok) return;

    try {
      // optional save to profile
      const currentKey = findSceneKey ? findSceneKey(currentSceneObj || {}) : null;
      const prof = JSON.parse(localStorage.getItem('huntrix_profile') || '{}');
      prof.lastScene = currentKey || prof.lastScene || 'start';
      prof.lastHP = player.hp; 
      prof.lastEnergy = player.energy; 
      prof.timestamp = new Date().toISOString();
      localStorage.setItem('huntrix_profile', JSON.stringify(prof));
    } catch(e){}

    // send player to profile.html
    window.location.href = "profile.html";
  }

  window.triggerQuit = triggerQuit;
})();
// At the start of game.js
const resumeScene = localStorage.getItem('huntrix_resume_scene');
if (resumeScene) {
  showScene(resumeScene);
  localStorage.removeItem('huntrix_resume_scene'); // clear after using
} else {
  showScene('start'); // fallback
}

  // attach to DOM when available
  function wireQuitButton(){
    const btn = document.getElementById('quit-btn');
    if (!btn) return;
    btn.addEventListener('click', triggerQuit, false);
  }

  // attempt to wire now, or after DOMContentLoaded
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wireQuitButton);
  else wireQuitButton();

  // keyboard shortcut: press Esc to quit (with confirm)
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      // avoid interfering with typing fields
      const tag = document.activeElement && document.activeElement.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      triggerQuit();
    }
  });
})();

// ---------- Boot / user gesture handling ----------
function initAudioContextIfNeeded() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
}

async function boot() {
  // allow audio context unlock on user gesture by binding a short click handler
  function unlock() {
    try { initAudioContextIfNeeded(); if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume(); } catch (e) {}
    // preload sfx & images
    decodeSfxBuffers().catch(()=>{});
    preloadMusicAndImages().catch(()=>{});
    window.removeEventListener('click', unlock);
    window.removeEventListener('keydown', unlock);
  }
  window.addEventListener('click', unlock);
  window.addEventListener('keydown', unlock);
  // Attempt to create audio context silently (may still be suspended)
  initAudioContextIfNeeded();
  // Preload anyway (will decode once unlocked)
  try { await Promise.all([decodeSfxBuffers(), preloadMusicAndImages()]); } catch(e) { /* okay */ }
}

// ---------- Keyboard convenience ----------
window.addEventListener('keydown', (e) => {
  if (e.key === ' ' || e.key === 'Enter') {
    if (!dialogWrap.classList.contains('dialog-hidden')) dialogNext.click();
  }
});

// ---------- Public functions ----------
window.startGame = function() { player.hp = 100; player.energy = 100; updateHUD(); showScene('start'); };

// ---------- Small utility: findSceneKey for saveProfile use ----------
function findSceneKey(obj) {
  for (const k in scenes) if (scenes[k] === obj) return k;
  return null;
}

// ---------- Init ----------
loadCharacter();
boot().catch(()=>{}).then(()=>{
  // try resume token first (existing tryResumeFromProfile if you added earlier)
  const resumed = tryResumeFromProfile ? tryResumeFromProfile() : false;
  if (!resumed) {
    // show the menu at startup (gives users Resume / Start choices)
    
  }
});
 
  showScene('menuScene');