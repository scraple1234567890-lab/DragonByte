import { supabase } from "./supabaseClient.js";

const feed = document.getElementById("archiveFeed");

const limitAttr = feed ? Number(feed.getAttribute("data-limit")) : null;
const POST_LIMIT = Number.isFinite(limitAttr) && limitAttr > 0 ? limitAttr : 80;

function setMessage(message, tone = "muted") {
  if (!feed) return;
  feed.innerHTML = "";
  const p = document.createElement("p");
  p.className = `${tone}`;
  p.textContent = message;
  feed.appendChild(p);
}

function formatDate(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "Unknown time";
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function renderPosts(posts) {
  if (!feed) return;

  feed.innerHTML = "";

  if (!posts.length) {
    setMessage("No community posts yet. Share something to begin the feed.");
    return;
  }

  posts.forEach((post) => {
    const article = document.createElement("article");
    article.className = "card";
    article.dataset.id = post.id;

    const meta = document.createElement("p");
    meta.className = "muted small";
    meta.textContent = formatDate(post.created_at);

    const body = document.createElement("p");
    body.className = "postBody";
    body.style.whiteSpace = "pre-wrap";
    body.textContent = post.content || "";

    article.append(meta, body);
    feed.appendChild(article);
  });
}

async function loadPosts() {
  if (!feed) return;
  setMessage("Loading community posts...");
  try {
    const { data, error } = await supabase
      .from("posts")
      .select("id, content, created_at")
      .order("created_at", { ascending: false })
      .limit(POST_LIMIT);

    if (error) throw error;

    renderPosts(data || []);
  } catch (error) {
    console.error("Error loading community posts", error);
    setMessage(`Unable to load posts: ${error?.message || "Unknown error"}`, "error");
  }
}

function subscribeToPosts() {
  if (!feed) return null;
  return supabase
    .channel("community-posts")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "posts" },
      () => {
        loadPosts();
      },
    )
    .subscribe();
}

async function init() {
  if (!feed) return;
  await loadPosts();
  subscribeToPosts();
}

init();
