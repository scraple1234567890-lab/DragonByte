import { supabase } from "./supabaseClient.js";

const mount = document.getElementById("homeArticles");
if (!(mount instanceof HTMLElement)) {
  // This script is safe to include site-wide.
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

  function htmlToPlainText(html) {
    if (!html) return "";
    try {
      const doc = new DOMParser().parseFromString(String(html), "text/html");
      return (doc.body?.textContent || "").replace(/\s+/g, " ").trim();
    } catch {
      return String(html).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    }
  }

  function makeExcerpt(text, maxLen) {
    const clean = (text || "").trim();
    if (!clean) return "";
    if (clean.length <= maxLen) return clean;
    return clean.slice(0, maxLen - 1).trimEnd() + "…";
  }

  function getTags(row) {
    const raw = row?.tags;
    if (!raw) return [];
    if (Array.isArray(raw)) return raw.filter(Boolean).map(String);
    if (typeof raw === "string") {
      return raw
        .split(/[,#]/g)
        .map((t) => t.trim())
        .filter(Boolean);
    }
    return [];
  }

  function safeCssEscape(value) {
    // CSS.escape is well-supported, but keep a tiny fallback for older engines.
    try {
      return CSS.escape(String(value));
    } catch {
      return String(value).replace(/[^a-zA-Z0-9_-]/g, "");
    }
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
      const link = document.createElement("a");
      link.className = "card homeArticleCard";
      link.href = `./articles.html?article=${encodeURIComponent(row.id)}`;
      link.setAttribute("aria-label", `Read article: ${row.title || "Untitled"}`);

      const media = document.createElement("div");
      media.className = "homeArticleMedia";

      if (row.image_url) {
        const img = document.createElement("img");
        img.className = "homeArticleImage";
        img.loading = "lazy";
        img.alt = `Cover image for ${row.title || "article"}`;
        img.src = row.image_url;
        media.appendChild(img);
      } else {
        const ph = document.createElement("div");
        ph.className = "homeArticlePlaceholder";
        ph.innerHTML = '<span aria-hidden="true" class="homeArticlePlaceholderIcon">✷</span>';
        media.appendChild(ph);
      }

      const body = document.createElement("div");
      body.className = "homeArticleBody";

      const title = document.createElement("h3");
      title.className = "homeArticleTitle";
      title.textContent = row.title || "Untitled";

      const meta = document.createElement("p");
      meta.className = "muted small homeArticleMeta";
      const authorName = row.author_display_name || "DragonByte";
      const date = formatShortDate(row.created_at);
      meta.textContent = date ? `By ${authorName} • ${date}` : `By ${authorName}`;

      const excerpt = document.createElement("p");
      excerpt.className = "muted homeArticleExcerpt";
      const plain = htmlToPlainText(row.content || "");
      excerpt.textContent = makeExcerpt(plain, 170);

      const tags = getTags(row).slice(0, 4);
      let tagRow = null;
      if (tags.length) {
        tagRow = document.createElement("div");
        tagRow.className = "homeArticleTags";
        tags.forEach((t) => {
          const chip = document.createElement("span");
          chip.className = "homeArticleTag";
          chip.textContent = `#${t.replace(/^#/, "")}`;
          tagRow.appendChild(chip);
        });
      }

      body.append(title, meta);
      if (excerpt.textContent) body.appendChild(excerpt);
      if (tagRow) body.appendChild(tagRow);

      link.append(media, body);
      mount.appendChild(link);
    });
  }

  async function load() {
    try {
      const { data, error } = await supabase
        .from("articles")
        .select("id, title, content, image_url, tags, created_at, user_id, author_display_name")
        .order("created_at", { ascending: false })
        .limit(MAX);

      if (error) throw error;

      render(data || []);
    } catch (err) {
      console.error("Error loading homepage articles", err);
      mount.innerHTML = "";
      const p = document.createElement("p");
      p.className = "muted";
      const msg = String(err?.message || "").toLowerCase();
      const hint =
        msg.includes("relation") || msg.includes("does not exist")
          ? " (It looks like the 'articles' table isn't created in Supabase yet.)"
          : "";
      p.textContent = `Could not load articles${hint}`;
      mount.appendChild(p);
    }
  }

  load();
}
