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
const articleTagsInput = document.getElementById("article-tags");
const articleTagsHelp = document.getElementById("article-tags-help");
const articleContentInput = document.getElementById("article-content");
const articleEditor = document.getElementById("article-editor");
const articleToolbar = document.getElementById("article-toolbar");
const articleLinkButton = document.getElementById("article-link-btn");
const articleVideoButton = document.getElementById("article-video-btn");
const articleInlineImageButton = document.getElementById("article-inline-image-btn");
const articleInlineImageInput = document.getElementById("article-inline-image");

const articleImageControls = document.getElementById("article-image-controls");
const articleImageSizeSelect = document.getElementById("article-image-size");
const articleImageAlignSelect = document.getElementById("article-image-align");
const articleImageScaleRange = document.getElementById("article-image-scale");
const articleImageScaleNumber = document.getElementById("article-image-scale-number");

const articleImageRemoveButton = document.getElementById("article-image-remove");
const articleImageSelectedLabel = document.getElementById("article-image-selected");
const articleImageInput = document.getElementById("article-image");
const articleImagePreview = document.getElementById("article-image-preview");
const articleImageClearButton = document.getElementById("article-image-clear");
const articleImageHelp = document.getElementById("article-image-help");
const articleStatus = document.getElementById("article-status");
const articlesContainer = document.getElementById("articles");
const articleSubmitButton = document.getElementById("article-submit");
const shareArticleButton = document.getElementById("share-article-btn");
const articleComposerCard = document.getElementById("article-composer-card");
const closeArticleComposerButton = document.getElementById("close-article-composer");

// Article search UI
const articleSearchInput = document.getElementById("article-search");
const articleSearchClearButton = document.getElementById("article-search-clear");
const articleSearchMeta = document.getElementById("article-search-meta");

// Article tag shelf (optional)
const articleTagShelf = document.getElementById("article-tag-shelf");
const articleTagChips = document.getElementById("article-tag-chips");

const articleSearchToggleButton = document.getElementById("article-search-toggle");
const articleSearchPanel = document.getElementById("article-search-panel");

const AVATAR_KEY_PREFIX = "profile:avatar:";
const DISPLAY_NAME_KEY_PREFIX = "profile:displayName:";
const MAX_POST_CHARS = 2000;
const MAX_ARTICLE_TITLE = 120;
const MAX_ARTICLE_CHARS = 12000;
const MAX_ARTICLE_TAGS = 12;
const MAX_ARTICLE_TAG_LEN = 32;
const ARTICLE_IMAGE_BUCKET = "article-images";
const ARTICLE_INLINE_FOLDER = "inline";
// Article cover image optimization (client-side resize + compression).
// Goal: keep uploads fast and lightweight while staying visually crisp.
const MAX_ORIGINAL_IMAGE_BYTES = 15 * 1024 * 1024; // 15MB input cap
const MAX_IMAGE_DIMENSION = 1600; // longest edge after resize
const TARGET_IMAGE_BYTES = 1200 * 1024; // ~1.2MB target
const MAX_OPTIMIZED_IMAGE_BYTES = 1800 * 1024; // ~1.8MB hard-ish ceiling

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

function formatShortDateTime(input) {
  const date = input ? new Date(input) : null;
  if (!date || Number.isNaN(date.getTime())) return "";

  const datePart = date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const timePart = date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

  return `${datePart} · ${timePart}`;
}

