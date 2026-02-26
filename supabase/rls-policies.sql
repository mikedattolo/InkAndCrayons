-- Starter RLS policies for LittleRootsLearning
-- Run after schema.sql

alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.likes enable row level security;

-- PROFILES
create policy "profiles readable by everyone"
on public.profiles for select
using (true);

create policy "users can insert own profile"
on public.profiles for insert
with check (auth.uid() = id);

create policy "users can update own profile"
on public.profiles for update
using (auth.uid() = id)
with check (auth.uid() = id);

-- POSTS
create policy "posts readable by everyone"
on public.posts for select
using (true);

create policy "admin_or_writer_can_create_posts"
on public.posts for insert
with check (
  auth.uid() = author_id
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'writer')
  )
);

create policy "admin_or_owner_writer_can_update_posts"
on public.posts for update
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (
        p.role = 'admin'
        or (p.role = 'writer' and public.posts.author_id = auth.uid())
      )
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (
        p.role = 'admin'
        or (p.role = 'writer' and public.posts.author_id = auth.uid())
      )
  )
);

create policy "admin_or_owner_writer_can_delete_posts"
on public.posts for delete
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (
        p.role = 'admin'
        or (p.role = 'writer' and public.posts.author_id = auth.uid())
      )
  )
);

-- COMMENTS
create policy "comments readable by everyone"
on public.comments for select
using (true);

create policy "signed_in_users_can_comment"
on public.comments for insert
with check (auth.uid() = author_id);

create policy "comment_owner_or_admin_can_delete"
on public.comments for delete
using (
  auth.uid() = author_id
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

-- LIKES
create policy "likes readable by everyone"
on public.likes for select
using (true);

create policy "signed_in_users_can_like"
on public.likes for insert
with check (auth.uid() = user_id);

create policy "users_can_unlike_own"
on public.likes for delete
using (auth.uid() = user_id);
