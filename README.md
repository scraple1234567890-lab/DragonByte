# StarSpell Academy site

Static site for the StarSpell Academy experience with Supabase-backed community posts.

## Supabase setup
1) Copy `js/config.example.js` to `js/config.js`.
2) Set `SUPABASE_URL` to your project URL (e.g., `https://your-project-id.supabase.co`).
3) Set `SUPABASE_ANON_KEY` to your **anon / publishable** key. Never expose the service role key in frontend code.
4) In Supabase Auth settings, add your GitHub Pages (or hosting) URL to the list of Redirect URLs so email links return to the site.

The frontend uses the existing Supabase Auth forms (`portal.html` / `login.html`) and reads the config at runtime.

## Running locally
1) Install dependencies: `npm install` (for the small helper scripts).
2) Start the local server for the static site and API passthrough:  
   ```bash
   node server.js
   ```  
   The site will be available at `http://localhost:3000`.

### Notes
- Posts are stored in Supabase `public.posts` via RLS; the browser only sends `{ body }` when posting.
- The feed shows the latest posts for guests, and logged-in users can create or delete their own posts.
- For production hosting (e.g., GitHub Pages), ensure `js/config.js` is populated in the deployed environment.
