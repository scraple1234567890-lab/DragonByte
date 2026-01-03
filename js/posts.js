import { supabase } from "./supabaseClient.js";

const postForm = document.getElementById("new-post-form");
const postContentInput = document.getElementById("post-content");
const postStatus = document.getElementById("post-status");
const postsContainer = document.getElementById("posts");
const mustLogin = document.getElementById("must-login");
const postSubmitButton = document.getElementById("post-submit");
const sharePostButton = document.getElementById("share-post-btn");
const postComposerCard = document.getElementById("composer-card");
const closePostComposerButton = document.getElementById("close-composer");

// Articles UI
const articleForm = document.getElementById("new-article-form");
const articleTitleInput = document.getElementById("article-title");
const articleContentInput = document.getElementById("article-content");
const articleStatus = document.getElementById("article-status");
const articlesContainer = document.getElementById("articles");
const articleSubmitButton = document.getElementById("article-submit");
const shareArticleButton = document.getElementById("share-article-btn");
const articleComposerCard = document.getElementById("article-composer-card");
const closeArticleComposerButton = document.getElementById("close-article-composer");

const AVATAR_KEY_PREFIX = "profile:avatar:";
const MAX_POST_CHARS = 2000;
const MAX_ARTICLE_TITLE = 120;
const MAX_ARTICLE_CHARS = 12000;

let currentUser = null;
let postsCache = [];
let articlesCache = [];
const avatarCache = new Map();

let postsChannel = null;
let articlesChannel = null;

function setStatus(element, message, tone = "muted") {
  if (!element) return;
  element.textContent = message || "";
  element.className = `${tone} small`;
}

function setButtonBusy(button, busy, busyText, defaultText) {
  if (!(button instanceof HTMLButtonElement)) return;
  if (!button.dataset.defaultText) {
    button.dataset.defaultText = defaultText || button.textContent || "";
  }
  button.disabled = Boolean(busy);
  button.textContent = busy ? busyText : button.dataset.defaultText;
}

function setShareButtonEnabled(button, enabled) {
  if (!(button instanceof HTMLButtonElement)) return;
  button.disabled = !enabled;
  if (!enabled) {
    button.setAttribute("aria-expanded", "false");
  }
}

function openComposer(card, button, focusTarget) {
  if (!(card instanceof HTMLElement)) return;
  card.hidden = false;
  if (button instanceof HTMLButtonElement) {
    button.setAttribute("aria-expanded", "true");
  }
  if (focusTarget instanceof HTMLElement) {
    focusTarget.focus();
  }
}

function closeComposer(card, button) {
  if (!(card instanceof HTMLElement)) return;
  card.hidden = true;
  if (button instanceof HTMLButtonElement) {
    button.setAttribute("aria-expanded", "false");
  }
}

function toggleCreateUI(isLoggedIn) {
  // Show/hide forms, keep feeds visible for everyone
  if (postForm) {
    postForm.style.display = isLoggedIn ? "grid" : "none";
  }
  if (articleForm) {
    articleForm.style.display = isLoggedIn ? "grid" : "none";
  }

  if (mustLogin) {
    mustLogin.style.display = isLoggedIn ? "none" : "block";
    if (!mustLogin.dataset.defaultText) {
      mustLogin.dataset.defaultText = mustLogin.textContent || "You must be logged in to post.";
    }
    mustLogin.textContent = isLoggedIn ? "" : mustLogin.dataset.defaultText;
  }

  setShareButtonEnabled(sharePostButton, isLoggedIn);
  setShareButtonEnabled(shareArticleButton, isLoggedIn);

  if (!isLoggedIn) {
    closeComposer(postComposerCard, sharePostButton);
    closeComposer(articleComposerCard, shareArticleButton);
  }
}

function formatDate(input) {
  const date = input ? new Date(input) : null;
  if (!date || Number.isNaN(date.getTime())) return "Unknown time";
  return date.toLocaleString();
}

function getAvatarStorageKey(userId) {
  return userId ? `${AVATAR_KEY_PREFIX}${userId}` : "";
}

