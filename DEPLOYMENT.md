# Equipment & Material Tracking Deployment

## Quick Live Test Deployment

This app is a static site. To make it live for testing, deploy the contents of this folder:

- `index.html`
- `styles.css`
- `app.js`
- `workbook-data.json`

Recommended quick hosts:

- Netlify Drop
- Vercel static project
- GitHub Pages

For the fastest non-technical test, use Netlify Drop:

1. Go to Netlify Drop.
2. Drag the `equipment-material-tracking` folder onto the page.
3. Netlify will create a live URL.
4. Share that URL with testers.

## Important Data Note

The app requires Supabase for shared project data, authenticated access, recovery snapshots, and submittal files. Editing is disabled whenever the shared database is unavailable, while unsaved browser changes remain queued for retry.

## Shared Updating Version

For shared testing where multiple users update the same project data:

1. Create a Supabase project.
2. Run `supabase-schema.txt` in the Supabase SQL Editor.
3. Add the project URL and anon key to `supabase-config.js`.
4. Commit and push the config update to GitHub.
5. Set the Supabase Authentication Site URL and redirect URL to the deployed app URL.
6. Sign up with `jasonb@neearth.com` to create the first Administrator account.

## Deployment Package Contents

The current deployable app folder is:

`/Users/jbabbidge/Documents/Codex/2026-06-15/equipment-material-tracking/outputs/equipment-material-tracking`
