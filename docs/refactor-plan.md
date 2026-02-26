# Refactor Plan (Cloudflare Pages + Supabase)

## Phase 1 — Security + cleanup
1. Remove localStorage auth demo path and seeded credentials.
2. Disable local card/payment storage and remove card persistence logic.
3. Replace user-generated `innerHTML` rendering with safe DOM rendering (`textContent`, `createElement`).
4. Add input sanitization/validation for usernames, profile URLs, comments, and admin URL inputs.
5. Remove obsolete auth demo module.

## Phase 2 — Supabase Auth
1. Add runtime config and Supabase client modules.
2. Add dedicated auth service (`auth/supabaseAuth.js`).
3. Keep existing auth UI handlers; convert to async flow.
4. Implement signup/login/logout/session restore/auth-state listener.
5. Add password-reset scaffold endpoint + UI button.

## Phase 3 — Database-backed blog/comments/likes
1. Add Supabase blog service for posts/comments/likes queries.
2. Replace localStorage post/comment/like writes with DB operations.
3. Keep current blog UI layout/behavior.
4. Add loading and error status messages for async actions.

## Phase 4 — Roles + permissions
1. Add `profiles.role` support (`admin`, `writer`, `user`).
2. Enforce role checks in UI for create/edit/delete controls.
3. Align operations to RLS policy model.

## Phase 5 — Cloudflare Pages readiness
1. Use relative paths (`./`) in key entry points.
2. Load runtime config before app scripts.
3. Keep static-hosting compatible browser-only modules.

## Phase 6 — Launch polish
1. Confirm favicon usage.
2. Add canonical and OG metadata.
3. Add static `privacy.html`, `terms.html`, and `contact.html` pages.
