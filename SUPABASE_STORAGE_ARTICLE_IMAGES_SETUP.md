# Supabase Article Cover Images Setup

This site can upload an optional **cover image** for each article to Supabase Storage and save the **public URL** in `public.articles.image_url`.

## 1) Add the `image_url` column

Run in **Supabase SQL Editor**:

```sql
alter table public.articles
add column if not exists image_url text;
```

## 2) Create a Storage bucket

In **Supabase Dashboard → Storage → Buckets**:

- Create a bucket named: `article-images`
- Set it to: **Public**

## 3) Storage policies (required)

In **SQL Editor**, add policies for the `storage.objects` table.

> Note: Supabase policy UIs differ slightly by version. If your project already has Storage policies, adjust accordingly.

### Public read (anyone can view)

```sql
create policy "Public read article images"
on storage.objects for select
using (bucket_id = 'article-images');
```

### Upload policy (recommended: admin-only)

Because this bucket is **public**, it’s best to restrict uploads to the same account(s) that are allowed to publish articles.

#### Option A (single admin UUID)
Replace `YOUR_ADMIN_USER_UUID` with the UUID shown for your user in **Auth → Users**.

```sql
create policy "Admin upload article images"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'article-images'
  and auth.uid() = 'YOUR_ADMIN_USER_UUID'::uuid
  -- keep uploads under the user's own folder
  and name like (auth.uid()::text || '/%')
);
```

#### Option B (multiple admins)

If you want multiple admin accounts, create a tiny allow-list table and use it in both your `articles` policies and Storage policies.

```sql
create table if not exists public.article_admins (
  user_id uuid primary key
);

-- Add your admins
insert into public.article_admins (user_id)
values ('YOUR_ADMIN_USER_UUID'::uuid)
on conflict do nothing;

create policy "Admins upload article images"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'article-images'
  and exists (select 1 from public.article_admins a where a.user_id = auth.uid())
  and name like (auth.uid()::text || '/%')
);
```

### Delete policy (recommended: keep storage clean)

This site will attempt to delete old cover images when:
- you delete an article, or
- you replace the cover image while editing.

So it’s best to also allow **deletes** for the same admin(s) who can upload.

#### Option A (single admin UUID)

```sql
create policy "Admin delete own article images"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'article-images'
  and auth.uid() = 'YOUR_ADMIN_USER_UUID'::uuid
  -- only allow deleting objects inside the admin's folder
  and name like (auth.uid()::text || '/%')
);
```

#### Option B (multiple admins)

```sql
create policy "Admins delete own article images"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'article-images'
  and exists (select 1 from public.article_admins a where a.user_id = auth.uid())
  and name like (auth.uid()::text || '/%')
);
```

(Optional) If you later want admins to be able to delete **any** object in the bucket (not just their own folder),
remove the `name like ...` line, but that’s a bigger permission.


## 4) That’s it

When a user publishes an article with an image selected, the file uploads to:

`article-images/<userId>/<safeTitle>-<timestamp>-<random>.<ext>`

…and the public URL is stored in `articles.image_url`.

## Inline images inside article body

The rich article editor can also upload **inline images** (images inserted anywhere in the article text). These are stored in the same `article-images` bucket under:

- `<user_id>/inline/<title>-<timestamp>-<random>.<ext>`

No extra buckets or policies are required beyond what’s already listed above.
