# Supabase: Lock article publishing to one account (RLS)

Client-side checks (the website UI) are helpful, but **Row Level Security (RLS)** is what actually prevents other logged-in users from inserting/updating/deleting rows.

## 1) Enable RLS
In Supabase:
- Table editor → `public.articles` → **RLS** → Enable.

## 2) Add policies
Pick **ONE** admin identifier:
- **Option A (recommended): Admin user UUID**
- **Option B: Admin email** (works, but depends on the `email` JWT claim)

### Option A: Admin user UUID (recommended)
Replace `YOUR_ADMIN_USER_UUID` with the UUID shown for your user in **Auth → Users**.

```sql
-- Allow everyone to read articles
create policy "Public read articles"
on public.articles
for select
to anon, authenticated
using (true);

-- Only the admin user can create articles
create policy "Admin insert articles"
on public.articles
for insert
to authenticated
with check (
  auth.uid() = 'YOUR_ADMIN_USER_UUID'::uuid
  and user_id = auth.uid()
);

-- Only the admin user can edit their own articles
create policy "Admin update own articles"
on public.articles
for update
to authenticated
using (
  auth.uid() = 'YOUR_ADMIN_USER_UUID'::uuid
  and user_id = auth.uid()
)
with check (
  auth.uid() = 'YOUR_ADMIN_USER_UUID'::uuid
  and user_id = auth.uid()
);

-- Only the admin user can delete their own articles
create policy "Admin delete own articles"
on public.articles
for delete
to authenticated
using (
  auth.uid() = 'YOUR_ADMIN_USER_UUID'::uuid
  and user_id = auth.uid()
);
```

### Option B: Admin email
Replace `you@example.com` with your login email.

```sql
-- Allow everyone to read articles
create policy "Public read articles"
on public.articles
for select
to anon, authenticated
using (true);

-- Only the admin email can create articles
create policy "Admin insert articles"
on public.articles
for insert
to authenticated
with check (
  lower((auth.jwt() ->> 'email')) = lower('you@example.com')
  and user_id = auth.uid()
);

-- Only the admin email can edit their own articles
create policy "Admin update own articles"
on public.articles
for update
to authenticated
using (
  lower((auth.jwt() ->> 'email')) = lower('you@example.com')
  and user_id = auth.uid()
)
with check (
  lower((auth.jwt() ->> 'email')) = lower('you@example.com')
  and user_id = auth.uid()
);

-- Only the admin email can delete their own articles
create policy "Admin delete own articles"
on public.articles
for delete
to authenticated
using (
  lower((auth.jwt() ->> 'email')) = lower('you@example.com')
  and user_id = auth.uid()
);
```

## Notes
- If you already had “any authenticated user can insert” policies, remove/disable them, or they will override your intent.
- If you also want to lock down article cover images, mirror the same idea in Storage bucket policies.
