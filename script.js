(function () {
  const root = document.documentElement;
  const navToggle = document.getElementById("navToggle");
  const navLinks = document.getElementById("navLinks");
  const profileMenu = document.getElementById("profileMenu");
  const profileToggle = document.getElementById("profileMenuToggle");
  const profileMenuList = document.getElementById("profileMenuList");
  const loginButtons = Array.from(document.querySelectorAll('[data-auth-target="login-cta"]'));
  const loreFeeds = Array.from(document.querySelectorAll("[data-lore-feed]"));
  const loreComposerForm = document.getElementById("loreComposerForm");
  const loreComposerStatus = document.getElementById("loreComposerStatus");
  const LOCAL_LORE_KEY = "userLorePosts";
  const LOGIN_STATE_KEY = "auth:isLoggedIn";
  const DATA_POSTS_URL = "./data/posts.json";
  const header = document.querySelector(".header");

  const loreAuthors = ["Archivist Mira", "Keeper Iden", "Cantor Lysa", "Essence Steward", "Field Mentor Ryn", "Constellation Scribe Ixa"];
  const loreSchools = ["Touch", "Sight", "Sound", "Essence", "Cross-House", "Archival Wing"];
  const loreEvents = [
    {
      moment: "before dawn drills on the east battlements",
      incident: "a stray sigil sparked against the frost",
      detail: "the pattern matched an unfinished star map tucked under the rail.",
    },
    {
      moment: "during a midnight patrol",
      incident: "an unmarked lantern kept relighting itself in the rain",
      detail: "each flare sang the first bar of an old choir cadence.",
    },
    {
      moment: "at the third bell in the infirmary hallway",
      incident: "fresh ward chalk appeared over the door hinges",
      detail: "it smelled faintly of cinnamon ink—warm, precise, and protective.",
    },
    {
      moment: "while the observatory shutters were closed",
      incident: "light still traced the constellation of the Serpent Choir",
      detail: "no lenses were open; the glow echoed against copper pipes like a breath.",
    },
    {
      moment: "right after curfew checks",
      incident: "the southern wind carried pages of a practice journal into the courtyard",
      detail: "every page was stamped with thumbprints of salt and juniper oil.",
    },
    {
      moment: "as the refectory fires dimmed",
      incident: "a quiet humming rose from the speaking tubes",
      detail: "it harmonized with heartbeats, then faded when listeners steadied their breaths.",
    },
  ];
  const loreReactions = [
    "Students nearby felt the air tighten, then soften, as if invited to listen.",
    "Mentors traced the echoes and logged the finding for tonight's roundtable.",
    "Apprentices chalked the outline to study, noting the cadence never repeated twice.",
    "The hall monitors sealed the note under glass, convinced it was purposeful.",
    "Someone left a brass compass beside it, suggesting the act was deliberate, not accidental.",
    "The sensation lingered long after, like warmth left in stone steps.",
  ];

  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  // Set a consistent theme (no toggle needed for this landing page)
  root.setAttribute("data-theme", "light");

  // Mobile nav
  function setNavOpen(open) {
    navLinks.classList.toggle("open", open);
    navToggle.setAttribute("aria-expanded", String(open));
  }

  navToggle?.addEventListener("click", () => {
    const open = !navLinks.classList.contains("open");
    setNavOpen(open);
    if (!open) {
      closeProfileMenu();
    }
  });

  // Close menu after clicking a link (mobile)
  navLinks?.addEventListener("click", (e) => {
    const target = e.target;
    if (target && target instanceof HTMLElement && navLinks.classList.contains("open")) {
      const isNavAction = target.tagName === "A" || target.tagName === "BUTTON";
      if (!isNavAction) return;
      setNavOpen(false);
      closeProfileMenu();
    }
  });

  function setProfileMenuOpen(open) {
    if (!(profileMenu instanceof HTMLElement)) return;
    profileMenu.classList.toggle("open", open);
    if (profileToggle) {
      profileToggle.setAttribute("aria-expanded", String(open));
    }
    if (profileMenuList) {
      profileMenuList.setAttribute("aria-hidden", String(!open));
    }
  }

  function closeProfileMenu() {
    setProfileMenuOpen(false);
  }

  profileToggle?.addEventListener("click", () => {
    const isOpen = profileMenu?.classList.contains("open");
    setProfileMenuOpen(!isOpen);
  });

  profileMenuList?.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.tagName === "A" || target.tagName === "BUTTON") {
      closeProfileMenu();
    }
  });

  document.addEventListener("click", (event) => {
    if (!profileMenu?.classList.contains("open")) return;
    if (!(event.target instanceof Node)) return;
    if (profileMenu.contains(event.target)) return;
    closeProfileMenu();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeProfileMenu();
    }
  });

  // Close menu on Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") setNavOpen(false);
  });

  function pickRandom(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function toggleLoginButtons(show) {
    loginButtons.forEach((button) => {
      if (!(button instanceof HTMLElement)) return;
      if (!button.dataset.defaultDisplay) {
        button.dataset.defaultDisplay = button.style.display || "";
      }
      button.style.display = show ? button.dataset.defaultDisplay : "none";
    });
  }

  function toggleProfileMenuVisibility(show) {
    if (!(profileMenu instanceof HTMLElement)) return;
    if (!profileMenu.dataset.defaultDisplay) {
      profileMenu.dataset.defaultDisplay =
        profileMenu.style.display && profileMenu.style.display !== "none" ? profileMenu.style.display : "inline-flex";
    }
    profileMenu.style.display = show ? profileMenu.dataset.defaultDisplay : "none";
    if (!show) {
      closeProfileMenu();
    }
  }

  // Hide header while scrolling down
  if (header) {
    let lastScrollY = window.scrollY;
    const SCROLL_DELTA = 12;

    const updateHeaderVisibility = () => {
      const currentY = window.scrollY;
      const scrollingDown = currentY - lastScrollY > SCROLL_DELTA;
      const scrollingUp = lastScrollY - currentY > SCROLL_DELTA;
      const nearTop = currentY < 20;

      if (nearTop || scrollingUp) {
        header.classList.remove("header--hidden");
      } else if (scrollingDown) {
        header.classList.add("header--hidden");
      }

      lastScrollY = currentY;
    };

    window.addEventListener("scroll", updateHeaderVisibility, { passive: true });
  }

  function syncLoginButtonsFromStorage() {
    let isLoggedIn = false;
    try {
      isLoggedIn = localStorage.getItem(LOGIN_STATE_KEY) === "true";
    } catch (err) {
      console.warn("Unable to read auth state from storage", err);
    }
    toggleLoginButtons(!isLoggedIn);
    toggleProfileMenuVisibility(isLoggedIn);
  }

  syncLoginButtonsFromStorage();
  window.addEventListener("storage", (event) => {
    if (event.key === LOGIN_STATE_KEY) {
      syncLoginButtonsFromStorage();
    }
  });

  function createVisitLorePost() {
    const createdAt = new Date();
    const author = pickRandom(loreAuthors);
    const school = pickRandom(loreSchools);
    const event = pickRandom(loreEvents);
    const reaction = pickRandom(loreReactions);

    const text = `During ${event.moment}, ${event.incident}; ${event.detail} ${reaction}`;

    return {
      id: `visit-${createdAt.getTime()}-${Math.floor(Math.random() * 100000)}`,
      author,
      school,
      createdAt,
      text,
    };
  }

  function setFieldError(fieldName, message) {
    const el = document.querySelector(`.error[data-for="${fieldName}"]`);
    if (el) el.textContent = message || "";
  }

  function loadUserLorePosts() {
    try {
      const stored = localStorage.getItem(LOCAL_LORE_KEY);
      const parsed = stored ? JSON.parse(stored) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      console.warn("Unable to read saved lore posts", err);
      return [];
    }
  }

  function saveUserLorePosts(posts) {
    try {
      localStorage.setItem(LOCAL_LORE_KEY, JSON.stringify(posts.slice(0, 200)));
    } catch (err) {
      console.warn("Unable to save lore posts", err);
    }
  }

  function normalizePosts(posts) {
    return Array.isArray(posts)
      ? posts
          .map((post) => {
            if (!post?.createdAt) return null;
            const createdAt = new Date(post.createdAt);
            if (Number.isNaN(createdAt.getTime())) return null;
            return { ...post, createdAt };
          })
          .filter(Boolean)
      : [];
  }

  async function fetchPostsFromFile(url) {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }
    const posts = await response.json();
    return normalizePosts(posts);
  }

  async function loadLorePosts() {
    try {
      const posts = await fetchPostsFromFile(DATA_POSTS_URL);
      if (posts.length) {
        return { posts, source: "file" };
      }
    } catch (err) {
      console.warn("Unable to fetch shared posts from file", err);
    }

    const drafts = normalizePosts(loadUserLorePosts()).map((post) => ({ ...post, localOnly: true }));
    return { posts: drafts, source: "local" };
  }

  // Lore board rendering
  async function renderLoreBoards() {
    if (!loreFeeds.length) return;

    const setMessage = (feed, message) => {
      feed.innerHTML = "";
      const p = document.createElement("p");
      p.className = "muted";
      p.textContent = message;
      feed.appendChild(p);
    };

    loreFeeds.forEach((feed) => setMessage(feed, "Fetching today’s notices..."));

    try {
      const { posts, source } = await loadLorePosts();
      const feedPosts = posts.length ? posts.sort((a, b) => b.createdAt - a.createdAt) : [createVisitLorePost()];

      const renderToFeed = (feed, postsToRender) => {
        const limitAttr = Number(feed.getAttribute("data-limit"));
        const limit = Number.isFinite(limitAttr) && limitAttr > 0 ? limitAttr : postsToRender.length;
        const selection = postsToRender.slice(0, limit);

        if (!selection.length) {
          setMessage(feed, "No notices on the board yet. Check back after the daily quill writes again.");
          return;
        }

        feed.innerHTML = "";

        selection.forEach((post) => {
          const card = document.createElement("article");
          card.className = "post";

          const top = document.createElement("div");
          top.className = "postTop";

          const author = document.createElement("span");
          author.className = "postAuthor";
          author.textContent = post.author || "Unknown scribe";

          const meta = document.createElement("span");
          meta.className = "postMeta";
          const school = post.school || "Unknown hall";
          const date = post.createdAt?.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) || "Unknown time";
          const scope = post.localOnly || source === "local" ? " • Saved on this device" : "";
          meta.textContent = `${school} • ${date}${scope}`;

          top.append(author, meta);

          const body = document.createElement("p");
          body.className = "postBody";
          body.textContent = post.text || "A missing scrap of parchment.";

          card.append(top, body);
          feed.appendChild(card);
        });
      };

      loreFeeds.forEach((feed) => renderToFeed(feed, feedPosts));
    } catch (err) {
      console.error(err);
      const fallbackPost = createVisitLorePost();
      loreFeeds.forEach((feed) => {
        feed.innerHTML = "";
        const notice = document.createElement("p");
        notice.className = "muted";
        notice.textContent = "The quill is resting. Sharing the freshest whispered note instead.";
        feed.appendChild(notice);
        const card = document.createElement("article");
        card.className = "post";
        const top = document.createElement("div");
        top.className = "postTop";
        const author = document.createElement("span");
        author.className = "postAuthor";
        author.textContent = fallbackPost.author || "Unknown scribe";
        const meta = document.createElement("span");
        meta.className = "postMeta";
        meta.textContent = `${fallbackPost.school || "Unknown hall"} • ${fallbackPost.createdAt.toLocaleString(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        })}`;
        top.append(author, meta);
        const body = document.createElement("p");
        body.className = "postBody";
        body.textContent = fallbackPost.text;
        card.append(top, body);
        feed.appendChild(card);
      });
    }
  }

  renderLoreBoards();

  async function publishSharedLorePost(submission) {
    console.info("Shared board endpoint unavailable on static hosting; saving locally instead.");
    const localPost = {
      ...submission,
      id: `local-${Date.now()}`,
      createdAt: new Date().toISOString(),
      localOnly: true,
    };
    const existing = loadUserLorePosts();
    saveUserLorePosts([localPost, ...existing]);
    return { post: localPost, shared: false };
  }

  // Lore composer (archive page only)
  if (loreComposerForm) {
    const nameInput = loreComposerForm.querySelector("#loreName");
    const schoolInput = loreComposerForm.querySelector("#loreSchool");
    const messageInput = loreComposerForm.querySelector("#loreMessage");

    const clearComposerErrors = () => {
      setFieldError("loreName", "");
      setFieldError("loreSchool", "");
      setFieldError("loreMessage", "");
    };

    loreComposerForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearComposerErrors();
      if (loreComposerStatus) loreComposerStatus.textContent = "";

      const name = nameInput?.value.trim() || "";
      const school = schoolInput?.value.trim() || "";
      const message = messageInput?.value.trim() || "";

      let ok = true;
      if (name.length < 2) {
        setFieldError("loreName", "Please enter a name (at least 2 characters).");
        ok = false;
      }
      if (!school) {
        setFieldError("loreSchool", "Choose a school or hall.");
        ok = false;
      }
      if (message.length < 12) {
        setFieldError("loreMessage", "Share at least 12 characters so others can follow your note.");
        ok = false;
      }

      if (!ok) return;

      const submission = {
        author: name,
        school,
        text: message,
      };

      if (loreComposerStatus) loreComposerStatus.textContent = "Posting your note to the shared board...";
      const result = await publishSharedLorePost(submission);

      loreComposerForm.reset();
      if (loreComposerStatus) {
        loreComposerStatus.textContent = result.shared
          ? "Posted! Your note now appears on the Lore Board for everyone."
          : "Saved locally while the shared board is unavailable. It currently appears only on this device.";
      }
      renderLoreBoards();
    });

    loreComposerForm.addEventListener("reset", () => {
      clearComposerErrors();
      if (loreComposerStatus) loreComposerStatus.textContent = "";
    });
  }

  // Quiz (sorting ritual page only)
  const quizForm = document.getElementById("schoolQuiz");
  const quizResult = document.getElementById("quizResult");
  const quizStatus = document.getElementById("quizStatus");

  if (quizForm && quizResult) {
    const schoolCopy = {
      touch: {
        name: "Chamber of Touch",
        fit: "Your choices favored texture, warmth, and the certainty of things held in hand. You steady spells by feeling their shape and making them tangible.",
        invitation:
          "Within the Chamber of Touch you'll learn shield-weaving, tactile sigils, and restorative crafts—building wards and tools that pulse with your intent.",
        status: "You lead with grounding sensation and craft, anchoring magic through touch.",
      },
      sight: {
        name: "Observatory of Sight",
        fit: "You read meaning in diagrams, glints, and constellations. Patterns reveal themselves quickly to you, and you navigate by the stories light tells.",
        invitation:
          "The Observatory of Sight will refine your focus through star charts, illusion wards, and mapwork of ley lines—teaching you to draw the unseen into view.",
        status: "You lead with a precise gaze, mapping possibilities before others sense them.",
      },
      sound: {
        name: "Choir of Sound",
        fit: "Vibration, cadence, and harmony guide your focus. You listen between words and tune your magic like an instrument until everything resonates.",
        invitation:
          "The Choir of Sound pairs you with conductors who teach resonance spells, storm-calming chorales, and voice-bound wards that answer your rhythm.",
        status: "You lead with resonance and cadence, coaxing harmony from every element.",
      },
      essence: {
        name: "House of Essence",
        fit: "Memory and mood speak to you through aroma and flavor. You notice the way scent changes a room and trace emotion through what lingers in the air.",
        invitation:
          "Within the House of Essence you'll study aromatic divination, healing brews, and atmosphere-shaping rituals that braid memory into every casting.",
        status: "You lead with memory-rich essences, shaping spells through taste and scent.",
      },
    };

    function clearQuizFeedback() {
      quizForm.querySelectorAll(".questionCard").forEach((field) => field.classList.remove("hasError"));

      quizResult.replaceChildren();
      const title = document.createElement("h4");
      title.textContent = "Awaiting your answers";
      const body = document.createElement("p");
      body.className = "muted";
      body.textContent = "Complete all prompts to hear the academy's verdict.";
      quizResult.append(title, body);

      if (quizStatus) quizStatus.textContent = "";
    }

    quizForm.addEventListener("submit", (e) => {
      e.preventDefault();

      clearQuizFeedback();

      const formData = new FormData(quizForm);
      const counts = { touch: 0, sight: 0, sound: 0, essence: 0 };
      let valid = true;

      quizForm.querySelectorAll(".questionCard").forEach((field) => {
        const question = field.getAttribute("data-question");
        const choice = question ? formData.get(question) : null;
        if (!choice) {
          valid = false;
          field.classList.add("hasError");
        } else if (choice in counts) {
          counts[choice] += 1;
        }
      });

      if (!valid) {
        if (quizStatus) quizStatus.textContent = "Answer each prompt to complete the ritual.";
        return;
      }

      const entries = Object.entries(counts);
      const highest = Math.max(...entries.map(([, value]) => value));
      const winners = entries.filter(([, value]) => value === highest).map(([key]) => key);
      const schoolKey = winners[0];
      const school = schoolCopy[schoolKey];

      if (school) {
        const isTie = winners.length > 1;
        const winningNames = winners.map((key) => schoolCopy[key]?.name || key);

        const title = document.createElement("h4");
        title.textContent = isTie ? `A braided attunement` : `${school.name} awaits you.`;

        const body = document.createElement("p");
        body.className = "resultDetail";
        body.textContent = isTie
          ? `Your answers resonate with ${winningNames.join(" and ")}. Multiple senses are calling—follow the one that sparks the clearest curiosity today.`
          : school.fit;

        const detail = document.createElement("p");
        detail.className = "muted";
        detail.textContent = isTie
          ? "Explore the wings that echo your favorite senses; mentors will help you weave them into a singular craft."
          : school.invitation;

        quizResult.replaceChildren(title, body, detail);

        if (quizStatus) {
          const headline = isTie
            ? `You harmonize with ${winningNames.join(" or ")}.`
            : `${school.name}: ${school.status}`;
          quizStatus.textContent = headline;
        }
      }
    });

    quizForm.addEventListener("reset", () => {
      clearQuizFeedback();
    });

    clearQuizFeedback();
  }

  // Contact form validation
  const form = document.getElementById("contactForm");
  const statusEl = document.getElementById("formStatus");
  const submitBtn = form?.querySelector('button[type="submit"]');

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = form.name.value.trim();
    const message = form.message.value.trim();

    setFieldError("name", "");
    setFieldError("message", "");
    if (statusEl) statusEl.textContent = "";

    let ok = true;

    if (name.length < 2) {
      setFieldError("name", "Please enter your name (at least 2 characters).");
      ok = false;
    }
    if (message.length < 10) {
      setFieldError("message", "Please write a message (at least 10 characters).");
      ok = false;
    }

    if (!ok) {
      if (statusEl) statusEl.textContent = "Please fix the highlighted fields.";
      return;
    }

    if (statusEl) statusEl.textContent = "Sending your message...";
    submitBtn?.setAttribute("disabled", "true");

    const formData = new FormData();
    formData.append("name", name);
    formData.append("message", message);

    try {
      const response = await fetch("https://formspree.io/f/meeqrlol", {
        method: "POST",
        headers: { Accept: "application/json" },
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        const errorMsg = data?.errors?.[0]?.message || "Something went wrong. Please try again.";
        throw new Error(errorMsg);
      }

      if (statusEl) statusEl.textContent = "Thanks! Your message has been sent.";
      form.reset();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to send your message right now.";
      if (statusEl) statusEl.textContent = message;
    } finally {
      submitBtn?.removeAttribute("disabled");
    }
  });
})();