function formatShortDate(input) {
  const date = input ? new Date(input) : null;
  if (!date || Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
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

function getDisplayNameStorageKey(userId) {
  return userId ? `${DISPLAY_NAME_KEY_PREFIX}${userId}` : "";
}

function loadStoredDisplayName(userId) {
  const key = getDisplayNameStorageKey(userId);
  if (!key) return "";
  try {
    return localStorage.getItem(key) || "";
  } catch (error) {
    console.warn("Unable to read display name from storage", error);
    return "";
  }
}

function saveStoredDisplayName(userId, displayName) {
  const key = getDisplayNameStorageKey(userId);
  if (!key) return;
  try {
    const value = String(displayName || "").trim();
    if (!value) {
      localStorage.removeItem(key);
      return;
    }
    localStorage.setItem(key, value);
  } catch (error) {
    console.warn("Unable to save display name to storage", error);
  }
}

function getUserDisplayName(user) {
  const meta = user?.user_metadata || {};
  const displayName = meta.displayName || meta.full_name || meta.name || meta.user_name || "";
  return String(displayName || "").trim();
}

function getUserDisplayNameOrFallback(user) {
  const name = getUserDisplayName(user);
  if (name) return name;

  const email = String(user?.email || "").trim();
  if (email && email.includes("@")) return email.split("@")[0];

  return "Member";
}

function getAuthorDisplayName(row) {
  const fromRow = String(row?.author_display_name || row?.author_name || "").trim();
  if (fromRow) {
    if (row?.user_id) saveStoredDisplayName(row.user_id, fromRow);
    return fromRow;
  }

  if (currentUser && row?.user_id && row.user_id === currentUser.id) {
    const fromCurrent = getUserDisplayNameOrFallback(currentUser);
    if (fromCurrent) {
      saveStoredDisplayName(currentUser.id, fromCurrent);
      return fromCurrent;
    }
  }

  const cached = loadStoredDisplayName(row?.user_id);
  if (cached) return cached;

  return "Unknown author";
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

function normalizeTag(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";

  // Allow input like "#networking" and strip leading hashes.
  let t = s.replace(/^#+/, "").trim();

  // Standardize for search + consistency.
  t = t.toLowerCase();

  // Spaces become dashes ("home lab" -> "home-lab").
  t = t.replace(/\s+/g, "-");

  // Keep it URL-ish and predictable.
  t = t.replace(/[^a-z0-9_-]/g, "");

  if (!t) return "";
  return t.slice(0, MAX_ARTICLE_TAG_LEN);
}

function parseTags(raw) {
  const input = String(raw || "");
  if (!input.trim()) return [];

  // Split on commas, but also tolerate users typing "#tag #tag2".
  const parts = input
    .split(/[,\n]/g)
    .flatMap((chunk) => String(chunk).split(/\s+/g))
    .map((p) => p.trim())
    .filter(Boolean);

  const out = [];
  for (const p of parts) {
    const tag = normalizeTag(p);
    if (!tag) continue;
    if (out.includes(tag)) continue;
    out.push(tag);
    if (out.length >= MAX_ARTICLE_TAGS) break;
  }
  return out;
}

function getTagsFromRow(row) {
  const t = row?.tags;
  if (Array.isArray(t)) return t.map(normalizeTag).filter(Boolean);
  if (typeof t === "string") return parseTags(t);
  return [];
}

function formatTagLabel(tag) {
  const t = normalizeTag(tag);
  return t ? `#${t}` : "";
}

function setArticleSearchQuery(query, openPanel = true) {
  if (!(articleSearchInput instanceof HTMLInputElement)) return;
  articleSearchInput.value = query || "";
  applyArticleSearch();

  if (openPanel && articleSearchPanel instanceof HTMLElement) {
    articleSearchPanel.hidden = false;
  }
  if (openPanel && articleSearchToggleButton instanceof HTMLButtonElement) {
    articleSearchToggleButton.setAttribute("aria-expanded", "true");
  }
}

function updateArticleTagShelf(articles) {
  if (!(articleTagShelf instanceof HTMLElement) || !(articleTagChips instanceof HTMLElement)) return;

  const counts = new Map();
  (articles || []).forEach((a) => {
    getTagsFromRow(a).forEach((tag) => {
      counts.set(tag, (counts.get(tag) || 0) + 1);
    });
  });

  // Only show the shelf when we actually have tags.
  const tagsSorted = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 14)
    .map(([tag]) => tag);

  articleTagChips.innerHTML = "";
  if (!tagsSorted.length) {
    articleTagShelf.hidden = true;
    return;
  }

  tagsSorted.forEach((tag) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "articleTag";
    btn.textContent = formatTagLabel(tag);
    btn.setAttribute("aria-label", `Filter by tag ${tag}`);
    btn.addEventListener("click", () => setArticleSearchQuery(`#${tag}`, true));
    articleTagChips.appendChild(btn);
  });

  articleTagShelf.hidden = false;
}

function escapeHtml(input) {
  const div = document.createElement("div");
  div.textContent = input ?? "";
  return div.innerHTML;
}

function looksLikeHtml(input) {
  const s = String(input || "").trim();
  // Basic heuristic: contains a tag-like shape.
  return /<\s*\/?\s*[a-z][\s\S]*?>/i.test(s);
}

function htmlToPlainText(html) {
  const s = String(html || "").trim();
  if (!s) return "";
  try {
    const doc = new DOMParser().parseFromString(s, "text/html");
    return (doc.body?.textContent || "").replace(/\s+\n/g, "\n").trim();
  } catch {
    // fallback: strip tags crudely
    return s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  }
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



function extractYouTubeId(input) {
  const raw = String(input || "").trim();
  if (!raw) return null;

  // If it looks like a full iframe snippet, try to pull src="..." first.
  const mSrc = /src\s*=\s*"([^"]+)"/i.exec(raw);
  const candidate = mSrc ? mSrc[1] : raw;

  // Accept bare IDs (11-ish chars).
  if (/^[a-zA-Z0-9_-]{10,20}$/.test(candidate) && !candidate.includes("/")) {
    return candidate;
  }

  try {
    const u = new URL(candidate);
    const host = u.hostname.toLowerCase();

    if (host === "youtu.be") {
      const id = u.pathname.replace(/^\//, "").split("/")[0];
      return id || null;
    }

    if (host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com")) {
      // watch?v=ID
      const v = u.searchParams.get("v");
      if (v) return v;

      // /embed/ID
      const parts = u.pathname.split("/").filter(Boolean);
      const embedIdx = parts.indexOf("embed");
      if (embedIdx !== -1 && parts[embedIdx + 1]) return parts[embedIdx + 1];

      // /shorts/ID
      const shortsIdx = parts.indexOf("shorts");
      if (shortsIdx !== -1 && parts[shortsIdx + 1]) return parts[shortsIdx + 1];
    }
  } catch {
    // ignore parse errors
  }

  return null;
}
function sanitizeArticleHtml(dirtyHtml) {
  const allowedTags = new Set([
    "p", "div", "span", "br", "strong", "b", "em", "i", "u", "s",
    "ul", "ol", "li",
    "blockquote",
    "h2", "h3", "h4",
    "a", "hr",
    "img",
    "iframe"
  ]);

  const allowedImageClasses = new Set([
    "rt-img",
    "rt-img--sm", "rt-img--md", "rt-img--lg", "rt-img--full",
    "rt-align--left", "rt-align--center", "rt-align--right"
  ]);
  for (let i = 10; i <= 100; i += 1) allowedImageClasses.add(`rt-w-${i}`);


  const isSafeUrl = (url, kind) => {
    const value = String(url || "").trim();
    if (!value) return false;

    // Disallow javascript: and data: (we upload images instead).
    const lower = value.toLowerCase();
    if (lower.startsWith("javascript:")) return false;
    if (lower.startsWith("data:")) return false;

    if (kind === "link" && lower.startsWith("mailto:")) return true;

    if (kind === "iframe") {
      try {
        const u = new URL(value);
        const host = u.hostname.toLowerCase();
        const okHost =
          host === "youtube.com" ||
          host === "www.youtube.com" ||
          host === "youtube-nocookie.com" ||
          host === "www.youtube-nocookie.com";

        if (!okHost) return false;
        if (u.protocol !== "https:") return false;
        if (!u.pathname.startsWith("/embed/")) return false;
        return true;
      } catch {
        return false;
      }
    }

    // Allow http(s) and relative URLs.
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
    // Text nodes are safe.
    if (node.nodeType === Node.TEXT_NODE) return;

    if (node.nodeType !== Node.ELEMENT_NODE) {
      node.remove();
      return;
    }

    const el = node;

    const tag = el.tagName.toLowerCase();
    if (!allowedTags.has(tag)) {
      // Unwrap unknown tags but keep their children.
      const parent = el.parentNode;
      if (!parent) {
        el.remove();
        return;
      }
      while (el.firstChild) parent.insertBefore(el.firstChild, el);
      el.remove();
      return;
    }

    // Convert common inline CSS spans into semantic tags (Chrome can emit spans sometimes).
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
        // No safe/recognized styles; unwrap the span.
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

    // Remove all event handler attributes and disallowed attrs.
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
        // Drop everything else.
        if (name !== "href") el.removeAttribute(attr.name);
        continue;
      }



      if (tag === "iframe") {
        if (name === "src") {
          if (!isSafeUrl(value, "iframe")) el.removeAttribute(attr.name);
          continue;
        }
        if (name === "title") continue;
        if (name === "allow") continue;
        if (name === "allowfullscreen") continue;
        if (name === "referrerpolicy") continue;
        if (name === "loading") continue;
        // Drop everything else.
        el.removeAttribute(attr.name);
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
        // Drop everything else (style, srcset, etc).
        el.removeAttribute(attr.name);
        continue;
      }

      // For other tags: allow no attributes at all (keeps it safe + consistent).
      el.removeAttribute(attr.name);
    }



    // Post-process iframes for safety + consistency.
    if (tag === "iframe") {
      // If src was removed, drop the iframe entirely.
      if (!el.getAttribute("src")) {
        el.remove();
        return;
      }
      if (!el.getAttribute("title")) {
        el.setAttribute("title", "YouTube video");
      }
      if (!el.getAttribute("loading")) {
        el.setAttribute("loading", "lazy");
      }
      if (!el.getAttribute("referrerpolicy")) {
        el.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
      }
    }
    // Post-process links for safety.
    if (tag === "a" && el.getAttribute("href")) {
      el.setAttribute("target", "_blank");
      el.setAttribute("rel", "noopener noreferrer");
    }

    // Clean children (work on a snapshot because we may modify the tree).
    for (const child of Array.from(el.childNodes)) {
      cleanNode(child);
    }
  };

  for (const child of Array.from(root.childNodes)) {
    cleanNode(child);
  }

  // Ensure we only return the cleaned inner HTML.
  const cleaned = root.innerHTML.trim();

  // Soft normalize: if it is plain text after cleaning, wrap it in a <p>.
  if (cleaned && !looksLikeHtml(cleaned)) {
    return `<p>${escapeHtml(htmlToPlainText(cleaned))}</p>`;
  }

  return cleaned;
}

function getEditorPlainTextAndHtml() {
  // Prefer the rich editor if present; otherwise fall back to textarea.
  const rawHtml =
    articleEditor instanceof HTMLElement
      ? articleEditor.innerHTML
      : (articleContentInput?.value || "");

  const normalized = normalizeStoredContentToHtml(rawHtml);
  const sanitized = sanitizeArticleHtml(normalized);

  const plain = htmlToPlainText(sanitized);
  const hasImage = /<\s*img\b/i.test(sanitized);

  return { sanitizedHtml: sanitized, plainText: plain, hasImage };
}

let savedArticleSelectionRange = null;
let selectedEditorImage = null;

function saveArticleSelection() {
  if (!(articleEditor instanceof HTMLElement)) return;
  const sel = window.getSelection();
  if (!sel || sel.rangeCount < 1) return;
  const range = sel.getRangeAt(0);
  if (!articleEditor.contains(range.commonAncestorContainer)) return;
  savedArticleSelectionRange = range.cloneRange();
}

function restoreArticleSelection() {
  if (!savedArticleSelectionRange) return false;
  const sel = window.getSelection();
  if (!sel) return false;
  sel.removeAllRanges();
  sel.addRange(savedArticleSelectionRange);
  return true;
}

