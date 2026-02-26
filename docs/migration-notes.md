# Migration Notes: localStorage → Supabase

## What changed
- Auth is now Supabase Auth (email/password) instead of localStorage demo auth.
- Blog posts, comments, and likes are now loaded from Supabase tables.
- Profile data (`username`, `avatar_url`, `role`) is now in `profiles`.
- Payment card localStorage has been removed/disabled.

## User/account migration
- Existing localStorage users cannot be securely migrated automatically (password hashes were demo-only and not production safe).
- Ask existing users to re-register via Supabase signup.
- Optionally pre-create admin/writer users in Supabase and set roles in `profiles`.

## Content migration
- If you have local post/comment data in browser storage, export it manually and import via SQL/CSV.
- Current code falls back to `data/posts.json` as read-only seed content when Supabase has no posts.

## Role migration
- `lrl_writers` localStorage list is replaced with `profiles.role='writer'`.
- Assign admin/writer roles directly in Supabase:

```sql
update public.profiles set role = 'admin' where username = 'YourAdminUsername';
update public.profiles set role = 'writer' where username = 'WriterUsername';
```

## Operational checks
- Verify signup/login/logout with Supabase project config loaded.
- Verify auth session restore after refresh.
- Verify post/comment/like CRUD with RLS policies enabled.
