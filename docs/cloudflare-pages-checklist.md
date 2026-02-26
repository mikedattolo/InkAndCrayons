# Cloudflare Pages Deployment Checklist

## 1) Project setup
- Connect repository in Cloudflare Pages.
- Build command: none (or empty) for pure static hosting.
- Build output directory: `/` (root).

## 2) Runtime config file generation
Because static client code cannot read Cloudflare env vars directly at runtime, generate `config/runtime-config.js` during build.

Example build command:

```bash
cat > config/runtime-config.js <<'EOF'
window.__LRL_CONFIG__ = {
  SUPABASE_URL: "${SUPABASE_URL}",
  SUPABASE_ANON_KEY: "${SUPABASE_ANON_KEY}"
};
EOF
```

## 3) Cloudflare Pages environment variables
Set these in Pages project settings:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

## 4) Supabase project settings
- Enable Email/Password auth provider.
- Configure Site URL and redirect URLs:
  - `https://your-domain.example/`
  - `https://your-domain.example/blog.html`
- Run `supabase/schema.sql` then `supabase/rls-policies.sql`.

## 5) Post-deploy verification
- Signup/login/logout works.
- Session persists on refresh.
- Profile update works.
- Blog posts/comments/likes read/write works with role rules.
- Contact, Privacy, Terms pages open.

## 6) Security sanity checks
- No hardcoded admin credentials in code.
- No payment/card details stored in localStorage.
- No unsafe `innerHTML` for user-generated content.
