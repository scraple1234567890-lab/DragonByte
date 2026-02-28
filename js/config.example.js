// Copy this file to `config.js` and replace the placeholders with your Supabase project values.
// Never use a service role key in the browser—only the anon/publishable key belongs here.

export const SUPABASE_URL = "https://your-project-id.supabase.co";
export const SUPABASE_ANON_KEY = "your-anon-key";

// Article publishing permissions
// Set ONE of the following so only a single account can publish/edit articles.
// - Recommended: EMAIL (easy)
// - Alternatively: USER ID (UUID)
//
// Example:
// export const ARTICLE_ADMIN_EMAIL = "you@example.com";
// export const ARTICLE_ADMIN_USER_ID = "00000000-0000-0000-0000-000000000000";

export const ARTICLE_ADMIN_EMAIL = "";
export const ARTICLE_ADMIN_USER_ID = "";
