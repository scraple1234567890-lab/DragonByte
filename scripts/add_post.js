#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const DATA_PATH = path.join(__dirname, "..", "data", "posts.json");
const MAX_POSTS = 300;

const postBank = [
  "A stray spell orb drifted through the east cloister, humming like bees until a Sight student sketched its orbit.",
  "Touch apprentices wove a tapestry ward so dense it softened every footstep in the moonlit hall.",
  "Sound faculty tuned the bells to the heartbeat of the library—silence now thuds softly between shelves.",
  "Smell/Taste novices brewed a tea that tastes like first snowfall; it cleared every fogged mind in exams.",
  "Sight trackers mapped a comet tail over the observatory—its glow traced the old ward-lines perfectly.",
  "Touch mentors added braille runes to the dueling circle; the floor thrums when your stance is true.",
  "Sound keepers report the wind tunnel harmonized on its own, as if practicing scales before class.",
  "Smell/Taste alchemists infused the greenhouse with rosemary vapor; memories surfaced like bubbles.",
  "Sight adepts painted doorways with light; even closed portals now reveal who knocks by silhouette.",
  "Touch wardens tempered quills with riverstone ink, preventing smudged sigils during rainy season.",
  "Sound archivists captured a thunderclap in crystal; played back quietly, it calms restless familiars.",
  "Smell/Taste tutors revised the scent curriculum—amber notes now mark safety drills in the dorms.",
  "Sight novices set prisms in courtyard lanterns; each path now wears a shifting aurora for guidance.",
  "Touch crafters reforged practice wands with woven leather grips; no more slips mid-incantation.",
  "Sound choir traced a lullaby into the walls; echoes now hush arguments before they flare.",
  "Smell/Taste students bottled bakery warmth; uncorked near the infirmary, it brightened every bed.",
  "Sight mentors recalibrated star charts after a meteor shower rewrote the sky’s margins.",
  "Touch dueling club installed cushioned ward-rings, easing the recoil of high-voltage sigils.",
  "Sound engineers tuned the speaking tubes to filter gossip; only urgent tones now carry through.",
  "Smell/Taste scholars discovered a spice that tastes like remembered courage; rationed for finals week.",
  "Sight seniors projected last year's aurora into the main hall—an annual reminder to look up.",
  "Touch artisans carved gratitude knots into stair rails; the wood warms when thanked aloud.",
  "Sound mages recorded the library's quiet and play it back during storms to steady readers.",
  "Smell/Taste faculty seeded the orchard with mint-snow pears; blossoms ring like glass when stirred."
];

function loadPosts() {
  try {
    const raw = fs.readFileSync(DATA_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    if (err.code === "ENOENT") return [];
    console.error("Failed to read posts:", err);
    return [];
  }
}

function savePosts(posts) {
  const safe = JSON.stringify(posts, null, 2);
  fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });
  fs.writeFileSync(DATA_PATH, safe + "\n", "utf8");
}

function pickTemplate() {
  const index = Math.floor(Math.random() * postBank.length);
  return postBank[index];
}

function nextId(existing) {
  const numeric = existing
    .map((p) => String(p.id || ""))
    .map((id) => {
      const match = id.match(/(\d+)$/);
      return match ? Number(match[1]) : 0;
    });
  const highest = numeric.length ? Math.max(...numeric) : 0;
  return `post-${highest + 1}`;
}

function addPost() {
  const posts = loadPosts();
  const text = pickTemplate();
  const id = nextId(posts);

  const schools = ["Touch", "Sight", "Sound", "Smell/Taste"];
  const school = schools[Math.floor(Math.random() * schools.length)];

  const authors = {
    Touch: "Warden of Touch",
    Sight: "Stargazer of Sight",
    Sound: "Cantor of Sound",
    "Smell/Taste": "Essence Steward"
  };

  const newPost = {
    id,
    author: authors[school] || "Anonymous Scribe",
    school,
    createdAt: new Date().toISOString(),
    text
  };

  const updated = [...posts, newPost]
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .slice(-MAX_POSTS);

  savePosts(updated);
  console.log(`Added ${newPost.id} for ${school}`);
}

addPost();
