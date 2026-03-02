-- Supabase schema for InkAndCrayons
-- Run in Supabase SQL editor to create or restore the schema.
-- WARNING: posts/comments use bigint identity PKs (not UUID) to match
-- the production database in use at xdskiwtfpmourcokaehr.supabase.co

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  avatar_url text,
  role text not null default 'user' check (role in ('admin', 'writer', 'user')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.posts (
  id bigint generated always as identity primary key,
  author_id uuid not null references public.profiles(id) on delete cascade,
  author_name text not null,
  title text not null,
  body text not null,
  category text not null default 'all',
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.comments (
  id bigint generated always as identity primary key,
  post_id bigint not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  author_name text not null,
  body text not null,
  status text not null default 'visible' check (status in ('visible', 'flagged', 'hidden')),
  created_at timestamptz not null default now()
);

create table if not exists public.post_likes (
  id bigint generated always as identity primary key,
  post_id bigint not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);

create table if not exists public.comment_reactions (
  id bigint generated always as identity primary key,
  comment_id bigint not null references public.comments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  unique (comment_id, user_id, emoji)
);

create index if not exists idx_posts_created_at     on public.posts(created_at desc);
create index if not exists idx_posts_published       on public.posts(is_published);
create index if not exists idx_comments_post_id      on public.comments(post_id);
create index if not exists idx_comments_status       on public.comments(status);
create index if not exists idx_post_likes_post_id    on public.post_likes(post_id);
create index if not exists idx_comment_reactions_cid on public.comment_reactions(comment_id);
create index if not exists idx_profiles_role         on public.profiles(role);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists trg_posts_updated_at on public.posts;
create trigger trg_posts_updated_at
before update on public.posts
for each row execute function public.set_updated_at();