function loadStoredAvatar(userId) {
  const key = getAvatarStorageKey(userId);
  if (!key) return null;
  try {
    return localStorage.getItem(key);
  } catch (error) {
    console.warn("Unable to read avatar from storage", error);
    return null;
  }
}

function getAvatarForUser(userId) {
  if (!userId) return null;
  if (avatarCache.has(userId)) {
    return avatarCache.get(userId);
  }
  const avatar = loadStoredAvatar(userId);
  avatarCache.set(userId, avatar);
  return avatar;
}

function createAvatarElement(userId) {
  const avatar = document.createElement("span");
  avatar.className = "profileAvatar profileAvatar--post";

  const placeholder = document.createElement("span");
  placeholder.className = "profileAvatarPlaceholder";
  placeholder.innerHTML = `
    <svg viewBox="0 0 24 24" role="presentation" focusable="false">
      <path
        d="M12 12c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5Zm0 2c-3.33 0-10 1.67-10 5v1h20v-1c0-3.33-6.67-5-10-5Z"
        fill="currentColor"
      />
    </svg>
  `;

  const img = document.createElement("img");
  img.alt = "User profile picture";
  img.loading = "lazy";

  const src = getAvatarForUser(userId);
  if (src) {
    img.src = src;
    avatar.classList.add("hasImage");
  }

  avatar.append(placeholder, img);
  return avatar;
}

