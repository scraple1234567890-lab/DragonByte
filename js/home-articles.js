import { supabase } from "./supabaseClient.js";

const mount = document.getElementById("homeArticles");
if (!(mount instanceof HTMLElement)) {
  // Safe to include site-wide.
} else {
  mount.innerHTML = '<p class="muted">Loading latest articles...</p>';

  const MAX = 3;

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

  function createAvatarElement() {
    // Keep the same visual language as the Articles page, but use a generic placeholder here.
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

    // Intentionally no src: homepage preview doesn't need to resolve avatars.
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
      const link = document.createElement("a");
      link.className = "card articleCard articleToggle--hero homeArticleLink";
      link.href = `./articles.html?article=${encodeURIComponent(row.id)}`;
      link.setAttribute("aria-label", `Read article: ${row.title || "Untitled"}`);

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

      const row2 = document.createElement("div");
      row2.className = "articlePreviewRow";

      const author = document.createElement("div");
      author.className = "articlePreviewAuthor";

      const avatar = createAvatarElement();

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

      mount.appendChild(link);
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

  load();
}
