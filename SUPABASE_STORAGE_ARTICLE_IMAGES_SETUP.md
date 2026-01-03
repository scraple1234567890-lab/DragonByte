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

### Authenticated upload (logged-in users can upload)

```sql
create policy "Authenticated upload article images"
on storage.objects for insert
to authenticated
with check (bucket_id = 'article-images');
```

(Optional) If you later add “delete image”, you can add:

```sql
create policy "Authenticated delete own article images"
on storage.objects for delete
to authenticated
using (bucket_id = 'article-images' and owner = auth.uid());
```

## 4) That’s it

When a user publishes an article with an image selected, the file uploads to:

`article-images/<userId>/<safeTitle>-<timestamp>-<random>.<ext>`

…and the public URL is stored in `articles.image_url`.
