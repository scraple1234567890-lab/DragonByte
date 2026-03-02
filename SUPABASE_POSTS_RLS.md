# Supabase: Secure the short "posts" feed (RLS)

If you keep the short posts feed enabled (the "notes" / micro-posts), Row Level Security prevents:
- inserting posts on behalf of another user
- deleting other people's posts

## 1) Enable RLS
In Supabase:
- Table editor → `public.posts` → **RLS** → Enable.

## 2) Policies

```sql
-- Public read
create policy "Public read posts"
on public.posts
for select
to anon, authenticated
using (true);

-- Authenticated users can create posts, but only for themselves
create policy "User insert own posts"
on public.posts
for insert
to authenticated
with check (
  auth.uid() = user_id
);

-- (Optional) Allow users to delete their own posts
create policy "User delete own posts"
on public.posts
for delete
to authenticated
using (
  auth.uid() = user_id
);

-- (Optional) If you ever add edit support
create policy "User update own posts"
on public.posts
for update
to authenticated
using (
  auth.uid() = user_id
)
with check (
  auth.uid() = user_id
);
```

## Notes
- If you already have policies like "any authenticated user can delete", remove/disable them.
- The website client already sets `user_id` when inserting, but **RLS is the real protection**.
