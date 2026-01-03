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
const profileEditForm = el("profileEditForm"); // form lives INSIDE popup overlay now
const profileNameInput = el("profileNameInput");
const profileBioInput = el("profileBioInput");
const profileEditStatus = el("profileEditStatus");
const profileEditCancel = el("profileEditCancel");

// NEW popup elements (must exist in profile.html)
const profileEditOverlay = el("profileEditOverlay");
const profileEditCloseBtn = el("profileEditCloseBtn");

const profilePosts = el("profilePosts");
const profilePostsCard = el("profilePostsCard");

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

/** ---------- popup helpers (NEW) ---------- */

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

  if (profileNameDisplay instanceof HTMLElement) setText(profileNameDisplay, "Profile");
  if (profileBioDisplay instanceof HTMLElement)
    setText(profileBioDisplay, "Share a short description for your profile.");

  if (profilePosts instanceof HTMLElement) profilePosts.innerHTML = "";

  setStatus(message);
}

function renderProfile(user) {
  setLoginStateFlag(true);
  activeUserId = user?.id || null;

  setVisible(guestNotice, false);

  showAvatarBlock(true);
  toggleProfileExtras(true);
  setProfileSummaryVisible(true);

  syncAvatar(activeUserId);

  const metadata = user?.user_metadata || {};
  updateProfileSummary(metadata);

  loadUserPosts(activeUserId);

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