function makeExcerpt(text, max = 240) {
  const value = (text || "").trim();
  if (!value) return "";
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

function renderPosts(posts) {
  if (!postsContainer) return;

  postsContainer.innerHTML = "";

  if (!posts.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "No posts yet. Be the first to share something!";
    postsContainer.appendChild(empty);
    return;
  }

  posts.forEach((post) => {
    const article = document.createElement("article");
    article.className = "card";
    article.dataset.id = post.id;

    const metaRow = document.createElement("div");
    metaRow.className = "postMetaRow";

    const avatar = createAvatarElement(post.user_id);

    const metaText = document.createElement("p");
    metaText.className = "muted small";
    metaText.textContent = formatDate(post.created_at);
    metaText.style.margin = "0";

    const metaTextWrapper = document.createElement("div");
    metaTextWrapper.className = "postMetaText";
    metaTextWrapper.appendChild(metaText);

    metaRow.append(avatar, metaTextWrapper);

    const content = document.createElement("p");
    content.className = "post-content";
    content.style.whiteSpace = "pre-wrap";
    content.textContent = post.content || "";

    article.append(metaRow, content);
    postsContainer.appendChild(article);
  });
}

function renderArticles(articles) {
  if (!articlesContainer) return;

  articlesContainer.innerHTML = "";

  if (!articles.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "No articles yet. Publish the first one!";
    articlesContainer.appendChild(empty);
    return;
  }

  articles.forEach((row) => {
    const card = document.createElement("article");
    card.className = "card";
    card.dataset.id = row.id;

    const metaRow = document.createElement("div");
    metaRow.className = "postMetaRow";

    const avatar = createAvatarElement(row.user_id);

    const metaText = document.createElement("p");
    metaText.className = "muted small";
    metaText.textContent = formatDate(row.created_at);
    metaText.style.margin = "0";

    const metaTextWrapper = document.createElement("div");
    metaTextWrapper.className = "postMetaText";
    metaTextWrapper.appendChild(metaText);

    metaRow.append(avatar, metaTextWrapper);

    const title = document.createElement("h3");
    title.style.margin = "12px 0 6px";
    title.textContent = row.title || "Untitled";

    const excerpt = document.createElement("p");
    excerpt.className = "muted";
    excerpt.style.margin = "0 0 10px";
    excerpt.textContent = makeExcerpt(row.content, 260);

    const bodyWrap = document.createElement("div");
    bodyWrap.hidden = true;

    const body = document.createElement("p");
    body.className = "post-content";
    body.style.whiteSpace = "pre-wrap";
    body.textContent = row.content || "";
    bodyWrap.appendChild(body);

    const actions = document.createElement("div");
    actions.className = "actions";
    actions.style.marginTop = "10px";

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "btn ghost small";
    toggle.textContent = "Read article";
    toggle.setAttribute("aria-expanded", "false");

    const isLong = (row.content || "").trim().length > 280;

    if (!isLong) {
      // Short article: show full body by default, hide toggle
      bodyWrap.hidden = false;
      toggle.hidden = true;
    } else {
      toggle.addEventListener("click", () => {
        const open = bodyWrap.hidden;
        bodyWrap.hidden = !open;
        toggle.setAttribute("aria-expanded", String(open));
        toggle.textContent = open ? "Hide article" : "Read article";
      });
      actions.appendChild(toggle);
    }

    card.append(metaRow, title, excerpt, actions, bodyWrap);
    articlesContainer.appendChild(card);
  });
}

async function loadPosts() {
  if (postsContainer) {
    postsContainer.innerHTML = "<p class=\"muted\">Loading posts...</p>";
  }

  try {
    const { data, error } = await supabase
      .from("posts")
      .select("id, content, created_at, user_id")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;

    postsCache = data || [];
    renderPosts(postsCache);
  } catch (error) {
    console.error("Error fetching posts", error);
    if (postsContainer) {
      postsContainer.innerHTML = "";
      const errorMessage = document.createElement("p");
      errorMessage.className = "error";
      errorMessage.textContent = `Error loading posts: ${error?.message || "Unknown error"}`;
      postsContainer.appendChild(errorMessage);
    }
  }
}

async function loadArticles() {
  if (articlesContainer) {
    articlesContainer.innerHTML = "<p class=\"muted\">Loading articles...</p>";
  }

  try {
    const { data, error } = await supabase
      .from("articles")
      .select("id, title, content, created_at, user_id")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;

    articlesCache = data || [];
    renderArticles(articlesCache);
  } catch (error) {
    console.error("Error fetching articles", error);
    if (articlesContainer) {
      articlesContainer.innerHTML = "";
      const errorMessage = document.createElement("p");
      errorMessage.className = "error";
      const hint =
        String(error?.message || "").toLowerCase().includes("relation") ||
        String(error?.message || "").toLowerCase().includes("does not exist")
          ? " (Looks like the 'articles' table isn't created in Supabase yet.)"
          : "";
      errorMessage.textContent = `Error loading articles: ${error?.message || "Unknown error"}${hint}`;
      articlesContainer.appendChild(errorMessage);
    }
  }
}

async function handlePostSubmit(event) {
  event.preventDefault();

  if (!currentUser) {
    setStatus(postStatus, "Please log in to post.", "error");
    return;
  }

  const trimmedText = (postContentInput?.value || "").trim();
  if (!trimmedText) {
    setStatus(postStatus, "Post content cannot be empty.", "error");
    return;
  }
  if (trimmedText.length > MAX_POST_CHARS) {
    setStatus(postStatus, `Post must be ${MAX_POST_CHARS} characters or fewer.`, "error");
    return;
  }

  setButtonBusy(postSubmitButton, true, "Posting...", "Post");
  setStatus(postStatus, "");

  const { error } = await supabase.from("posts").insert([{ user_id: currentUser.id, content: trimmedText }]);

  if (error) {
    console.error("Error creating post", error);
    setStatus(postStatus, "Could not create post. Please try again.", "error");
  } else {
    if (postContentInput) {
      postContentInput.value = "";
    }
    setStatus(postStatus, "Post created! It should appear below.", "success");
    closeComposer(postComposerCard, sharePostButton);
    await loadPosts();
  }

  setButtonBusy(postSubmitButton, false, "Posting...", "Post");
}

async function handleArticleSubmit(event) {
  event.preventDefault();

  if (!currentUser) {
    setStatus(articleStatus, "Please log in to publish an article.", "error");
    return;
  }

  const title = (articleTitleInput?.value || "").trim();
  const content = (articleContentInput?.value || "").trim();

  if (!title) {
    setStatus(articleStatus, "Title cannot be empty.", "error");
    return;
  }
  if (title.length > MAX_ARTICLE_TITLE) {
    setStatus(articleStatus, `Title must be ${MAX_ARTICLE_TITLE} characters or fewer.`, "error");
    return;
  }
  if (!content) {
    setStatus(articleStatus, "Article body cannot be empty.", "error");
    return;
  }
  if (content.length > MAX_ARTICLE_CHARS) {
    setStatus(articleStatus, `Article must be ${MAX_ARTICLE_CHARS.toLocaleString()} characters or fewer.`, "error");
    return;
  }

  setButtonBusy(articleSubmitButton, true, "Publishing...", "Publish");
  setStatus(articleStatus, "");

  const { error } = await supabase.from("articles").insert([{ user_id: currentUser.id, title, content }]);

  if (error) {
    console.error("Error creating article", error);
    setStatus(articleStatus, error.message || "Could not publish article. Please try again.", "error");
  } else {
    if (articleTitleInput) articleTitleInput.value = "";
    if (articleContentInput) articleContentInput.value = "";
    setStatus(articleStatus, "Article published! It should appear below.", "success");
    closeComposer(articleComposerCard, shareArticleButton);
    await loadArticles();
  }

  setButtonBusy(articleSubmitButton, false, "Publishing...", "Publish");
}

async function refreshAuthUI() {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    currentUser = data?.session?.user ?? null;
    toggleCreateUI(Boolean(currentUser));
  } catch (error) {
    console.error("Error checking auth status", error);
    currentUser = null;
    toggleCreateUI(false);
  }
}

