import { supabase } from "./supabaseClient.js";

const postForm = document.getElementById("new-post-form");
const postContentInput = document.getElementById("post-content");
const postStatus = document.getElementById("post-status");
const postsContainer = document.getElementById("posts");
const mustLogin = document.getElementById("must-login");
const submitButton = document.getElementById("post-submit");
const shareButton = document.getElementById("share-post-btn");
const composerCard = document.getElementById("composer-card");
const closeComposerButton = document.getElementById("close-composer");

const AVATAR_KEY_PREFIX = "profile:avatar:";

let currentUser = null;
let redirectTimeout = null;
let postsCache = [];
const avatarCache = new Map();

function setStatus(message, tone = "muted") {
  if (!postStatus) return;
  postStatus.textContent = message || "";
  postStatus.className = `${tone} small`;
}

function setFormEnabled(enabled) {
  if (!(submitButton instanceof HTMLButtonElement)) return;
  submitButton.disabled = !enabled;
  submitButton.textContent = enabled ? "Post" : "Posting...";
}

function setShareButtonEnabled(enabled) {
  if (!(shareButton instanceof HTMLButtonElement)) return;
  shareButton.disabled = !enabled;
  shareButton.setAttribute("aria-expanded", enabled ? shareButton.getAttribute("aria-expanded") || "false" : "false");
}

function openComposer() {
  if (!(composerCard instanceof HTMLElement)) return;
  composerCard.hidden = false;
  if (shareButton instanceof HTMLButtonElement) {
    shareButton.setAttribute("aria-expanded", "true");
  }
  if (postContentInput) {
    postContentInput.focus();
  }
}

function closeComposer() {
  if (!(composerCard instanceof HTMLElement)) return;
  composerCard.hidden = true;
  if (shareButton instanceof HTMLButtonElement) {
    shareButton.setAttribute("aria-expanded", "false");
  }
}

function toggleAuthUI(isLoggedIn) {
  if (postForm) {
    postForm.style.display = isLoggedIn ? "grid" : "none";
  }
  if (mustLogin) {
    mustLogin.style.display = isLoggedIn ? "none" : "block";
  }
  setShareButtonEnabled(isLoggedIn);
  if (!isLoggedIn) {
    closeComposer();
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

    if (error) {
      throw error;
    }

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

async function handleSubmit(event) {
  event.preventDefault();
  if (!currentUser) {
    setStatus("Please log in to post.", "error");
    return;
  }

  const trimmedText = (postContentInput?.value || "").trim();
  if (!trimmedText) {
    setStatus("Post content cannot be empty.", "error");
    return;
  }

  setFormEnabled(false);
  setStatus("");

  const { error, data } = await supabase
    .from("posts")
    .insert([{ user_id: currentUser.id, content: trimmedText }])
    .select("id")
    .single();

  if (error || !data?.id) {
    console.error("Error creating post", error);
    setStatus("Could not create post. Please try again.", "error");
  } else {
    if (postContentInput) {
      postContentInput.value = "";
    }
    setStatus("Post created! Your entry should appear below once loaded.", "success");
    closeComposer();
    await loadPosts();
  }

  setFormEnabled(true);
}

function showLoginRequired(message = "You must be logged in to view and post.") {
  toggleAuthUI(false);
  setStatus("");

  if (redirectTimeout) {
    clearTimeout(redirectTimeout);
  }

  if (postsContainer) {
    postsContainer.innerHTML = "";
    const notice = document.createElement("p");
    notice.className = "muted";
    notice.textContent = message;
    postsContainer.appendChild(notice);
  }

  redirectTimeout = window.setTimeout(() => {
    window.location.assign("./portal.html");
  }, 1000);
}

async function refreshAuthUI() {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      throw error;
    }

    currentUser = data?.session?.user ?? null;
    toggleAuthUI(Boolean(currentUser));

    if (!currentUser) {
      showLoginRequired();
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error checking auth status", error);
    if (postsContainer) {
      postsContainer.innerHTML = "";
      const errorMessage = document.createElement("p");
      errorMessage.className = "error";
      errorMessage.textContent = `Error checking login: ${error?.message || "Unknown error"}`;
      postsContainer.appendChild(errorMessage);
    }
    return false;
  }
}

async function init() {
  const isLoggedIn = await refreshAuthUI();
  if (isLoggedIn) {
    await loadPosts();
  }

  if (postForm) {
    postForm.addEventListener("submit", handleSubmit);
  }
  if (shareButton) {
    shareButton.addEventListener("click", () => {
      if (shareButton.disabled) return;
      if (composerCard?.hidden) {
        openComposer();
      } else {
        closeComposer();
      }
    });
  }
  if (closeComposerButton) {
    closeComposerButton.addEventListener("click", closeComposer);
  }

  supabase.auth.onAuthStateChange(async (_event, session) => {
    currentUser = session?.user ?? null;
    toggleAuthUI(Boolean(currentUser));

    if (!currentUser) {
      showLoginRequired();
      return;
    }

    await loadPosts();
  });

  window.addEventListener("storage", (event) => {
    if (!currentUser || !event.key || !event.key.startsWith(AVATAR_KEY_PREFIX)) return;
    const userId = event.key.slice(AVATAR_KEY_PREFIX.length);
    avatarCache.delete(userId);
    renderPosts(postsCache);
  });

  window.addEventListener("profile:avatarUpdated", (event) => {
    if (!currentUser) return;
    const userId = event.detail?.userId;
    if (!userId) return;
    avatarCache.set(userId, event.detail?.src || null);
    renderPosts(postsCache);
  });
}

init();