function insertNodeAtArticleCursor(node) {
  if (!(articleEditor instanceof HTMLElement) || !(node instanceof Node)) return;

  articleEditor.focus();
  const restored = restoreArticleSelection();

  const sel = window.getSelection();
  if (!sel || sel.rangeCount < 1) {
    articleEditor.appendChild(node);
    return;
  }

  const range = sel.getRangeAt(0);
  // If selection wasn't inside the editor, append.
  if (!restored && !articleEditor.contains(range.commonAncestorContainer)) {
    articleEditor.appendChild(node);
    return;
  }

  range.deleteContents();
  range.insertNode(node);

  // Move cursor after inserted node.
  range.setStartAfter(node);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
  saveArticleSelection();
}

function clearSelectedEditorImage() {
  selectedEditorImage = null;
  if (articleImageControls instanceof HTMLElement) articleImageControls.hidden = true;
}

function getImageSizeFromClass(img) {
  const classes = new Set(String(img?.className || "").split(/\s+/).filter(Boolean));
  if (classes.has("rt-img--sm")) return "sm";
  if (classes.has("rt-img--lg")) return "lg";
  if (classes.has("rt-img--full")) return "full";
  if (classes.has("rt-img--md")) return "md";
  return "md";
}

function getImageAlignFromClass(img) {
  const classes = new Set(String(img?.className || "").split(/\s+/).filter(Boolean));
  if (classes.has("rt-align--left")) return "left";
  if (classes.has("rt-align--right")) return "right";
  return "center";
}

