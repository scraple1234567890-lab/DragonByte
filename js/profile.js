import { supabase } from "./supabaseClient.js";

/** Toggle to true when debugging UI state issues */
const DEBUG = false;
const log = (...args) => DEBUG && console.log(...args);

const el = (id) => document.getElementById(id);

/** Elements */
const statusEl = el("profileStatus");
const guestNotice = el("profileGuestNotice");

const avatarBlock = el("profileAvatarBlock");
const avatarPreview = el("profileAvatarPreview");
const avatarInput = el("profileAvatarInput");
// optional (may not exist in HTML, safe to keep)
const avatarReset = el("profileAvatarReset");
const avatarStatus = el("profileAvatarStatus");

const profileSummary = el("profileSummary");
const profileNameDisplay = el("profileNameDisplay");
const profileBioDisplay = el("profileBioDisplay");

const profileEditToggle = el("profileEditToggle"); // "Edit" button (opens popup)
const profileEditForm = el("profileEditForm"); // form lives INSIDE popup overlay
const profileNameInput = el("profileNameInput");
const profileBioInput = el("profileBioInput");
const profileEditStatus = el("profileEditStatus");
const profileEditCancel = el("profileEditCancel");

// popup elements
const profileEditOverlay = el("profileEditOverlay");
const profileEditCloseBtn = el("profileEditCloseBtn");

const profilePosts = el("profilePosts");
const profilePostsCard = el("profilePostsCard");

// NEW: authored articles
const profileArticles = el("profileArticles");
const profileArticlesCard = el("profileArticlesCard");

/** Storage keys */
const LOGIN_STATE_KEY = "auth:isLoggedIn";
const AVATAR_KEY_PREFIX = "profile:avatar:";

/** State */
let activeUserId = null;
let profileMetadata = {};

/** ---------- tiny UI helpers ---------- */

function setText(node, text) {
  if (!(node instanceof HTMLElement)) return;
  node.textContent = text ?? "";
}

function setVisible(node, isVisible) {
  if (!(node instanceof HTMLElement)) return;
  const show = Boolean(isVisible);

  node.hidden = !show;
  node.style.display = show ? "" : "none";

  if (show) node.removeAttribute("hidden");
  else node.setAttribute("hidden", "");

  node.setAttribute("aria-hidden", String(!show));
}

function setStatus(message, tone = "muted") {
  if (!(statusEl instanceof HTMLElement)) return;
  setText(statusEl, message || "");
  statusEl.className = `${tone} small`;
  statusEl.hidden = !message;
}

function setAvatarStatus(message) {
  if (!(avatarStatus instanceof HTMLElement)) return;
  setText(avatarStatus, message || "");
  avatarStatus.hidden = !message;
}

function setLoginStateFlag(isLoggedIn) {
  try {
    if (isLoggedIn) localStorage.setItem(LOGIN_STATE_KEY, "true");
    else localStorage.removeItem(LOGIN_STATE_KEY);
  } catch (error) {
    console.warn("Unable to persist auth visibility state", error);
  }
}

/** ---------- popup helpers ---------- */

function openProfileEditOverlay() {
  if (!(profileEditOverlay instanceof HTMLElement)) return;

  // Prefill inputs from current visible UI (most reliable)
  const currentName = (profileNameDisplay?.textContent || "").trim();
  const bioIsPlaceholder = profileBioDisplay?.classList?.contains("muted");
  const currentBio = bioIsPlaceholder ? "" : (profileBioDisplay?.textContent || "").trim();

  const fallbackName =
    profileMetadata.displayName || profileMetadata.full_name || profileMetadata.name || "";
  const fallbackBio = profileMetadata.bio || "";

  if (profileNameInput instanceof HTMLInputElement) {
    profileNameInput.value = currentName || fallbackName || "";
  }
  if (profileBioInput instanceof HTMLTextAreaElement) {
    profileBioInput.value = currentBio || fallbackBio || "";
  }

  document.body.classList.add("isEditingProfile");
  profileEditOverlay.setAttribute("aria-hidden", "false");
  profileEditToggle?.setAttribute("aria-expanded", "true");

  // focus after paint
  setTimeout(() => profileNameInput?.focus?.(), 50);

  setProfileEditStatus("");
}

function closeProfileEditOverlay() {
  if (!(profileEditOverlay instanceof HTMLElement)) return;
  document.body.classList.remove("isEditingProfile");
  profileEditOverlay.setAttribute("aria-hidden", "true");
  profileEditToggle?.setAttribute("aria-expanded", "false");
  setProfileEditStatus("");
}

