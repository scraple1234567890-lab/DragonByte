#!/usr/bin/env node
const crypto = require("crypto");

const DEFAULT_PROJECT_ID = "vnwdfitcckglvqaaohrm";
const DEFAULT_TABLE = "posts";

function usage() {
  console.log(`Create a Lore Board post in Supabase.

Usage:
  node scripts/create_supabase_post.js --author "Name" --school "School" --text "Post body" [--table posts]

Environment:
  SUPABASE_PROJECT_ID      Defaults to ${DEFAULT_PROJECT_ID}
  SUPABASE_URL             Defaults to https://<project>.supabase.co when omitted
  SUPABASE_SERVICE_KEY     Service or anon key used for the REST request (required)
  SUPABASE_POSTS_TABLE     Defaults to "${DEFAULT_TABLE}" when omitted
`);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      args.help = true;
      continue;
    }

    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        args[key] = next;
        i += 1;
      } else {
        args[key] = true;
      }
    }
  }
  return args;
}

function sanitizePost({ author, school, text }) {
  const cleanAuthor = String(author || "").trim();
  const cleanSchool = String(school || "").trim();
  const cleanText = String(text || "").trim();

  if (cleanAuthor.length < 2) throw new Error("Author must be at least 2 characters.");
  if (!cleanSchool) throw new Error("School is required.");
  if (cleanText.length < 12) throw new Error("Post must be at least 12 characters.");

  return {
    author: cleanAuthor.slice(0, 120),
    school: cleanSchool.slice(0, 80),
    text: cleanText.slice(0, 1200),
  };
}

function createId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const random = Math.floor(Math.random() * 1_000_000).toString().padStart(6, "0");
  return `post-${Date.now()}-${random}`;
}

async function createSupabasePost(config, post) {
  const response = await fetch(`${config.url}/rest/v1/${config.table}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      Prefer: "return=representation",
    },
    body: JSON.stringify([
      {
        id: createId(),
        created_at: new Date().toISOString(),
        ...post,
      },
    ]),
  });

  const raw = await response.text();
  let payload;
  try {
    payload = raw ? JSON.parse(raw) : null;
  } catch (err) {
    payload = raw;
  }

  if (!response.ok) {
    const reason = typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
    throw new Error(`Supabase rejected the request (${response.status}): ${reason}`);
  }

  const saved = Array.isArray(payload) && payload.length ? payload[0] : payload;
  console.log("Post stored in Supabase:", JSON.stringify(saved, null, 2));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    process.exit(0);
  }

  const sanitized = sanitizePost({
    author: args.author,
    school: args.school,
    text: args.text,
  });

  const projectId = args["project-id"] || process.env.SUPABASE_PROJECT_ID || DEFAULT_PROJECT_ID;
  const url = process.env.SUPABASE_URL || `https://${projectId}.supabase.co`;
  const key =
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY;

  if (!key) {
    throw new Error("Set SUPABASE_SERVICE_KEY (or service role/anon key) to send the request.");
  }

  const table = args.table || process.env.SUPABASE_POSTS_TABLE || DEFAULT_TABLE;
  await createSupabasePost({ url, key, table }, sanitized);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
