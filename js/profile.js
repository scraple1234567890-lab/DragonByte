import { supabase } from "./supabaseClient.js";

const statusEl = document.getElementById("profileStatus");
const guestNotice = document.getElementById("profileGuestNotice");
const avatarBlock = document.getElementById("profileAvatarBlock");
const avatarPreview = document.getElementById("profileAvatarPreview");
const avatarPreviewImg = avatarPreview?.querySelector("img");
const avatarPlaceholder = avatarPreview?.querySelector(".profileAvatarPlaceholder");
const avatarInput = document.getElementById("profileAvatarInput");
const avatarReset = document.getElementById("profileAvatarReset");
const avatarStatus = document.getElementById("profileAvatarStatus");
const profileSummary = document.getElementById("profileSummary");
const profileSummaryText = document.getElementById("profileSummaryText");
const profileNameDisplay = document.getElementById("profileNameDisplay");
const profileBioDisplay = document.getElementById("profileBioDisplay");
const profileEditToggle = document.getElementById("profileEditToggle");
const profileEditForm = document.getElementById("profileEditForm");
const profileNameInput = document.getElementById("profileNameInput");
const profileBioInput = document.getElementById("profileBioInput");
const profileEditStatus = document.getElementById("profileEditStatus");
const profileEditCancel = document.getElementById("profileEditCancel");
// NEW: modal wrapper (Edit UI lives in an overlay now)
const profileEditOverlay = document.getElementById("profileEditOverlay");
const profileEditCloseBtn = document.getElementById("profileEditCloseBtn");
const profileArticles = document.getElementById("profileArticles");
const profileArticlesCard = document.getElementById("profileArticlesCard");

const LOGIN_STATE_KEY = "auth:isLoggedIn";
const AVATAR_KEY_PREFIX = "profile:avatar:";

let activeUserId = null;
let profileMetadata = {};
let userArticlesCache = [];

function setStatus(message, tone = "muted") {
  if (!statusEl) return;
  statusEl.textContent = message || "";
  statusEl.className = `${tone} small`;
  statusEl.hidden = !message;
}

function setAvatarStatus(message) {
  if (!(avatarStatus instanceof HTMLElement)) return;
  avatarStatus.textContent = message || "";
  avatarStatus.hidden = !message;
}

function setLoginStateFlag(isLoggedIn) {
  try {
    if (isLoggedIn) {
      localStorage.setItem(LOGIN_STATE_KEY, "true");
    } else {
      localStorage.removeItem(LOGIN_STATE_KEY);
    }
  } catch (error) {
    console.warn("Unable to persist auth visibility state", error);
  }
}

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
  if (!(avatarPreview instanceof HTMLElement) || !(avatarPreviewImg instanceof HTMLImageElement)) return;
  if (src) {
    avatarPreviewImg.src = src;
    avatarPreview.classList.add("hasImage");
  } else {
    avatarPreviewImg.removeAttribute("src");
    avatarPreview.classList.remove("hasImage");
  }
  if (avatarPlaceholder instanceof HTMLElement) {
    avatarPlaceholder.hidden = Boolean(src);
  }
}

function showAvatarBlock(show) {
  if (avatarBlock instanceof HTMLElement) {
    avatarBlock.hidden = !show;
  }
}

function syncAvatar(userId) {
  const src = loadAvatar(userId);
  setAvatarPreview(src);
  setAvatarStatus(src ? "" : "Choose a picture to personalize your account.");
}

function toggleProfileExtras(show) {
  if (profileArticlesCard instanceof HTMLElement) profileArticlesCard.hidden = !show;
}

