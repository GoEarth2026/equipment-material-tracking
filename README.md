# Equipment & Material Tracking

Static web app for tracking equipment and material logs by project.

## GitHub Pages

This folder is ready to publish from the repository root with GitHub Pages.

Recommended Pages settings:

- Source: Deploy from a branch
- Branch: `main`
- Folder: `/ (root)`

## Data Storage

The app uses Supabase for shared project data, user access, recovery snapshots, and submittal files. A working Supabase connection is required for editing.

## Supabase Setup

1. Create a Supabase project.
2. Open the Supabase SQL Editor.
3. Run `supabase-schema.txt`.
4. Open `supabase-config.js`.
5. Paste your project URL and anon public key:

```js
window.EQUIPMENT_TRACKING_SUPABASE = {
  url: "https://YOUR-PROJECT.supabase.co",
  anonKey: "YOUR-ANON-KEY",
};
```

6. Commit and push the updated config file.

7. In Supabase Authentication, set the Site URL and allowed redirect URL to the GitHub Pages app URL.
8. Create the first account with `jasonb@neearth.com`; it is automatically assigned Administrator access.

The app requires sign-in. New accounts begin with View Only access. Administrators can grant Editor or Administrator access from the Admin area. Shared data and submittal files are protected by Supabase row-level security. The app also creates daily recovery snapshots before saving changes.
