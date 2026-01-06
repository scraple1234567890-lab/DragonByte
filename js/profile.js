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
const profileArticles = document.getElementById("profileArticles");
const profileArticlesCard = document.getElementById("profileArticlesCard");

const LOGIN_STATE_KEY = "auth:isLoggedIn";
const AVATAR_KEY_PREFIX = "profile:avatar:";

let activeUserId = null;
let profileMetadata = {};

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

// Modified: allow controlling whether the read-only summary text is shown
function setProfileSummaryVisible(show, showText = true) {
  if (profileSummary instanceof HTMLElement) {
    profileSummary.hidden = !show;
    profileSummary.setAttribute("aria-hidden", String(!show));
  }
  if (profileSummaryText instanceof HTMLElement) {
    const textVisible = Boolean(show && showText);
    profileSummaryText.hidden = !textVisible;
    profileSummaryText.setAttribute("aria-hidden", String(!textVisible));
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
  const displayName = profileMetadata.displayName || profileMetadata.full_name || profileMetadata.name || "";
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
}

function setProfileEditVisible(show) {
  const isOpen = Boolean(show);
  if (profileEditForm instanceof HTMLElement) {
    profileEditForm.hidden = !isOpen;
    profileEditForm.setAttribute("aria-hidden", String(!isOpen));
  }
  if (profileEditToggle instanceof HTMLElement) {
    profileEditToggle.classList.toggle("isActive", isOpen);
    profileEditToggle.setAttribute("aria-expanded", String(isOpen));
  }

  // When edit form opens, reveal the summary text (display name & bio). Hide it again when closing.
  if (profileSummaryText instanceof HTMLElement) {
    profileSummaryText.hidden = !isOpen;
    profileSummaryText.setAttribute("aria-hidden", String(!isOpen));
  }

  if (isOpen) {
    const displayName = profileMetadata.displayName || profileMetadata.full_name || profileMetadata.name || "";
    const bio = profileMetadata.bio || "";
    if (profileNameInput instanceof HTMLInputElement) profileNameInput.value = displayName || "";
    if (profileBioInput instanceof HTMLTextAreaElement) profileBioInput.value = bio || "";
    setProfileEditStatus("You can update your profile text now.");
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
    card.className = "card";
    card.dataset.id = row.id;

    const title = document.createElement("h3");
    title.className = "articleTitle";
    title.textContent = row.title || "Untitled";
    title.style.margin = "0 0 10px 0";

    if (row?.image_url) {
      const cover = document.createElement("img");
      cover.className = "articleCover";
      cover.loading = "lazy";
      cover.alt = `Cover image for ${row.title || "article"}`;
      cover.src = row.image_url;
      cover.style.marginTop = "0";
      cover.style.marginBottom = "10px";
      card.appendChild(title);
      card.appendChild(cover);
    } else {
      card.appendChild(title);
    }

    const meta = document.createElement("p");
    meta.className = "muted small";
    meta.textContent = typeof formatDate === "function" ? formatDate(row.created_at) : (row.created_at || "Unknown");
    meta.style.margin = "0 0 10px 0";

    const excerpt = document.createElement("p");
    excerpt.className = "muted";
    const plain = htmlToPlainText(row.content || "");
    excerpt.textContent = plain ? makeExcerpt(plain, 260) : "";
    excerpt.style.margin = "0";

    card.append(meta, excerpt);
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

    renderUserArticles(data || []);
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
  // show the summary container and edit button, but keep the read-only name/bio hidden until the user clicks Edit
  setProfileSummaryVisible(true, false);
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

  loadProfile();
}

init();