function getImageScaleFromClass(img) {
  const classes = new Set(String(img?.className || "").split(/\s+/).filter(Boolean));
  for (const c of classes) {
    const m = /^rt-w-(\d{1,3})$/.exec(c);
    if (m) {
      const n = Number(m[1]);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

const RT_SIZE_TO_SCALE = Object.freeze({ sm: 35, md: 55, lg: 75, full: 100 });

function clampScalePercent(n) {
  const v = Math.round(Number(n) || 0);
  return Math.max(10, Math.min(100, v));
}

function scaleToPreset(percent) {
  const p = clampScalePercent(percent);
  if (p === RT_SIZE_TO_SCALE.sm) return "sm";
  if (p === RT_SIZE_TO_SCALE.md) return "md";
  if (p === RT_SIZE_TO_SCALE.lg) return "lg";
  if (p === RT_SIZE_TO_SCALE.full) return "full";
  return "custom";
}

function clearScaleClasses(img) {
  if (!(img instanceof HTMLImageElement)) return;
  for (const c of Array.from(img.classList)) {
    if (/^rt-w-\d{1,3}$/.test(c)) img.classList.remove(c);
  }
}

function setImageAlign(img, align) {
  if (!(img instanceof HTMLImageElement)) return;
  img.classList.add("rt-img");
  img.classList.remove("rt-align--left", "rt-align--center", "rt-align--right");

  const a = align || "center";
  img.classList.add(`rt-align--${a}`);
}

function setImageScale(img, percent) {
  if (!(img instanceof HTMLImageElement)) return;
  const p = clampScalePercent(percent);

  img.classList.add("rt-img");

  // Legacy size classes can cap width via max-width; remove when scaling.
  img.classList.remove("rt-img--sm", "rt-img--md", "rt-img--lg", "rt-img--full");

  clearScaleClasses(img);
  img.classList.add(`rt-w-${p}`);
}

function syncScaleInputs(percent) {
  const p = clampScalePercent(percent);
  if (articleImageScaleRange instanceof HTMLInputElement) articleImageScaleRange.value = String(p);
  if (articleImageScaleNumber instanceof HTMLInputElement) articleImageScaleNumber.value = String(p);
}


async function uploadArticleInlineImage(file, title, userId) {
  if (!(file instanceof File)) return null;

  const ext = getFileExt(file);
  const safeTitle = safePathSegment(title);
  const safeUser = safePathSegment(userId);
  const stamp = Date.now();
  const random = Math.random().toString(16).slice(2, 10);
  const objectPath = `${safeUser}/${ARTICLE_INLINE_FOLDER}/${safeTitle}-${stamp}-${random}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(ARTICLE_IMAGE_BUCKET)
    .upload(objectPath, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || undefined
    });

  if (uploadError) throw uploadError;

  const { data: urlData } = supabase.storage.from(ARTICLE_IMAGE_BUCKET).getPublicUrl(objectPath);
  return urlData?.publicUrl || null;
}

async function handleInsertInlineImages(files) {
  if (!currentUser) {
    setStatus(articleStatus, "Please log in to insert images.", "error");
    return;
  }
  if (!(articleEditor instanceof HTMLElement)) {
    setStatus(articleStatus, "Editor not available on this page.", "error");
    return;
  }

  const list = Array.from(files || []).filter((f) => f instanceof File);
  if (!list.length) return;

  // Keep title for filenames (falls back to 'article').
  const title = (articleTitleInput?.value || "article").trim() || "article";

  for (const file of list) {
    if (!String(file.type || "").startsWith("image/")) {
      setStatus(articleStatus, "Only image files can be inserted.", "error");
      continue;
    }
    if (file.size > MAX_ORIGINAL_IMAGE_BYTES) {
      setStatus(articleStatus, "That image is too large (max 15MB).", "error");
      continue;
    }

    const chip = document.createElement("span");
    chip.className = "rtUploadingChip";
    chip.contentEditable = "false";
    chip.textContent = "Uploading image…";
    insertNodeAtArticleCursor(chip);

    try {
      setStatus(articleStatus, "Optimizing image…", "muted");
      const optimized = await optimizeCoverImageFile(file);
      const uploadFile = optimized instanceof File ? optimized : file;

      setStatus(articleStatus, "Uploading image…", "muted");
      const url = await uploadArticleInlineImage(uploadFile, title, currentUser.id);

      const img = document.createElement("img");
      img.alt = "";
      img.src = url;
      setImageScale(img, RT_SIZE_TO_SCALE.md);
      setImageAlign(img, "center");

      chip.replaceWith(img);

      // Add a line break after each inserted image so typing continues naturally.
      insertNodeAtArticleCursor(document.createElement("br"));

      setStatus(articleStatus, "", "muted");
    } catch (error) {
      console.error("Inline image upload failed", error);
      chip.textContent = "Image upload failed";
      chip.style.borderStyle = "solid";
      setStatus(articleStatus, `Could not upload image: ${error?.message || "Unknown error"}`, "error");
    }
  }
}

function wireArticleRichEditor() {
  if (!(articleEditor instanceof HTMLElement)) return;

  // Save selection frequently so toolbar actions can insert correctly.
  articleEditor.addEventListener("keyup", saveArticleSelection);
  articleEditor.addEventListener("mouseup", saveArticleSelection);
  articleEditor.addEventListener("focus", saveArticleSelection);
  articleEditor.addEventListener("focus", () => {
    // Create a starter block when the user first focuses an empty editor.
    if (!articleEditor.innerHTML.trim()) {
      articleEditor.innerHTML = "<p><br></p>";
      saveArticleSelection();
    }
  });
  articleEditor.addEventListener("input", saveArticleSelection);

  document.addEventListener("selectionchange", saveArticleSelection);

  // Basic toolbar commands (uses execCommand for broad compatibility).
  // Encourage semantic tags (<b>, <i>, etc.) instead of inline CSS spans.
  try {
    document.execCommand("styleWithCSS", false, false);
  } catch (error) {
    // Ignore; not supported in all browsers.
  }

  const exec = (cmd, value = null) => {
    articleEditor.focus();
    restoreArticleSelection();
    try {
      document.execCommand(cmd, false, value);
    } catch (error) {
      console.warn("Command failed", cmd, error);
    }
    saveArticleSelection();
  };

  if (articleToolbar instanceof HTMLElement) {
    articleToolbar.addEventListener("click", (event) => {
      const button = event.target?.closest("button");
      if (!(button instanceof HTMLButtonElement)) return;
      if (button.disabled) return;

      // Link button
      if (button === articleLinkButton) {
        const url = prompt("Paste a link URL (https://…)") || "";
        if (!url.trim()) return;
        exec("createLink", url.trim());
        return;
      }


      // Video button (YouTube)
      if (button === articleVideoButton) {
        saveArticleSelection();
        const raw = prompt("Paste a YouTube link, embed code, or video ID") || "";
        const id = extractYouTubeId(raw);
        if (!id) {
          setStatus(
            articleStatus,
            "Couldn't recognize that as a YouTube link. Try a normal YouTube URL or the 11-character ID.",
            "error"
          );
          return;
        }

        const iframe = document.createElement("iframe");
        iframe.setAttribute("src", `https://www.youtube.com/embed/${id}`);
        iframe.setAttribute("title", "YouTube video player");
        iframe.setAttribute("allow", "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share");
        iframe.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
        iframe.setAttribute("loading", "lazy");
        iframe.setAttribute("allowfullscreen", "");

        insertNodeAtArticleCursor(iframe);
        insertNodeAtArticleCursor(document.createElement("br"));
        setStatus(articleStatus, "", "muted");
        return;
      }

      // Inline image button
      if (button === articleInlineImageButton) {
        articleInlineImageInput?.click();
        return;
      }

      const cmd = button.getAttribute("data-cmd");
      const block = button.getAttribute("data-block");

      if (cmd) {
        exec(cmd);
        return;
      }
      if (block) {
        const tag = block.toLowerCase();
        exec("formatBlock", `<${tag}>`);
        return;
      }
    });
  }

  if (articleInlineImageInput instanceof HTMLInputElement) {
    articleInlineImageInput.addEventListener("change", async () => {
      const files = articleInlineImageInput.files;
      if (files && files.length) {
        await handleInsertInlineImages(files);
      }
      // Reset so choosing the same file again triggers change.
      articleInlineImageInput.value = "";
    });
  }

  // Drag & drop images into the editor.
  articleEditor.addEventListener("dragover", (event) => {
    event.preventDefault();
  });

  articleEditor.addEventListener("drop", async (event) => {
    event.preventDefault();
    if (!event.dataTransfer) return;

    // Place cursor near the drop point when possible.
    const x = event.clientX;
    const y = event.clientY;
    let range = null;

    if (typeof document.caretRangeFromPoint === "function") {
      range = document.caretRangeFromPoint(x, y);
    } else if (typeof document.caretPositionFromPoint === "function") {
      const pos = document.caretPositionFromPoint(x, y);
      if (pos) {
        range = document.createRange();
        range.setStart(pos.offsetNode, pos.offset);
        range.collapse(true);
      }
    }

    if (range) {
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
      saveArticleSelection();
    }

    const files = event.dataTransfer.files;
    if (files && files.length) {
      await handleInsertInlineImages(files);
    }
  });

  // Paste images from clipboard.
  articleEditor.addEventListener("paste", async (event) => {
    const items = event.clipboardData?.items || [];
    const imageFiles = [];
    for (const item of items) {
      if (item.kind === "file") {
        const f = item.getAsFile();
        if (f && String(f.type || "").startsWith("image/")) imageFiles.push(f);
      }
    }
    if (imageFiles.length) {
      event.preventDefault();
      await handleInsertInlineImages(imageFiles);
    }
  });

  // Image selection + layout controls.
  articleEditor.addEventListener("click", (event) => {
    const img = event.target instanceof HTMLElement ? event.target.closest("img") : null;
    if (img instanceof HTMLImageElement && img.classList.contains("rt-img")) {
      selectedEditorImage = img;
      if (articleImageControls instanceof HTMLElement) articleImageControls.hidden = false;

      const legacySize = getImageSizeFromClass(img);
      const align = getImageAlignFromClass(img);

      const existingScale =
        getImageScaleFromClass(img) ??
        (RT_SIZE_TO_SCALE[legacySize] ?? RT_SIZE_TO_SCALE.md);

      const preset = scaleToPreset(existingScale);

      if (articleImageSizeSelect instanceof HTMLSelectElement) {
        articleImageSizeSelect.value = preset;
      }
      if (articleImageAlignSelect instanceof HTMLSelectElement) {
        articleImageAlignSelect.value = align;
      }
      syncScaleInputs(existingScale);

      if (articleImageSelectedLabel instanceof HTMLElement) {
        articleImageSelectedLabel.textContent = "Image selected";
      }
      return;
    }

    // Clicking elsewhere clears selection UI.
    clearSelectedEditorImage();
  });

  const onSelectedImageAlignChange = () => {
    if (!(selectedEditorImage instanceof HTMLImageElement)) return;
    const align = articleImageAlignSelect instanceof HTMLSelectElement ? articleImageAlignSelect.value : "center";
    setImageAlign(selectedEditorImage, align);
  };

  const onSelectedImageSizeChange = () => {
    if (!(selectedEditorImage instanceof HTMLImageElement)) return;

    const size = articleImageSizeSelect instanceof HTMLSelectElement ? articleImageSizeSelect.value : "md";
    const align = articleImageAlignSelect instanceof HTMLSelectElement ? articleImageAlignSelect.value : "center";

    // Always keep alignment up to date.
    setImageAlign(selectedEditorImage, align);

    if (size === "custom") return;

    const mapped = RT_SIZE_TO_SCALE[size] ?? RT_SIZE_TO_SCALE.md;
    setImageScale(selectedEditorImage, mapped);
    syncScaleInputs(mapped);

    // If user picked a preset, make sure the dropdown reflects that.
    if (articleImageSizeSelect instanceof HTMLSelectElement) {
      articleImageSizeSelect.value = size;
    }
  };

  const onSelectedImageScaleChange = (raw) => {
    if (!(selectedEditorImage instanceof HTMLImageElement)) return;
    const align = articleImageAlignSelect instanceof HTMLSelectElement ? articleImageAlignSelect.value : "center";
    const percent = clampScalePercent(raw);

    setImageScale(selectedEditorImage, percent);
    setImageAlign(selectedEditorImage, align);
    syncScaleInputs(percent);

    const preset = scaleToPreset(percent);
    if (articleImageSizeSelect instanceof HTMLSelectElement) {
      articleImageSizeSelect.value = preset;
    }
  };

  if (articleImageSizeSelect instanceof HTMLSelectElement) {
    articleImageSizeSelect.addEventListener("change", onSelectedImageSizeChange);
  }
  if (articleImageAlignSelect instanceof HTMLSelectElement) {
    articleImageAlignSelect.addEventListener("change", onSelectedImageAlignChange);
  }
  if (articleImageScaleRange instanceof HTMLInputElement) {
    articleImageScaleRange.addEventListener("input", (e) => {
      onSelectedImageScaleChange(e?.target?.value);
    });
  }
  if (articleImageScaleNumber instanceof HTMLInputElement) {
    articleImageScaleNumber.addEventListener("input", (e) => {
      onSelectedImageScaleChange(e?.target?.value);
    });
  }
  if (articleImageRemoveButton instanceof HTMLButtonElement) {
    articleImageRemoveButton.addEventListener("click", () => {
      if (!(selectedEditorImage instanceof HTMLImageElement)) return;
      const toRemove = selectedEditorImage;
      clearSelectedEditorImage();
      toRemove.remove();
      articleEditor.focus();
      saveArticleSelection();
    });
  }

  // Initialize with an empty paragraph so cursor feels natural.
}



let articleImageObjectUrl = null;
let articleOptimizedImageFile = null;
let articleOptimizePromise = null;
let articleImageSelectionToken = 0;

