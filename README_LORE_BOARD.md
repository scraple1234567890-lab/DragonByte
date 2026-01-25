## Lore Board

The Lore Board is a daily-updating notice wall on the homepage where short in-universe posts from StarSpell’s four schools appear. It keeps the aesthetic of the existing site while quietly refreshing with new lore entries.

### Where posts live
- Posts are stored in `data/posts.json` as an array of objects with `id`, `author`, `school`, `createdAt`, and `text`.
- The browser fetches the file from `./data/posts.json` with `cache: "no-store"` so recent updates are visible quickly.

### How posts are added each day
- `.github/workflows/daily-lore-post.yml` runs on a daily cron (UTC) and on manual dispatch.
- The workflow checks out the repo, runs the generator, commits, and pushes the updated `data/posts.json` using bot credentials.

### Run the generator locally
```bash
node scripts/add_post.js
```
This will append a new post (keeping only the latest 300) to `data/posts.json`.

### Run the site with shared posting
```bash
node server.js
```
This serves the site for local development (static content only).

### Viewing the feed
- Open the homepage and scroll or jump to `#board` to see “The Lore Board” section. The newest 20 posts render there, newest first, with a graceful message if fetching fails.