/** ---------- avatar storage ---------- */

function getAvatarStorageKey(userId) {
  return userId ? `${AVATAR_KEY_PREFIX}${userId}` : "";
}

function loadAvatar(userId) {
  const key = getAvatarStorageKey(userId);
  if (!key) return null;
  try {
    return localStorage.getItem(key);
  } catch (error) {
    console.warn("Unable to read avatar from storage", error);
    return null;
  }
}

function saveAvatar(userId, dataUrl) {
  const key = getAvatarStorageKey(userId);
  if (!key) return;
  try {
    localStorage.setItem(key, dataUrl);
  } catch (error) {
    console.warn("Unable to save avatar to storage", error);
  }
}

function clearAvatar(userId) {
  const key = getAvatarStorageKey(userId);
  if (!key) return;
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.warn("Unable to clear avatar", error);
  }
}

function setAvatarPreview(src) {
  if (!(avatarPreview instanceof HTMLElement)) return;

  const img = avatarPreview.querySelector("img");
  const placeholder = avatarPreview.querySelector(".profileAvatarPlaceholder");

  if (img instanceof HTMLImageElement) {
    if (src) img.src = src;
    else img.removeAttribute("src");
  }

  avatarPreview.classList.toggle("hasImage", Boolean(src));

  if (placeholder instanceof HTMLElement) {
    placeholder.hidden = Boolean(src);
  }
}

function showAvatarBlock(show) {
  setVisible(avatarBlock, show);
}

function syncAvatar(userId) {
  const src = loadAvatar(userId);
  setAvatarPreview(src);
  setAvatarStatus(src ? "" : "Choose a picture to personalize your account.");
}

/** ---------- profile summary ---------- */

function toggleProfileExtras(show) {
  setVisible(profilePostsCard, show);
  setVisible(profileArticlesCard, show);
}

function updateProfileSummary(metadata = {}) {
  profileMetadata = metadata || {};

  const displayName =
    profileMetadata.displayName ||
    profileMetadata.full_name ||
    profileMetadata.name ||
    "";

  const bio = profileMetadata.bio || "";

  if (profileNameDisplay instanceof HTMLElement) {
    setText(profileNameDisplay, displayName || "Profile");
  }

  if (profileBioDisplay instanceof HTMLElement) {
    setText(profileBioDisplay, bio || "Add a short description to personalize your profile.");
    profileBioDisplay.classList.toggle("muted", !bio);
  }
}

function setProfileEditStatus(message, tone = "muted") {
  if (!(profileEditStatus instanceof HTMLElement)) return;
  setText(profileEditStatus, message || "");
  profileEditStatus.className = `${tone} small`;
  profileEditStatus.hidden = !message;
}

function setProfileSummaryVisible(show) {
  const visible = Boolean(show);
  setVisible(profileSummary, visible);

  // If the summary is hidden, make sure the popup is closed too
  if (!visible) closeProfileEditOverlay();

  if (profileEditToggle instanceof HTMLElement) {
    profileEditToggle.disabled = !visible;
  }
}

/** ---------- posts ---------- */

function formatDate(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString();
}

function renderUserPosts(posts) {
  if (!(profilePosts instanceof HTMLElement)) return;
  profilePosts.innerHTML = "";

  if (!posts?.length) {
    const p = document.createElement("p");
    p.className = "muted";
    p.textContent = "No posts yet. Share something on the Lore Board to see it here.";
    profilePosts.appendChild(p);
    return;
  }

  posts.forEach((post) => {
    const article = document.createElement("article");
    article.className = "card";
    article.dataset.id = post.id;

    const body = document.createElement("p");
    body.className = "post-content";
    body.style.whiteSpace = "pre-wrap";
    body.textContent = post.content || "";

    const meta = document.createElement("p");
    meta.className = "muted small postMetaRow";
    meta.textContent = formatDate(post.created_at);

    article.append(body, meta);
    profilePosts.appendChild(article);
  });
}