function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n}B`;
  const kb = n / 1024;
  if (kb < 1024) return `${kb.toFixed(0)}KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)}MB`;
}

function setArticleImageHelp(text) {
  if (!(articleImageHelp instanceof HTMLElement)) return;
  articleImageHelp.textContent = text || "";
}

function getFileExt(file) {
  const name = String(file?.name || "");
  const match = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  if (match) return match[1];
  const type = String(file?.type || "").toLowerCase();
  if (type.includes("png")) return "png";
  if (type.includes("jpeg") || type.includes("jpg")) return "jpg";
  if (type.includes("webp")) return "webp";
  return "bin";
}

function safePathSegment(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\-_.]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "file";
}

function clearArticleImageUI() {
  // Invalidate any in-flight optimization task.
  articleImageSelectionToken += 1;

  if (articleImageInput instanceof HTMLInputElement) {
    articleImageInput.value = "";
  }
  if (articleImagePreview instanceof HTMLElement) {
    articleImagePreview.hidden = true;
    const img = articleImagePreview.querySelector("img");
    if (img instanceof HTMLImageElement) {
      img.removeAttribute("src");
    }
  }
  if (articleImageClearButton instanceof HTMLButtonElement) {
    articleImageClearButton.disabled = true;
  }
  articleOptimizedImageFile = null;
  articleOptimizePromise = null;

  // Restore the default helper text.
  if (articleImageHelp instanceof HTMLElement) {
    if (!articleImageHelp.dataset.defaultText) {
      articleImageHelp.dataset.defaultText = articleImageHelp.textContent || "";
    }
    setArticleImageHelp(articleImageHelp.dataset.defaultText);
  }
  if (articleImageObjectUrl) {
    try { URL.revokeObjectURL(articleImageObjectUrl); } catch {}
    articleImageObjectUrl = null;
  }
}

function setArticleImagePreview(file) {
  if (!(file instanceof File)) {
    clearArticleImageUI();
    return;
  }

  if (!String(file.type || "").startsWith("image/")) {
    clearArticleImageUI();
    setStatus(articleStatus, "Please choose an image file.", "error");
    return;
  }

  if (file.size > MAX_ORIGINAL_IMAGE_BYTES) {
    clearArticleImageUI();
    setStatus(articleStatus, "That image is too large. Please use an image under 15MB.", "error");
    return;
  }

  if (articleImageObjectUrl) {
    try { URL.revokeObjectURL(articleImageObjectUrl); } catch {}
    articleImageObjectUrl = null;
  }

  articleImageObjectUrl = URL.createObjectURL(file);

  const img = articleImagePreview?.querySelector("img");
  if (img instanceof HTMLImageElement) {
    img.src = articleImageObjectUrl;
  }
  if (articleImagePreview instanceof HTMLElement) {
    articleImagePreview.hidden = false;
  }
  if (articleImageClearButton instanceof HTMLButtonElement) {
    articleImageClearButton.disabled = false;
  }

  // Let the user know we will optimize for upload.
  setArticleImageHelp(`Selected ${formatBytes(file.size)}. We will resize/compress before upload.`);
}

// ---- Client-side image optimization helpers ----
const CAN_ENCODE_WEBP = (() => {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    return canvas.toDataURL("image/webp").startsWith("data:image/webp");
  } catch {
    return false;
  }
})();

function chooseOutputMime(inputFile) {
  const type = String(inputFile?.type || "").toLowerCase();
  // Prefer WebP when available (small files, good quality).
  if (CAN_ENCODE_WEBP) return "image/webp";
  // If WebP isn't available, fall back to PNG for PNG inputs; otherwise JPEG.
  if (type.includes("png")) return "image/png";
  return "image/jpeg";
}

function getOutputExt(mime) {
  const m = String(mime || "").toLowerCase();
  if (m.includes("webp")) return "webp";
  if (m.includes("png")) return "png";
  return "jpg";
}

function computeConstrainedSize(width, height, maxDim) {
  const w = Number(width) || 0;
  const h = Number(height) || 0;
  if (!w || !h) return { width: w, height: h, scale: 1 };
  const longEdge = Math.max(w, h);
  if (longEdge <= maxDim) return { width: w, height: h, scale: 1 };
  const scale = maxDim / longEdge;
  return {
    width: Math.max(1, Math.round(w * scale)),
    height: Math.max(1, Math.round(h * scale)),
    scale
  };
}

async function decodeImageSource(file) {
  // Use ImageBitmap when possible (handles EXIF orientation in many browsers).
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        cleanup: () => {
          try { bitmap.close(); } catch {}
        }
      };
    } catch {
      // fall through to <img> decode
    }
  }

  const url = URL.createObjectURL(file);
  const img = new Image();
  img.decoding = "async";
  img.src = url;
  try {
    if (typeof img.decode === "function") {
      await img.decode();
    } else {
      await new Promise((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Image decode failed"));
      });
    }
    return {
      source: img,
      width: img.naturalWidth || img.width,
      height: img.naturalHeight || img.height,
      cleanup: () => {
        try { URL.revokeObjectURL(url); } catch {}
      }
    };
  } catch (error) {
    try { URL.revokeObjectURL(url); } catch {}
    throw error;
  }
}

function canvasToBlob(canvas, mime, quality) {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Failed to encode image"));
        },
        mime,
        quality
      );
    } catch (error) {
      reject(error);
    }
  });
}

async function encodeCanvasWithBudget(canvas, mime, targetBytes, maxBytes) {
  // PNG doesn't support quality; just export once.
  if (String(mime).toLowerCase().includes("png")) {
    const blob = await canvasToBlob(canvas, mime);
    return blob;
  }

  // Try a few quality steps until we get under the ceiling.
  const qualities = [0.86, 0.78, 0.7, 0.62, 0.55, 0.5];
  let best = null;
  for (const q of qualities) {
    const blob = await canvasToBlob(canvas, mime, q);
    best = blob;
    if (blob.size <= targetBytes) return blob;
    if (blob.size <= maxBytes) return blob;
  }
  return best;
}

async function optimizeCoverImageFile(file) {
  if (!(file instanceof File)) return null;
  if (!String(file.type || "").startsWith("image/")) return file;
  if (file.size > MAX_ORIGINAL_IMAGE_BYTES) {
    throw new Error("Image exceeds the 15MB limit.");
  }

  const outputMime = chooseOutputMime(file);
  const decoded = await decodeImageSource(file);
  try {
    const { width, height } = decoded;
    const sized = computeConstrainedSize(width, height, MAX_IMAGE_DIMENSION);

    // If it's already small-ish and doesn't need resizing, skip re-encoding.
    // (Still allow WebP conversion when available for big files.)
    const shouldResize = sized.scale < 1;
    const shouldReencode = shouldResize || (CAN_ENCODE_WEBP && !String(file.type).toLowerCase().includes("webp"));
    if (!shouldReencode && file.size <= MAX_OPTIMIZED_IMAGE_BYTES) {
      return file;
    }

    const canvas = document.createElement("canvas");
    canvas.width = sized.width;
    canvas.height = sized.height;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) throw new Error("Canvas not available.");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(decoded.source, 0, 0, sized.width, sized.height);

    // First encode pass.
    let blob = await encodeCanvasWithBudget(canvas, outputMime, TARGET_IMAGE_BYTES, MAX_OPTIMIZED_IMAGE_BYTES);

    // If still too large, downscale a bit more (a couple tries) and re-encode.
    let safetyLoops = 0;
    while (blob && blob.size > MAX_OPTIMIZED_IMAGE_BYTES && safetyLoops < 2) {
      safetyLoops += 1;
      const nextW = Math.max(600, Math.round(canvas.width * 0.85));
      const nextH = Math.max(600, Math.round(canvas.height * 0.85));

      const smaller = document.createElement("canvas");
      smaller.width = nextW;
      smaller.height = nextH;
      const sctx = smaller.getContext("2d", { alpha: true });
      if (!sctx) break;
      sctx.imageSmoothingEnabled = true;
      sctx.imageSmoothingQuality = "high";
      sctx.drawImage(canvas, 0, 0, nextW, nextH);

      blob = await encodeCanvasWithBudget(smaller, outputMime, TARGET_IMAGE_BYTES, MAX_OPTIMIZED_IMAGE_BYTES);
    }

    if (!blob) return file;

    const ext = getOutputExt(outputMime);
    const baseName = safePathSegment(file.name?.replace(/\.[^/.]+$/, "") || "cover");
    const optimizedName = `${baseName}.${ext}`;
    return new File([blob], optimizedName, { type: outputMime });
  } finally {
    try { decoded.cleanup?.(); } catch {}
  }
}

async function uploadArticleCoverImage(file, title, userId) {
  if (!(file instanceof File)) return null;

  const ext = getFileExt(file);
  const safeTitle = safePathSegment(title);
  const safeUser = safePathSegment(userId);
  const stamp = Date.now();
  const random = Math.random().toString(16).slice(2, 10);
  const objectPath = `${safeUser}/${safeTitle}-${stamp}-${random}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(ARTICLE_IMAGE_BUCKET)
    .upload(objectPath, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || undefined
    });

  if (uploadError) {
    throw uploadError;
  }

  const { data: urlData } = supabase.storage.from(ARTICLE_IMAGE_BUCKET).getPublicUrl(objectPath);
  return urlData?.publicUrl || null;
}