function subscribeToRealtime() {
  if (!postsChannel) {
    postsChannel = supabase
      .channel("public:posts-page:posts")
      .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, () => {
        loadPosts();
      })
      .subscribe();
  }

  if (!articlesChannel) {
    articlesChannel = supabase
      .channel("public:posts-page:articles")
      .on("postgres_changes", { event: "*", schema: "public", table: "articles" }, () => {
        loadArticles();
      })
      .subscribe();
  }
}

function wireComposerButtons() {
  if (sharePostButton) {
    sharePostButton.addEventListener("click", () => {
      if (sharePostButton.disabled) return;
      if (postComposerCard?.hidden) {
        openComposer(postComposerCard, sharePostButton, postContentInput);
      } else {
        closeComposer(postComposerCard, sharePostButton);
      }
    });
  }

  if (closePostComposerButton) {
    closePostComposerButton.addEventListener("click", () => closeComposer(postComposerCard, sharePostButton));
  }

  if (shareArticleButton) {
    shareArticleButton.addEventListener("click", () => {
      if (shareArticleButton.disabled) return;
      if (articleComposerCard?.hidden) {
        openComposer(articleComposerCard, shareArticleButton, articleTitleInput);
      } else {
        closeComposer(articleComposerCard, shareArticleButton);
      }
    });
  }

  if (closeArticleComposerButton) {
    closeArticleComposerButton.addEventListener("click", () => closeComposer(articleComposerCard, shareArticleButton));
  }
}

function wireAvatarRefresh() {
  window.addEventListener("storage", (event) => {
    if (!event.key || !event.key.startsWith(AVATAR_KEY_PREFIX)) return;
    const userId = event.key.slice(AVATAR_KEY_PREFIX.length);
    avatarCache.delete(userId);
    renderPosts(postsCache);
    renderArticles(articlesCache);
  });

  window.addEventListener("profile:avatarUpdated", (event) => {
    const userId = event.detail?.userId;
    if (!userId) return;
    avatarCache.set(userId, event.detail?.src || null);
    renderPosts(postsCache);
    renderArticles(articlesCache);
  });
}

async function init() {
  await refreshAuthUI();

  // Feeds should load for everyone (guests + logged-in users)
  await Promise.all([loadPosts(), loadArticles()]);

  if (postForm) {
    postForm.addEventListener("submit", handlePostSubmit);
  }
  if (articleForm) {
    articleForm.addEventListener("submit", handleArticleSubmit);
  }

  wireComposerButtons();
  wireAvatarRefresh();
  subscribeToRealtime();

  supabase.auth.onAuthStateChange((_event, session) => {
    currentUser = session?.user ?? null;
    toggleCreateUI(Boolean(currentUser));
  });
}

init();