function makeExcerpt(text, max = 240) {
  const value = (text || "").trim();
  if (!value) return "";
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

function escapeHtml(input) {
  const div = document.createElement("div");
  div.textContent = input ?? "";
  return div.innerHTML;
}

function looksLikeHtml(input) {
  const s = String(input || "").trim();
  return /<\s*\/?\s*[a-z][\s\S]*?>/i.test(s);
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

function normalizeStoredContentToHtml(content) {
  const raw = String(content || "");
  if (!raw.trim()) return "";
  if (looksLikeHtml(raw)) return raw;

  const escaped = escapeHtml(raw);
  const withBreaks = escaped.replace(/\n/g, "<br>");
  return `<p>${withBreaks}</p>`;
}

// Keep profile page rendering safe (mirrors the Posts page sanitizer).
function sanitizeArticleHtml(dirtyHtml) {
  const allowedTags = new Set([
    "p", "div", "span", "br", "strong", "b", "em", "i", "u", "s",
    "ul", "ol", "li",
    "blockquote",
    "h2", "h3", "h4",
    "a", "hr",
    "img",
  ]);

  const allowedImageClasses = new Set([
    "rt-img",
    "rt-img--sm", "rt-img--md", "rt-img--lg", "rt-img--full",
    "rt-align--left", "rt-align--center", "rt-align--right",
  ]);
  for (let i = 10; i <= 100; i += 1) allowedImageClasses.add(`rt-w-${i}`);

  const isSafeUrl = (url, kind) => {
    const value = String(url || "").trim();
    if (!value) return false;
    const lower = value.toLowerCase();
    if (lower.startsWith("javascript:")) return false;
    if (lower.startsWith("data:")) return false;
    if (kind === "link" && lower.startsWith("mailto:")) return true;
    try {
      const u = new URL(value, window.location.origin);
      return u.protocol === "http:" || u.protocol === "https:";
    } catch {
      return false;
    }
  };

  const filterClassList = (classValue) => {
    const raw = String(classValue || "");
    if (!raw.trim()) return "";
    const kept = raw
      .split(/\s+/)
      .map((c) => c.trim())
      .filter((c) => allowedImageClasses.has(c));
    return Array.from(new Set(kept)).join(" ");
  };

  const wrapHtml = `<div id="__rt_root__">${dirtyHtml || ""}</div>`;
  let doc;
  try {
    doc = new DOMParser().parseFromString(wrapHtml, "text/html");
  } catch {
    return "";
  }

  const root = doc.getElementById("__rt_root__");
  if (!root) return "";

  const cleanNode = (node) => {
    if (node.nodeType === Node.TEXT_NODE) return;

    if (node.nodeType !== Node.ELEMENT_NODE) {
      node.remove();
      return;
    }

    const el = node;
    const tag = el.tagName.toLowerCase();

    if (!allowedTags.has(tag)) {
      const parent = el.parentNode;
      if (!parent) {
        el.remove();
        return;
      }
      while (el.firstChild) parent.insertBefore(el.firstChild, el);
      el.remove();
      return;
    }

    // Convert styled spans into semantic tags.
    if (tag === "span") {
      const style = String(el.getAttribute("style") || "").toLowerCase();
      const wantsBold = /font-weight\s*:\s*(bold|[5-9]00)/.test(style);
      const wantsItalic = /font-style\s*:\s*italic/.test(style);
      const wantsUnderline = /text-decoration\s*:\s*[^;]*underline/.test(style);
      const wantsStrike = /text-decoration\s*:\s*[^;]*(line-through|strikethrough)/.test(style);

      const wrappers = [];
      if (wantsBold) wrappers.push("strong");
      if (wantsItalic) wrappers.push("em");
      if (wantsUnderline) wrappers.push("u");
      if (wantsStrike) wrappers.push("s");

      const parent = el.parentNode;
      if (!wrappers.length) {
        if (!parent) {
          el.remove();
          return;
        }
        while (el.firstChild) parent.insertBefore(el.firstChild, el);
        el.remove();
        return;
      }

      let outer = doc.createElement(wrappers[0]);
      let current = outer;
      for (let i = 1; i < wrappers.length; i += 1) {
        const next = doc.createElement(wrappers[i]);
        current.appendChild(next);
        current = next;
      }
      while (el.firstChild) current.appendChild(el.firstChild);
      el.replaceWith(outer);
      cleanNode(outer);
      return;
    }

    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      const value = attr.value;

      if (name.startsWith("on")) {
        el.removeAttribute(attr.name);
        continue;
      }

      if (tag === "a") {
        if (name === "href") {
          if (!isSafeUrl(value, "link")) el.removeAttribute(attr.name);
          continue;
        }
        if (name === "target" || name === "rel") {
          el.removeAttribute(attr.name);
          continue;
        }
        if (name !== "href") el.removeAttribute(attr.name);
        continue;
      }

      if (tag === "img") {
        if (name === "src") {
          if (!isSafeUrl(value, "img")) el.removeAttribute(attr.name);
          continue;
        }
        if (name === "alt") continue;
        if (name === "class") {
          const filtered = filterClassList(value);
          if (filtered) el.setAttribute("class", filtered);
          else el.removeAttribute("class");
          continue;
        }
        el.removeAttribute(attr.name);
        continue;
      }

      el.removeAttribute(attr.name);
    }

    if (tag === "a" && el.getAttribute("href")) {
      el.setAttribute("target", "_blank");
      el.setAttribute("rel", "noopener noreferrer");
    }

    for (const child of Array.from(el.childNodes)) {
      cleanNode(child);
    }
  };

  for (const child of Array.from(root.childNodes)) {
    cleanNode(child);
  }

  const cleaned = root.innerHTML.trim();
  if (cleaned && !looksLikeHtml(cleaned)) {
    return `<p>${escapeHtml(htmlToPlainText(cleaned))}</p>`;
  }
  return cleaned;
}

function createAvatarElement(userId) {
  const avatar = document.createElement("span");
  avatar.className = "profileAvatar profileAvatar--post";
  avatar.dataset.avatarUser = userId || "";

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

  const src = userId ? loadAvatar(userId) : null;
  if (src) {
    img.src = src;
    avatar.classList.add("hasImage");
    placeholder.hidden = true;
  }

  avatar.append(placeholder, img);
  return avatar;
}

function refreshInlineAvatars(userId, src) {
  if (!profileArticles || !userId) return;
  const nodes = profileArticles.querySelectorAll(`[data-avatar-user="${CSS.escape(userId)}"]`);
  nodes.forEach((avatar) => {
    const img = avatar.querySelector("img");
    const placeholder = avatar.querySelector(".profileAvatarPlaceholder");
    if (!(img instanceof HTMLImageElement)) return;

    if (src) {
      img.src = src;
      avatar.classList.add("hasImage");
      if (placeholder instanceof HTMLElement) placeholder.hidden = true;
    } else {
      img.removeAttribute("src");
      avatar.classList.remove("hasImage");
      if (placeholder instanceof HTMLElement) placeholder.hidden = false;
    }
  });
}

// Summary container should show the read-only display name + bio by default.
function setProfileSummaryVisible(show) {
  if (profileSummary instanceof HTMLElement) {
    profileSummary.hidden = !show;
    profileSummary.setAttribute("aria-hidden", String(!show));
  }
  if (profileSummaryText instanceof HTMLElement) {
    profileSummaryText.hidden = !show;
    profileSummaryText.setAttribute("aria-hidden", String(!show));
  }
  if (!show) {
    setProfileEditVisible(false);
  }
  if (profileEditToggle instanceof HTMLElement) {
    profileEditToggle.disabled = !show;
    profileEditToggle.setAttribute("aria-hidden", String(!show));
  }
}

function updateProfileSummary(metadata = {}) {
  profileMetadata = metadata || {};
  const displayName =
    profileMetadata.displayName ||
    profileMetadata.display_name ||
    profileMetadata.full_name ||
    profileMetadata.name ||
    "";
  const bio = profileMetadata.bio || "";

  if (profileNameDisplay) {
    profileNameDisplay.textContent = displayName || "Profile";
  }
  if (profileBioDisplay) {
    profileBioDisplay.textContent = bio || "Add a short description to personalize your profile.";
    profileBioDisplay.classList.toggle("muted", !bio);
  }

  if (profileNameInput instanceof HTMLInputElement && !profileEditForm?.hidden) {
    profileNameInput.value = displayName || "";
  }
  if (profileBioInput instanceof HTMLTextAreaElement && !profileEditForm?.hidden) {
    profileBioInput.value = bio || "";
  }
}

function setProfileEditStatus(message, tone = "muted") {
  if (!(profileEditStatus instanceof HTMLElement)) return;
  profileEditStatus.textContent = message || "";
  profileEditStatus.className = `${tone} small`;
  profileEditStatus.hidden = !message;
}

function setProfileEditVisible(show) {
  const isOpen = Boolean(show);
  if (profileEditForm instanceof HTMLElement) {
    profileEditForm.hidden = !isOpen;
    profileEditForm.setAttribute("aria-hidden", String(!isOpen));
  }

  // Modal wrapper: CSS reveals the overlay when the body has .isEditingProfile
  if (profileEditOverlay instanceof HTMLElement) {
    profileEditOverlay.setAttribute("aria-hidden", String(!isOpen));
  }
  document.body.classList.toggle("isEditingProfile", isOpen);

  if (profileEditToggle instanceof HTMLElement) {
    profileEditToggle.classList.toggle("isActive", isOpen);
    profileEditToggle.setAttribute("aria-expanded", String(isOpen));
  }

  if (isOpen) {
    const displayName =
      profileMetadata.displayName ||
      profileMetadata.display_name ||
      profileMetadata.full_name ||
      profileMetadata.name ||
      "";
    const bio = profileMetadata.bio || "";
    if (profileNameInput instanceof HTMLInputElement) profileNameInput.value = displayName || "";
    if (profileBioInput instanceof HTMLTextAreaElement) profileBioInput.value = bio || "";
    setProfileEditStatus("You can update your profile text now.");

    // focus after paint so keyboard users land in the form
    setTimeout(() => profileNameInput?.focus?.(), 50);
  } else {
    setProfileEditStatus("");
  }
}

function formatDate(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString();
}

function renderUserArticles(articles) {
  if (!profileArticles) return;
  profileArticles.innerHTML = "";

  if (!articles.length) {
    const p = document.createElement("p");
    p.className = "muted";
    p.textContent = "No articles yet. Write an article on the Posts page to see it here.";
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

    const metaRow = document.createElement("div");
    metaRow.className = "articleMetaRow";

    const avatar = createAvatarElement(activeUserId);

    const textWrap = document.createElement("div");
    textWrap.className = "articleSummaryText";

    const title = document.createElement("h3");
    title.className = "articleTitle";
    title.textContent = row.title || "Untitled";

    const metaText = document.createElement("p");
    metaText.className = "muted small articleMeta";
    metaText.textContent = formatDate(row.created_at);

    const excerpt = document.createElement("p");
    excerpt.className = "muted articleExcerpt";
    const normalizedContent = normalizeStoredContentToHtml(row.content || "");
    const sanitizedContent = sanitizeArticleHtml(normalizedContent);
    const plainContent = htmlToPlainText(sanitizedContent);
    excerpt.textContent = plainContent
      ? makeExcerpt(plainContent, 220)
      : /<\s*img\b/i.test(sanitizedContent)
      ? "Image"
      : "";

    textWrap.append(title, metaText, excerpt);

    let thumb = null;
    if (row?.image_url) {
      thumb = document.createElement("img");
      thumb.className = "articleCoverThumb";
      thumb.loading = "lazy";
      thumb.alt = "";
      thumb.src = row.image_url;
    }

    const chevron = document.createElement("span");
    chevron.className = "articleChevron";
    chevron.setAttribute("aria-hidden", "true");
    chevron.textContent = "▾";

    metaRow.append(avatar, textWrap);
    if (thumb) metaRow.appendChild(thumb);
    metaRow.appendChild(chevron);
    toggle.appendChild(metaRow);

    const bodyWrap = document.createElement("div");
    bodyWrap.className = "articleBody";
    bodyWrap.hidden = true;
    bodyWrap.id = `profile-article-body-${row.id}`;

    if (row?.image_url) {
      const cover = document.createElement("img");
      cover.className = "articleCover";
      cover.loading = "lazy";
      cover.alt = `Cover image for ${row.title || "article"}`;
      cover.src = row.image_url;
      bodyWrap.appendChild(cover);
    }

    const body = document.createElement("div");
    body.className = "rtContent";
    body.innerHTML = sanitizedContent || "";
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
  if (!profileArticles) return;
  if (!userId) {
    profileArticles.innerHTML = "";
    return;
  }

  profileArticles.innerHTML = '<p class="muted">Loading your articles...</p>';

  try {
    const { data, error } = await supabase
      .from("articles")
      .select("id, title, content, image_url, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    userArticlesCache = data || [];
    renderUserArticles(userArticlesCache);
  } catch (error) {
    console.error("Unable to load user articles", error);
    profileArticles.innerHTML = "";
    const message = document.createElement("p");
    message.className = "error";
    message.textContent = error?.message || "Unable to load your articles right now.";
    profileArticles.appendChild(message);
  }
}

function showGuestState(message = "You’re not logged in yet.") {
  setLoginStateFlag(false);
  activeUserId = null;
  profileMetadata = {};
  userArticlesCache = [];
  setProfileEditVisible(false);
  if (guestNotice instanceof HTMLElement) guestNotice.hidden = false;
  showAvatarBlock(false);
  setAvatarPreview(null);
  setAvatarStatus("");
  toggleProfileExtras(false);
  // hide summary container and text for guests
  setProfileSummaryVisible(false);
  if (profileNameDisplay) profileNameDisplay.textContent = "Profile";
  if (profileBioDisplay) profileBioDisplay.textContent = "Share a short description for your profile.";
  if (profileArticles) profileArticles.innerHTML = "";
  setStatus(message);
}

function renderProfile(user) {
  setLoginStateFlag(true);
  activeUserId = user?.id || null;

  if (guestNotice instanceof HTMLElement) guestNotice.hidden = true;
  showAvatarBlock(true);
  toggleProfileExtras(true);
  // show the summary container (display name + bio) and the Edit button
  setProfileSummaryVisible(true);
  setProfileEditVisible(false);

  syncAvatar(user?.id);
  const metadata = user?.user_metadata || {};
  updateProfileSummary(metadata);
  loadUserArticles(user?.id);

  setStatus("");
}

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
      refreshInlineAvatars(activeUserId, dataUrl);
      window.dispatchEvent(
        new CustomEvent("profile:avatarUpdated", { detail: { userId: activeUserId, src: dataUrl } }),
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
  refreshInlineAvatars(activeUserId, null);
  window.dispatchEvent(new CustomEvent("profile:avatarUpdated", { detail: { userId: activeUserId, src: null } }));
  setAvatarStatus("Picture removed. You can add one anytime.");
}

async function handleProfileEditSubmit(event) {
  event.preventDefault();
  if (!activeUserId) {
    setProfileEditStatus("Log in to update your profile.", "error");
    return;
  }

  const displayName = profileNameInput instanceof HTMLInputElement ? profileNameInput.value.trim() : "";
  const bio = profileBioInput instanceof HTMLTextAreaElement ? profileBioInput.value.trim() : "";

  setProfileEditStatus("Saving your changes...");
  try {
    const { error } = await supabase.auth.updateUser({ data: { displayName, bio } });
    if (error) throw error;

    profileMetadata = { ...profileMetadata, displayName, bio };
    updateProfileSummary(profileMetadata);
    setProfileEditStatus("Profile updated.");
    setProfileEditVisible(false);
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
  const isOpen = !(profileEditForm instanceof HTMLElement) ? false : profileEditForm.hidden;
  setProfileEditVisible(isOpen);
}

function handleProfileEditCancel() {
  setProfileEditVisible(false);
}

async function loadProfile() {
  setStatus("Checking your session...");
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      throw error;
    }
    const user = data?.session?.user ?? null;
    if (!user) {
      showGuestState();
      return;
    }
    renderProfile(user);
  } catch (error) {
    console.error("Unable to load profile", error);
    showGuestState("Unable to load your profile right now.");
  }
}

function init() {
  avatarInput?.addEventListener("change", handleAvatarChange);
  avatarReset?.addEventListener("click", handleAvatarReset);

  supabase.auth.onAuthStateChange((_event, session) => {
    const user = session?.user ?? null;
    if (!user) {
      showGuestState("Signed out. Log in to view your profile.");
      return;
    }
    renderProfile(user);
  });

  profileEditForm?.addEventListener("submit", handleProfileEditSubmit);
  profileEditToggle?.addEventListener("click", handleProfileEditToggle);
  profileEditCancel?.addEventListener("click", handleProfileEditCancel);
  profileEditCloseBtn?.addEventListener("click", () => setProfileEditVisible(false));

  // Click outside the card closes the modal
  profileEditOverlay?.addEventListener("click", (e) => {
    if (e.target === profileEditOverlay) setProfileEditVisible(false);
  });

  // ESC closes the modal
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && document.body.classList.contains("isEditingProfile")) {
      setProfileEditVisible(false);
    }
  });

  // If the avatar changes in another tab, update inline avatars too.
  window.addEventListener("storage", (event) => {
    if (!event.key || !event.key.startsWith(AVATAR_KEY_PREFIX)) return;
    const userId = event.key.slice(AVATAR_KEY_PREFIX.length);
    refreshInlineAvatars(userId, loadAvatar(userId));
  });

  window.addEventListener("profile:avatarUpdated", (event) => {
    const userId = event.detail?.userId;
    if (!userId) return;
    refreshInlineAvatars(userId, event.detail?.src || null);
  });

  loadProfile();
}

init();