function extractStorageObjectPathFromPublicUrl(publicUrl, bucketName) {
  const url = String(publicUrl || "").trim();
  if (!url) return null;

  const marker = `/storage/v1/object/public/${bucketName}/`;

  try {
    const parsed = new URL(url);
    const idx = parsed.pathname.indexOf(marker);
    if (idx === -1) return null;
    const objectPath = parsed.pathname.slice(idx + marker.length);
    return objectPath ? decodeURIComponent(objectPath) : null;
  } catch {
    const idx = url.indexOf(marker);
    if (idx === -1) return null;
    const objectPath = url.slice(idx + marker.length);
    return objectPath ? objectPath.split("?")[0] : null;
  }
}

async function tryRemoveArticleCoverImage(imageUrl) {
  const objectPath = extractStorageObjectPathFromPublicUrl(imageUrl, ARTICLE_IMAGE_BUCKET);
  if (!objectPath) return;

  try {
    const { error } = await supabase.storage.from(ARTICLE_IMAGE_BUCKET).remove([objectPath]);
    if (error) {
      // Non-fatal: the row delete is more important than storage cleanup.
      console.warn("Unable to remove article cover image from storage", error);
    }
  } catch (error) {
    console.warn("Unable to remove article cover image from storage", error);
  }
}

async function deleteArticle(row, triggerButton) {
  if (!row?.id) return;

  if (!currentUser) {
    alert("Please log in to delete an article.");
    return;
  }

  if (row.user_id !== currentUser.id) {
    alert("You can only delete your own articles.");
    return;
  }

  const ok = window.confirm("Delete this article?\n\nThis can't be undone.");
  if (!ok) return;

  if (triggerButton instanceof HTMLButtonElement) {
    triggerButton.disabled = true;
    triggerButton.dataset.defaultText = triggerButton.dataset.defaultText || triggerButton.textContent || "Delete";
    triggerButton.textContent = "Deleting…";
  }

  try {
    await tryRemoveArticleCoverImage(row.image_url);

    const { error } = await supabase
      .from("articles")
      .delete()
      .eq("id", row.id)
      .eq("user_id", currentUser.id);

    if (error) throw error;

    articlesCache = (articlesCache || []).filter((a) => a.id !== row.id);
    updateArticleTagShelf(articlesCache);
    applyArticleSearch();
  } catch (error) {
    console.error("Error deleting article", error);
    const msg = String(error?.message || "");
    const lower = msg.toLowerCase();
    const hint = lower.includes("permission") || lower.includes("policy") || lower.includes("rls")
      ? "\n\nSupabase tip: enable RLS + add a DELETE policy like `auth.uid() = user_id` on the articles table."
      : "";
    alert(`Could not delete article.${msg ? `\n\n${msg}` : ""}${hint}`);
  } finally {
    if (triggerButton instanceof HTMLButtonElement) {
      triggerButton.disabled = false;
      triggerButton.textContent = triggerButton.dataset.defaultText || "Delete";
    }
  }
}


function filterArticles(articles, query) {
  const raw = (query || "").trim();
  if (!raw) return articles;

  const lower = raw.toLowerCase();
  const isTagMode = lower.startsWith("#") || lower.startsWith("tag:");
  const needle = isTagMode
    ? normalizeTag(lower.replace(/^tag:/, "").replace(/^#/, "").trim())
    : lower;

  return (articles || []).filter((a) => {
    const title = String(a?.title || "").toLowerCase();
    const bodyText = htmlToPlainText(normalizeStoredContentToHtml(a?.content || "")).toLowerCase();
    const tags = getTagsFromRow(a);

    if (isTagMode) {
      if (!needle) return false;
      return tags.some((t) => t.includes(needle));
    }

    const tagsText = tags.join(" ").toLowerCase();
    const looseNeedle = needle.startsWith("#") ? needle.slice(1) : needle;
    return title.includes(needle) || bodyText.includes(needle) || tagsText.includes(looseNeedle);
  });
}

function updateArticleSearchMeta(shown, total, query) {
  if (!articleSearchMeta) return;
  const safeQuery = (query || "").trim();
  const totalText = `${total} article${total === 1 ? "" : "s"}`;
  if (!safeQuery) {
    articleSearchMeta.textContent = total ? `${totalText} available.` : "";
    return;
  }
  articleSearchMeta.textContent = `Showing ${shown} of ${totalText} for “${safeQuery}”.`;
}

function applyArticleSearch() {
  const query = (articleSearchInput?.value || "").trim();
  const filtered = filterArticles(articlesCache, query);
  renderArticles(filtered, query);
  updateArticleSearchMeta(filtered.length, articlesCache.length, query);
  if (articleSearchClearButton instanceof HTMLButtonElement) {
    articleSearchClearButton.disabled = !query;
  }
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
    article.className = "card postCard";
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

    const fullText = String(post.content || "");
    const excerptText = makeExcerpt(fullText, 420);

    const content = document.createElement("p");
    content.className = "post-content";
    content.style.whiteSpace = "pre-wrap";
    content.id = `post-content-${post.id}`;
    content.textContent = excerptText;

    const contentWrap = document.createElement("div");
    contentWrap.className = "postContentWrap";
    contentWrap.appendChild(content);

    const footer = document.createElement("div");
    footer.className = "postFooter";

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "btn btnGhost btnSm postExpandBtn";
    toggle.textContent = "Expand";
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-controls", content.id);

    const isTruncated = excerptText.length < fullText.trim().length;
    if (!isTruncated) {
      // Keep footer height consistent, but hide the button when it isn't needed.
      toggle.style.visibility = "hidden";
      toggle.style.pointerEvents = "none";
      toggle.tabIndex = -1;
      toggle.setAttribute("aria-hidden", "true");
    } else {
      article.classList.add("hasOverflow");
    }

    toggle.addEventListener("click", () => {
      const expanded = article.classList.toggle("isExpanded");
      toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
      toggle.textContent = expanded ? "Collapse" : "Expand";
      content.textContent = expanded ? fullText : excerptText;
    });

    footer.appendChild(toggle);

    article.append(metaRow, contentWrap, footer);
    postsContainer.appendChild(article);
  });
}

