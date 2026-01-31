import { supabase } from "./supabaseClient.js";

const mount = document.getElementById("homeArticles");
if (!(mount instanceof HTMLElement)) {
  // Safe to include site-wide.
} else {
  mount.innerHTML = '<p class="muted">Loading latest articles...</p>';

  const MAX = 3;
  const AVATAR_KEY_PREFIX = "profile:avatar:";

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

  function formatShortDate(value) {
    if (!value) return "";
    try {
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return "";
      return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    } catch {
      return "";
    }
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

    const src = loadStoredAvatar(userId);
    if (src) {
      img.src = src;
      avatar.classList.add("hasImage");
    }

    avatar.append(placeholder, img);
    return avatar;
  }

  function render(articles) {
    mount.innerHTML = "";

    if (!articles.length) {
      const empty = document.createElement("p");
      empty.className = "muted";
      empty.innerHTML = 'No articles yet. <a href="./articles.html">Write the first one</a>.';
      mount.appendChild(empty);
      return;
    }

    articles.forEach((row) => {
      // Match the miniature article card look from the Articles page.
      // Articles page structure:
      // <article class="card articleCard">
      //   <div class="articleToggle articleToggle--hero"> ...preview... </div>
      // </article>
      // On the homepage, we use an <a> for the toggle so the whole card navigates.
      const card = document.createElement("article");
      card.className = "card articleCard";
      card.dataset.id = row.id;

      const link = document.createElement("a");
      link.className = "articleToggle articleToggle--hero homeArticleLink";
      link.href = `./articles.html?article=${encodeURIComponent(row.id)}`;
      link.setAttribute("aria-label", `Read article: ${row.title || "Untitled"}`);

      const preview = document.createElement("div");
      preview.className = "articlePreview";

      const media = document.createElement("div");
      media.className = "articlePreviewMedia";

      if (row?.image_url) {
        const safeCover = String(row.image_url).replace(/"/g, "%22").replace(/'/g, "%27");
        media.style.setProperty("--cover-url", `url("${safeCover}")`);
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

      const row2 = document.createElement("div");
      row2.className = "articlePreviewRow";

      const author = document.createElement("div");
      author.className = "articlePreviewAuthor";

      const avatar = createAvatarElement(row.user_id);

      const metaText = document.createElement("div");
      metaText.className = "articlePreviewMeta";

      const authorName = row.author_display_name || "DragonByte";
      const date = formatShortDate(row.created_at);

      const authorSpan = document.createElement("span");
      authorSpan.className = "articleMetaAuthor";
      authorSpan.textContent = `By ${authorName}`;
      metaText.appendChild(authorSpan);

      if (date) {
        const dateSpan = document.createElement("span");
        dateSpan.className = "articleMetaDate";
        dateSpan.textContent = date;
        metaText.appendChild(dateSpan);
        metaText.title = `By ${authorName} • ${date}`;
      } else {
        metaText.title = `By ${authorName}`;
      }

      author.append(avatar, metaText);

      const controls = document.createElement("div");
      controls.className = "articlePreviewControls";

      const chevron = document.createElement("span");
      chevron.className = "articleChevron";
      chevron.setAttribute("aria-hidden", "true");
      chevron.textContent = "▾";
      controls.appendChild(chevron);

      row2.append(author, controls);

      caption.append(title, row2);
      preview.append(media, caption);
      link.appendChild(preview);
      card.appendChild(link);

      mount.appendChild(card);
    });
  }

  async function load() {
    try {
      const { data, error } = await supabase
        .from("articles")
        .select("id, title, image_url, tags, created_at, user_id, author_display_name")
        .order("created_at", { ascending: false })
        .limit(MAX);

      if (error) throw error;

      render(data || []);
    } catch (err) {
      console.error("Error loading homepage articles", err);
      mount.innerHTML = "";
      const p = document.createElement("p");
      p.className = "muted";
      p.textContent = "Could not load articles right now.";
      mount.appendChild(p);
    }
  }

  // If the active user updates their avatar (Profile page), keep the homepage previews in sync.
  window.addEventListener("profile:avatarUpdated", (event) => {
    const userId = event?.detail?.userId;
    if (!userId || !(mount instanceof HTMLElement)) return;

    const src = event?.detail?.src || null;

    const esc = (value) => {
      try {
        return window.CSS?.escape ? CSS.escape(String(value)) : String(value).replace(/[\\"]/g, "\\$&");
      } catch {
        return String(value);
      }
    };

    const selector = `[data-avatar-user="${esc(userId)}"]`;
    const nodes = mount.querySelectorAll(selector);
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
  });

  load();
}