async function loadUserPosts(userId) {
  if (!(profilePosts instanceof HTMLElement)) return;

  if (!userId) {
    profilePosts.innerHTML = "";
    return;
  }

  profilePosts.innerHTML = '<p class="muted">Loading your posts...</p>';

  try {
    const { data, error } = await supabase
      .from("posts")
      .select("id, content, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    renderUserPosts(data || []);
  } catch (error) {
    console.error("Unable to load user posts", error);
    profilePosts.innerHTML = "";
    const message = document.createElement("p");
    message.className = "error";
    message.textContent = error?.message || "Unable to load your posts right now.";
    profilePosts.appendChild(message);
  }
}

/** ---------- articles ---------- */

function escapeHtml(input) {
  const div = document.createElement("div");
  div.textContent = input ?? "";
  return div.innerHTML;
}

function looksLikeHtml(input) {
  const s = String(input || "").trim();
  return /<\s*\/?\s*[a-z][\s\S]*?>/i.test(s);
}

function normalizeStoredContentToHtml(content) {
  const raw = String(content || "");
  if (!raw.trim()) return "";
  if (looksLikeHtml(raw)) return raw;

  // Plain-text fallback: preserve line breaks.
  const escaped = escapeHtml(raw);
  const withBreaks = escaped.replace(/\n/g, "<br>");
  return `<p>${withBreaks}</p>`;
}

function htmlToPlainText(html) {
  const s = String(html || "").trim();
  if (!s) return "";
  try {
    const doc = new DOMParser().parseFromString(s, "text/html");
    return (doc.body?.textContent || "").replace(/\s+\n/g, "\n").trim();
  } catch {
    return s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  }
}

function makeExcerpt(text, max = 220) {
  const value = (text || "").trim();
  if (!value) return "";
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

function sanitizeArticleHtml(dirtyHtml) {
  const allowedTags = new Set([
    "p", "div", "span", "br",
    "strong", "b", "em", "i", "u", "s",
    "ul", "ol", "li",
    "blockquote",
    "h2", "h3", "h4",
    "a", "hr",
    "img",
  ]);

  const allowedGlobalAttrs = new Set(["class", "style"]);
  const allowedLinkAttrs = new Set(["href", "target", "rel"]);
  const allowedImgAttrs = new Set(["src", "alt", "loading", "width", "height", "class", "style"]);

  const html = String(dirtyHtml || "");
  if (!html.trim()) return "";

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const root = doc.body;

  const walk = (node) => {
    if (!(node instanceof Element)) return;

    const tag = node.tagName.toLowerCase();
    if (!allowedTags.has(tag)) {
      // Replace unknown tags with their children (keeps text).
      const parent = node.parentNode;
      if (parent) {
        while (node.firstChild) parent.insertBefore(node.firstChild, node);
        parent.removeChild(node);
      }
      return;
    }

    // Strip disallowed attributes and any inline event handlers.
    const attrs = Array.from(node.attributes || []);
    attrs.forEach((attr) => {
      const name = attr.name.toLowerCase();
      if (name.startsWith("on")) {
        node.removeAttribute(attr.name);
        return;
      }

      if (tag === "a") {
        if (!allowedGlobalAttrs.has(name) && !allowedLinkAttrs.has(name)) {
          node.removeAttribute(attr.name);
        }
        return;
      }

      if (tag === "img") {
        if (!allowedImgAttrs.has(name)) node.removeAttribute(attr.name);
        return;
      }

      if (!allowedGlobalAttrs.has(name)) node.removeAttribute(attr.name);
    });

    // Make links safe.
    if (tag === "a") {
      const href = node.getAttribute("href") || "";
      const safe = /^(https?:|mailto:|#)/i.test(href.trim());
      if (!safe) node.removeAttribute("href");
      node.setAttribute("rel", "noopener noreferrer");
      if ((node.getAttribute("target") || "").toLowerCase() === "_blank") {
        node.setAttribute("rel", "noopener noreferrer");
      }
    }

    // Make image src safe.
    if (tag === "img") {
      const src = node.getAttribute("src") || "";
      const safe = /^(https?:|data:image\/)/i.test(src.trim());
      if (!safe) node.removeAttribute("src");
      if (!node.getAttribute("loading")) node.setAttribute("loading", "lazy");
    }

    Array.from(node.children).forEach(walk);
  };

  Array.from(root.children).forEach(walk);
  return root.innerHTML;
}

function createPostAvatarElement(userId) {
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

  const src = loadAvatar(userId);
  if (src) {
    img.src = src;
    placeholder.hidden = true;
  }

  avatar.append(placeholder, img);
  return avatar;
}

function renderUserArticles(articles) {
  if (!(profileArticles instanceof HTMLElement)) return;
  profileArticles.innerHTML = "";

  if (!articles?.length) {
    const p = document.createElement("p");
    p.className = "muted";
    p.textContent = "No articles yet. Publish one from the Posts page to see it here.";
    profileArticles.appendChild(p);
    return;
  }

  articles.forEach((row) => {
    const card = document.createElement("article");
    card.className = "card articleCard";
    card.dataset.id = row.id;

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "articleToggle";
    toggle.setAttribute("aria-expanded", "false");

    const textWrap = document.createElement("div");
    textWrap.className = "articleSummaryText";

    const titleRow = document.createElement("div");
    titleRow.className = "articleTitleRow";

    const title = document.createElement("h3");
    title.className = "articleTitle";
    title.textContent = row.title || "Untitled";

    const chevron = document.createElement("span");
    chevron.className = "articleChevron";
    chevron.setAttribute("aria-hidden", "true");
    chevron.textContent = "▾";

    titleRow.append(title, chevron);

    let coverPreview = null;
    if (row?.image_url) {
      coverPreview = document.createElement("img");
      coverPreview.className = "articleCoverPreview";
      coverPreview.loading = "lazy";
      coverPreview.alt = `Cover image for ${row.title || "article"}`;
      coverPreview.src = row.image_url;
      card.classList.add("hasCoverThumb");
    }

    const metaText = document.createElement("p");
    metaText.className = "muted small articleMeta";
    metaText.textContent = formatDate(row.created_at);
    metaText.style.margin = "0";

    const byline = document.createElement("div");
    byline.className = "articleByline";
    byline.append(createPostAvatarElement(row.user_id), metaText);

    const excerpt = document.createElement("p");
    excerpt.className = "muted articleExcerpt";
    const normalized = normalizeStoredContentToHtml(row.content || "");
    const sanitized = sanitizeArticleHtml(normalized);
    const plain = htmlToPlainText(sanitized);
    excerpt.textContent = plain ? makeExcerpt(plain, 220) : "";

    textWrap.append(titleRow);
    if (coverPreview) textWrap.appendChild(coverPreview);
    textWrap.append(byline, excerpt);

    toggle.appendChild(textWrap);

    const bodyWrap = document.createElement("div");
    bodyWrap.className = "articleBody";
    bodyWrap.hidden = true;
    bodyWrap.id = `profile-article-body-${row.id}`;

    const body = document.createElement("div");
    body.className = "rtContent";
    body.innerHTML = sanitized || "";
    bodyWrap.appendChild(body);

    toggle.setAttribute("aria-controls", bodyWrap.id);
    toggle.addEventListener("click", () => {
      const open = bodyWrap.hidden;
      bodyWrap.hidden = !open;
      toggle.setAttribute("aria-expanded", String(open));
      card.classList.toggle("isOpen", open);
    });

    card.append(toggle, bodyWrap);
    profileArticles.appendChild(card);
  });
}

async function loadUserArticles(userId) {
  if (!(profileArticles instanceof HTMLElement)) return;

  if (!userId) {
    profileArticles.innerHTML = "";
    return;
  }

  profileArticles.innerHTML = '<p class="muted">Loading your articles...</p>';

  try {
    const { data, error } = await supabase
      .from("articles")
      .select("id, title, content, image_url, created_at, user_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    renderUserArticles(data || []);
  } catch (error) {
    console.error("Unable to load user articles", error);
    profileArticles.innerHTML = "";
    const message = document.createElement("p");
    message.className = "error";
    const msg = String(error?.message || "").toLowerCase();
    const hint =
      msg.includes("relation") || msg.includes("does not exist")
        ? " (Looks like the 'articles' table isn't created in Supabase yet.)"
        : "";
    message.textContent = (error?.message || "Unable to load your articles right now.") + hint;
    profileArticles.appendChild(message);
  }
}

/** ---------- auth-driven rendering ---------- */

function showGuestState(message = "You're not logged in yet.") {
  setLoginStateFlag(false);
  activeUserId = null;
  profileMetadata = {};

  closeProfileEditOverlay();

  setVisible(guestNotice, true);
  showAvatarBlock(false);
  setAvatarPreview(null);
  setAvatarStatus("");

  toggleProfileExtras(false);
  setProfileSummaryVisible(false);

  // keep defaults safe if the summary is later shown
  if (profileNameDisplay instanceof HTMLElement) setText(profileNameDisplay, "Profile");
  if (profileBioDisplay instanceof HTMLElement)
    setText(profileBioDisplay, "Share a short description for your profile.");

  if (profilePosts instanceof HTMLElement) profilePosts.innerHTML = "";
  if (profileArticles instanceof HTMLElement) profileArticles.innerHTML = "";

  setStatus(message);
}

function renderProfile(user) {
  setLoginStateFlag(true);
  activeUserId = user?.id || null;

  setVisible(guestNotice, false);

  showAvatarBlock(true);
  toggleProfileExtras(true);

  // ✅ Always show display name + bio BEFORE clicking Edit
  setProfileSummaryVisible(true);

  syncAvatar(activeUserId);

  const metadata = user?.user_metadata || {};
  updateProfileSummary(metadata);

  loadUserPosts(activeUserId);
  loadUserArticles(activeUserId);

  setStatus("");
}

/** ---------- event handlers ---------- */

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function handleAvatarChange(event) {
  const file = event.target?.files?.[0];
  if (!file) return;

  if (!activeUserId) {
    setAvatarStatus("Log in to update your picture.");
    return;
  }

  const maxSizeBytes = 2 * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    setAvatarStatus("Please choose an image under 2 MB.");
    if (avatarInput) avatarInput.value = "";
    return;
  }

  setAvatarStatus("Uploading your picture...");
  try {
    const dataUrl = await readFileAsDataUrl(file);
    if (typeof dataUrl === "string") {
      saveAvatar(activeUserId, dataUrl);
      setAvatarPreview(dataUrl);

      window.dispatchEvent(
        new CustomEvent("profile:avatarUpdated", {
          detail: { userId: activeUserId, src: dataUrl },
        })
      );

      setAvatarStatus("Saved. Your picture now appears in the menu.");
    }
  } catch (error) {
    console.error("Unable to read avatar file", error);
    setAvatarStatus("Unable to read that file. Try another image.");
  } finally {
    if (avatarInput) avatarInput.value = "";
  }
}

function handleAvatarReset() {
  if (!activeUserId) return;
  clearAvatar(activeUserId);
  setAvatarPreview(null);

  window.dispatchEvent(
    new CustomEvent("profile:avatarUpdated", {
      detail: { userId: activeUserId, src: null },
    })
  );

  setAvatarStatus("Picture removed. You can add one anytime.");
}

async function handleProfileEditSubmit(event) {
  event.preventDefault();

  if (!activeUserId) {
    setProfileEditStatus("Log in to update your profile.", "error");
    return;
  }

  const displayName =
    profileNameInput instanceof HTMLInputElement ? profileNameInput.value.trim() : "";
  const bio = profileBioInput instanceof HTMLTextAreaElement ? profileBioInput.value.trim() : "";

  if (!displayName) {
    setProfileEditStatus("Please enter a display name.", "error");
    return;
  }

  setProfileEditStatus("Saving your changes...");
  try {
    const { error } = await supabase.auth.updateUser({
      data: { displayName, bio },
    });
    if (error) throw error;

    profileMetadata = { ...profileMetadata, displayName, bio };
    updateProfileSummary(profileMetadata);

    setProfileEditStatus("Profile updated successfully!", "success");

    // close the popup after a short moment
    setTimeout(() => closeProfileEditOverlay(), 650);
  } catch (error) {
    console.error("Unable to update profile text", error);
    setProfileEditStatus(error?.message || "Unable to save changes.", "error");
  }
}

function handleProfileEditToggle() {
  if (!activeUserId) {
    setProfileEditStatus("Log in to update your profile.", "error");
    return;
  }
  openProfileEditOverlay();
}

function handleProfileEditCancel() {
  closeProfileEditOverlay();
}

/** ---------- boot ---------- */

async function loadProfile() {
  setStatus("Checking your session...");
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;

    const user = data?.session?.user ?? null;
    if (!user) return showGuestState();

    renderProfile(user);
  } catch (error) {
    console.error("Unable to load profile", error);
    showGuestState("Unable to load your profile right now.");
  }
}

function init() {
  avatarInput?.addEventListener("change", handleAvatarChange);
  avatarReset?.addEventListener("click", handleAvatarReset);

  // popup edit
  profileEditToggle?.addEventListener("click", handleProfileEditToggle);
  profileEditCloseBtn?.addEventListener("click", closeProfileEditOverlay);
  profileEditCancel?.addEventListener("click", handleProfileEditCancel);

  // click outside closes
  profileEditOverlay?.addEventListener("click", (e) => {
    if (e.target === profileEditOverlay) closeProfileEditOverlay();
  });

  // ESC closes
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && document.body.classList.contains("isEditingProfile")) {
      closeProfileEditOverlay();
    }
  });

  // save submit
  profileEditForm?.addEventListener("submit", handleProfileEditSubmit);

  supabase.auth.onAuthStateChange((_event, session) => {
    const user = session?.user ?? null;
    if (!user) return showGuestState("Signed out. Log in to view your profile.");
    renderProfile(user);
  });

  loadProfile();
}

init();