function renderArticles(articles, query = "") {
  if (!articlesContainer) return;

  articlesContainer.innerHTML = "";

  if (!articles.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = query
      ? `No matching articles for "${query}".`
      : "No articles yet. Publish the first one!";
    articlesContainer.appendChild(empty);
    return;
  }

  articles.forEach((row) => {
    const card = document.createElement("article");
    card.className = "card articleCard";
    card.dataset.id = row.id;

    const toggle = document.createElement("div");
    toggle.className = "articleToggle articleToggle--hero";
    toggle.setAttribute("role", "button");
    toggle.tabIndex = 0;
    toggle.setAttribute("aria-expanded", "false");

    const normalizedContent = normalizeStoredContentToHtml(row.content || "");
    const sanitizedContent = sanitizeArticleHtml(normalizedContent);
    const plainContent = htmlToPlainText(sanitizedContent);

    // ---- Preview (collapsed) ----
    const preview = document.createElement("div");
    preview.className = "articlePreview";

    const media = document.createElement("div");
    media.className = "articlePreviewMedia";

    if (row?.image_url) {
      const img = document.createElement("img");
      img.className = "articlePreviewImage";
      img.loading = "lazy";
      img.alt = `Cover image for ${row.title || "article"}`;
      img.src = row.image_url;
      media.appendChild(img);
    } else {
      const ph = document.createElement("div");
      ph.className = "articlePreviewPlaceholder";
      ph.innerHTML = `<span aria-hidden="true" class="articlePreviewPlaceholderIcon">✷</span>`;
      media.appendChild(ph);
    }

    const caption = document.createElement("div");
    caption.className = "articlePreviewCaption";

    const title = document.createElement("h3");
    title.className = "articleTitle articlePreviewTitle";
    title.textContent = row.title || "Untitled";

    // Tags (optional)
    const tags = getTagsFromRow(row);
    let tagsRow = null;
    if (tags.length) {
      tagsRow = document.createElement("div");
      tagsRow.className = "articleTagRow";

      tags.slice(0, 8).forEach((tag) => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "articleTag";
        chip.textContent = formatTagLabel(tag);
        chip.setAttribute("aria-label", `Filter by tag ${tag}`);
        chip.addEventListener("click", (event) => {
          // Don't toggle the article open/close when clicking tags.
          event.preventDefault();
          event.stopPropagation();
          setArticleSearchQuery(`#${tag}`, true);
        });
        tagsRow.appendChild(chip);
      });
    }

    const row2 = document.createElement("div");
    row2.className = "articlePreviewRow";

    const author = document.createElement("div");
    author.className = "articlePreviewAuthor";

    const avatar = createAvatarElement(row.user_id);

        const metaText = document.createElement("div");
    metaText.className = "articlePreviewMeta";

    const authorName = getAuthorDisplayName(row);
    const articleDate = formatShortDate(row.created_at);

    const authorSpan = document.createElement("span");
    authorSpan.className = "articleMetaAuthor";
    authorSpan.textContent = `By ${authorName}`;

    metaText.appendChild(authorSpan);

    if (articleDate) {
      const dateSpan = document.createElement("span");
      dateSpan.className = "articleMetaDate";
      dateSpan.textContent = articleDate;
      metaText.appendChild(dateSpan);
      metaText.title = `By ${authorName} • ${articleDate}`;
    } else {
      metaText.title = `By ${authorName}`;
    }

    author.append(avatar, metaText);

    const chevron = document.createElement("span");
    chevron.className = "articleChevron";
    chevron.setAttribute("aria-hidden", "true");
    chevron.textContent = "▾";

    const controls = document.createElement("div");
    controls.className = "articlePreviewControls";
    controls.appendChild(chevron);

    if (currentUser && row.user_id === currentUser.id) {
      const del = document.createElement("button");
      del.type = "button";
      del.className = "btn btnGhost btnSm articleDeleteBtn";
      del.textContent = "Delete";
      del.setAttribute("aria-label", "Delete this article");
      del.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        deleteArticle(row, del);
      });
      controls.appendChild(del);
    }

    row2.append(author, controls);

    const excerpt = document.createElement("p");
    excerpt.className = "muted articleExcerpt articlePreviewExcerpt";
    excerpt.textContent = plainContent
      ? makeExcerpt(plainContent, 220)
      : /<\s*img\b/i.test(sanitizedContent)
      ? "Image"
      : "";

    if (tagsRow) {
      caption.append(title, tagsRow, row2, excerpt);
    } else {
      caption.append(title, row2, excerpt);
    }

    preview.append(media, caption);
    toggle.appendChild(preview);

    // ---- Body (expanded) ----
    const bodyWrap = document.createElement("div");
    bodyWrap.className = "articleBody";
    bodyWrap.hidden = true;
    bodyWrap.id = `article-body-${row.id}`;

    const body = document.createElement("div");
    body.className = "rtContent";
    body.innerHTML = sanitizedContent || "";

    bodyWrap.appendChild(body);

    toggle.setAttribute("aria-controls", bodyWrap.id);

    const handleToggle = () => {
      const open = bodyWrap.hidden;
      bodyWrap.hidden = !open;
      toggle.setAttribute("aria-expanded", String(open));
      card.classList.toggle("isOpen", open);
    };

    toggle.addEventListener("click", handleToggle);
    toggle.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handleToggle();
      }
    });

    card.append(toggle, bodyWrap);
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
      .select("id, title, content, image_url, tags, created_at, user_id, author_display_name")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;

    articlesCache = data || [];
    updateArticleTagShelf(articlesCache);
    applyArticleSearch();
  } catch (error) {
    console.error("Error fetching articles", error);
    if (articlesContainer) {
      articlesContainer.innerHTML = "";
      const errorMessage = document.createElement("p");
      errorMessage.className = "error";
      const msg = String(error?.message || "").toLowerCase();
      const hint =
        msg.includes("relation") || msg.includes("does not exist")
          ? " (Looks like the 'articles' table isn't created in Supabase yet.)"
          : msg.includes("image_url") && msg.includes("column")
            ? " (Looks like the 'articles.image_url' column isn't added yet.)"
            : msg.includes("tags") && msg.includes("column")
              ? " (Looks like the 'articles.tags' column isn't added yet. Add it as text[] or json.)"
            : msg.includes("author_display_name") && msg.includes("column")
              ? " (Looks like the 'articles.author_display_name' column isn't added yet.)"
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
  const tags = parseTags(articleTagsInput?.value || "");
  const { sanitizedHtml: contentHtml, plainText: contentText, hasImage: contentHasImage } =
    getEditorPlainTextAndHtml();
  // Keep the hidden textarea in sync (useful for debugging and any future form-based reads).
  if (articleContentInput) articleContentInput.value = contentHtml || "";

  if (!title) {
    setStatus(articleStatus, "Title cannot be empty.", "error");
    return;
  }
  if (title.length > MAX_ARTICLE_TITLE) {
    setStatus(articleStatus, `Title must be ${MAX_ARTICLE_TITLE} characters or fewer.`, "error");
    return;
  }
  if (!contentText && !contentHasImage) {
    setStatus(articleStatus, "Article body cannot be empty.", "error");
    return;
  }
  if (contentText.length > MAX_ARTICLE_CHARS) {
    setStatus(articleStatus, `Article text must be ${MAX_ARTICLE_CHARS.toLocaleString()} characters or fewer.`, "error");
    return;
  }
  if ((contentHtml || "").length > 200000) {
    setStatus(articleStatus, "That article is too large after formatting. Please shorten it.", "error");
    return;
  }

  setButtonBusy(articleSubmitButton, true, "Publishing...", "Publish");
  setStatus(articleStatus, "");

  let imageUrl = null;
  const selectedFile =
    articleImageInput instanceof HTMLInputElement ? articleImageInput.files?.[0] || null : null;

  if (selectedFile) {
    // Validate again at publish time (preview validation could be bypassed).
    if (!String(selectedFile.type || "").startsWith("image/")) {
      setStatus(articleStatus, "Please choose an image file.", "error");
      return;
    }
    if (selectedFile.size > MAX_ORIGINAL_IMAGE_BYTES) {
      setStatus(articleStatus, "That image is too large. Please choose an image under 15MB.", "error");
      return;
    }

    try {
      // Ensure we have an optimized file (we may have started work on change, or we can do it now).
      if (articleOptimizePromise) {
        setStatus(articleStatus, "Optimizing cover image…", "muted");
        await articleOptimizePromise;
      } else {
        setStatus(articleStatus, "Optimizing cover image…", "muted");
        articleOptimizedImageFile = await optimizeCoverImageFile(selectedFile);
      }

      const uploadFile = articleOptimizedImageFile instanceof File ? articleOptimizedImageFile : selectedFile;

      // Safety: if optimization somehow fails to reduce size, still prevent huge uploads.
      if (uploadFile.size > MAX_ORIGINAL_IMAGE_BYTES) {
        setStatus(articleStatus, "That image is still too large after optimization. Please use a smaller image.", "error");
        setButtonBusy(articleSubmitButton, false, "Publishing...", "Publish");
        return;
      }

      setStatus(articleStatus, "Uploading cover image…", "muted");
      imageUrl = await uploadArticleCoverImage(uploadFile, title, currentUser.id);
    } catch (error) {
      console.error("Error uploading article image", error);
      setStatus(
        articleStatus,
        `Could not upload image: ${error?.message || "Unknown error"}. Check your Storage bucket/policies.`,
        "error"
      );
      setButtonBusy(articleSubmitButton, false, "Publishing...", "Publish");
      return;
    }
  }

  const { error } = await supabase
    .from("articles")
    .insert([
      {
        user_id: currentUser.id,
        author_display_name: getUserDisplayNameOrFallback(currentUser),
        title,
        tags,
        content: contentHtml || "",
        image_url: imageUrl
      }
    ]);

  if (error) {
    console.error("Error creating article", error);
    const msg = String(error?.message || "").toLowerCase();
    const hint = msg.includes("tags") && msg.includes("column")
      ? " (Add an 'articles.tags' column as text[] or json in Supabase.)"
      : msg.includes("author_display_name") && msg.includes("column")
        ? " (Add an 'articles.author_display_name' column as text in Supabase.)"
        : "";
    setStatus(articleStatus, (error.message || "Could not publish article. Please try again.") + hint, "error");
  } else {
    if (articleTitleInput) articleTitleInput.value = "";
    if (articleTagsInput) articleTagsInput.value = "";
    if (articleContentInput) articleContentInput.value = "";
    if (articleEditor instanceof HTMLElement) articleEditor.innerHTML = "";
    clearSelectedEditorImage();
    clearArticleImageUI();
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
    if (currentUser) {
      const dn = getUserDisplayNameOrFallback(currentUser);
      saveStoredDisplayName(currentUser.id, dn);
    }

    toggleCreateUI(Boolean(currentUser));
    applyArticleSearch();
  } catch (error) {
    console.error("Error checking auth status", error);
    currentUser = null;
    toggleCreateUI(false);
    applyArticleSearch();
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
        clearArticleImageUI();
        setStatus(articleStatus, "");
      }
    });
  }

  if (closeArticleComposerButton) {
    closeArticleComposerButton.addEventListener("click", () => {
      closeComposer(articleComposerCard, shareArticleButton);
      clearArticleImageUI();
      setStatus(articleStatus, "");
    });
  }
}

