import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

if (!SUPABASE_URL || !SUPABASE_URL.startsWith("http")) {
  throw new Error("Supabase URL invalid. Check js/config.js SUPABASE_URL (must be https://xxxx.supabase.co).");
}

if (!SUPABASE_ANON_KEY) {
  throw new Error("Supabase key missing. Check js/config.js SUPABASE_ANON_KEY.");
}

console.log("Supabase URL:", SUPABASE_URL);

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
