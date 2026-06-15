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

The current app stores edits, projects, archived projects, imported logs, notes, and admin lists in each user's browser local storage.

That means:

- The app can be shared for interface testing immediately.
- Each tester's edits are private to their own browser.
- Testers will not see each other's changes.
- Clearing browser data can remove local edits.

## Shared Updating Version

For real shared testing where multiple users update the same project data, the app needs a hosted data layer.

Good next step:

- Add Supabase or Firebase for shared projects, material log rows, admin lists, and notes.
- Add simple user identity or initials.
- Keep Excel import/export in the browser.

## Deployment Package Contents

The current deployable app folder is:

`/Users/jbabbidge/Documents/Codex/2026-06-15/equipment-material-tracking/outputs/equipment-material-tracking`
