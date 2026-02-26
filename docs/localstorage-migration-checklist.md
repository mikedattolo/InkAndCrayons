# One-time localStorage Migration Checklist

## Critical warning (read first)
`localStorage` is origin-scoped. If you move from one origin/domain to another, browser localStorage does not transfer automatically.

Examples of different origins:
- `http://localhost:8000`
- `https://inkandcrayons.pages.dev`
- `https://www.yourcustomdomain.com`

Run backup/export on the old origin before switching.

## Steps
1. Open the existing site on the old origin.
2. In browser dev tools console, run:
   - `window.LRLMigration.detectProjectLocalStorageKeys()`
   - `window.LRLMigration.downloadLegacyBackup()`
3. Save the generated JSON backup file.
4. Configure Supabase runtime config and sign in as admin/writer.
5. Optional import to Supabase:
   - `await window.LRLMigration.importLegacyToSupabase({ includeComments: true, includeLikes: false })`
6. Verify posts/comments in UI.
7. Verify Supabase tables `posts` and `comments` contain migrated data.
8. Keep fallback enabled until content verification is complete.
9. After verification, remove fallback reads in a follow-up cleanup PR.