function wireArticleSearch() {
  if (!(articleSearchInput instanceof HTMLInputElement)) {
    // If the search UI isn't on the page, just render everything.
    renderArticles(articlesCache);
    return;
  }

  const setSearchOpen = (open) => {
    if (articleSearchPanel instanceof HTMLElement) {
      articleSearchPanel.hidden = !open;
    }
    if (articleSearchToggleButton instanceof HTMLButtonElement) {
      articleSearchToggleButton.setAttribute("aria-expanded", String(open));
    }

    if (!open) {
      // When closing search, reset the filter so the list returns to normal.
      articleSearchInput.value = "";
      applyArticleSearch();
      articleSearchInput.blur();
    } else {
      // Opening: focus the field so the UI feels instant.
      requestAnimationFrame(() => articleSearchInput.focus());
    }
  };

  // Toggle button (optional)
  if (articleSearchToggleButton instanceof HTMLButtonElement) {
    articleSearchToggleButton.addEventListener("click", () => {
      const open = !(articleSearchPanel instanceof HTMLElement) ? true : articleSearchPanel.hidden;
      setSearchOpen(open);
    });
  }

  const onInput = () => applyArticleSearch();
  articleSearchInput.addEventListener("input", onInput);
  articleSearchInput.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;

    const hasQuery = Boolean((articleSearchInput.value || "").trim());
    if (hasQuery) {
      articleSearchInput.value = "";
      applyArticleSearch();
      event.preventDefault();
      return;
    }

    // No query: close the panel if it is open.
    if (articleSearchPanel instanceof HTMLElement && !articleSearchPanel.hidden) {
      setSearchOpen(false);
      event.preventDefault();
    }
  });

  if (articleSearchClearButton instanceof HTMLButtonElement) {
    articleSearchClearButton.addEventListener("click", () => {
      articleSearchInput.value = "";
      applyArticleSearch();
      articleSearchInput.focus();
    });
  }

  // Initialize counts/render.
  applyArticleSearch();

  // Ensure the panel starts closed (the HTML uses [hidden], but this is a safety net).
  if (articleSearchPanel instanceof HTMLElement) {
    articleSearchPanel.hidden = true;
  }
  if (articleSearchToggleButton instanceof HTMLButtonElement) {
    articleSearchToggleButton.setAttribute("aria-expanded", "false");
  }
}


function wireArticleImageUpload() {
  if (!(articleImageInput instanceof HTMLInputElement)) return;

  // Start clean.
  clearArticleImageUI();

  articleImageInput.addEventListener("change", () => {
    const file = articleImageInput.files?.[0] || null;

    // Reset any in-flight optimization.
    articleImageSelectionToken += 1;
    const token = articleImageSelectionToken;
    articleOptimizedImageFile = null;
    articleOptimizePromise = null;

    setArticleImagePreview(file);
    if (!(file instanceof File)) return;

    // Optimize in the background so publishing is faster.
    setStatus(articleStatus, "Optimizing image…", "muted");
    articleOptimizePromise = (async () => {
      try {
        const optimized = await optimizeCoverImageFile(file);
        // If the user picked a different image while we were working, ignore.
        if (token !== articleImageSelectionToken) return;

        articleOptimizedImageFile = optimized || file;

        const inSize = file.size;
        const outSize = articleOptimizedImageFile instanceof File ? articleOptimizedImageFile.size : inSize;
        if (outSize < inSize) {
          setArticleImageHelp(
            `Selected ${formatBytes(inSize)} → optimized ${formatBytes(outSize)} (max ${MAX_IMAGE_DIMENSION}px).`
          );
        } else {
          setArticleImageHelp(`Selected ${formatBytes(inSize)}. Ready to upload.`);
        }
        setStatus(articleStatus, "", "muted");
      } catch (error) {
        if (token !== articleImageSelectionToken) return;
        articleOptimizedImageFile = file;
        setArticleImageHelp(`Selected ${formatBytes(file.size)}. We'll upload the original.`);
        setStatus(articleStatus, "Couldn't optimize this image; uploading original.", "muted");
      }
    })();
  });

  if (articleImageClearButton instanceof HTMLButtonElement) {
    articleImageClearButton.disabled = true;
    articleImageClearButton.addEventListener("click", () => {
      clearArticleImageUI();
      // Keep the flow snappy: bounce focus back to the editor.
      if (articleEditor instanceof HTMLElement) {
        articleEditor.focus();
      } else if (articleContentInput instanceof HTMLElement) {
        articleContentInput.focus();
      }
    });
  }
}


function wireAvatarRefresh() {
  window.addEventListener("storage", (event) => {
    if (!event.key || !event.key.startsWith(AVATAR_KEY_PREFIX)) return;
    const userId = event.key.slice(AVATAR_KEY_PREFIX.length);
    avatarCache.delete(userId);
    renderPosts(postsCache);
    applyArticleSearch();
  });

  window.addEventListener("profile:avatarUpdated", (event) => {
    const userId = event.detail?.userId;
    if (!userId) return;
    avatarCache.set(userId, event.detail?.src || null);
    renderPosts(postsCache);
    applyArticleSearch();
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
  wireArticleRichEditor();
  wireArticleImageUpload();
  wireArticleSearch();
  wireAvatarRefresh();
  subscribeToRealtime();

  supabase.auth.onAuthStateChange((_event, session) => {
    currentUser = session?.user ?? null;
    if (currentUser) {
      const dn = getUserDisplayNameOrFallback(currentUser);
      saveStoredDisplayName(currentUser.id, dn);
    }
    toggleCreateUI(Boolean(currentUser));
    applyArticleSearch();
  });
}

init();
