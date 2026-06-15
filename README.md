# Equipment & Material Tracking

Static web app for tracking equipment and material logs by project.

## GitHub Pages

This folder is ready to publish from the repository root with GitHub Pages.

Recommended Pages settings:

- Source: Deploy from a branch
- Branch: `main`
- Folder: `/ (root)`

## Data Storage

The app can use Supabase for shared project data. If Supabase is not configured, it falls back to each user's browser local storage.

## Supabase Setup

1. Create a Supabase project.
2. Open the Supabase SQL Editor.
3. Run `supabase-schema.sql`.
4. Open `supabase-config.js`.
5. Paste your project URL and anon public key:

```js
window.EQUIPMENT_TRACKING_SUPABASE = {
  url: "https://YOUR-PROJECT.supabase.co",
  anonKey: "YOUR-ANON-KEY",
};
```

6. Commit and push the updated config file.

The app header shows whether it is using the shared database or local mode.

The included schema is intended for testing: anyone with the app URL can read and update the shared data through the public anon key. Add authentication and stricter row-level security before using it for controlled production access.
