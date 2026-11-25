# profile.wheretospot.com

Bilingual (English / Arabic) portfolio site for Where To Spot. Built with [Eleventy](https://www.11ty.dev/): every page is plain HTML made at build time, so all content reads with JavaScript off. JavaScript only adds the dropdown, video player, photo lightbox and chat.

## Where things are

| Path | What it is |
|---|---|
| `src/_data/projects.json` | All 104 projects (titles, client, photos, video, featured) |
| `src/_data/categories.json` | The 12 work categories |
| `src/_data/services.json` | Service summaries and "what's included" lists |
| `src/_data/testimonials.json`, `clients.json`, `stats.json` | Home-page sections |
| `src/_data/site.json` | Site URL, email, phone, WhatsApp, socials |
| `src/_data/i18n.json` | Every interface string, `{en, ar}` |
| `src/*.njk`, `src/_includes/` | Page templates and shared parts |
| `src/assets/` | `site.css`, `site.js`, `contact.js` |
| `src/images/` | Original photos (resized to WebP at build time) |
| `php/` | Server code copied into the build: `api/chat.php`, `api/lead.php`, `leads.php`, `.htaccess` |
| `docs/URLS.md` | Every generated URL |
| `docs/CLEANUP.md` | Content still to fix or confirm |

Bilingual fields use `_en` / `_ar` suffixes. A missing `_ar` falls back to English.

## Add or change a project

Edit `src/_data/projects.json`. The page appears at `/work/{category}/{slug}/` and `/ar/work/{category}/{slug}/`. Put photos in `src/images/` and list them under `images` with `alt_en` / `alt_ar`. Set `"featured": true` to show it on the home page.

## Build locally

Needs Node 20+.

```bash
npm install
```

```bash
npm run dev
```

`npm run build` writes the site to `_site/`. To test the PHP form and chat locally, serve `_site/` with `php -S 127.0.0.1:8072 -t _site`.

## Deploy

Pushing to `main` runs `.github/workflows/deploy.yml`, which builds the site and force-pushes the result to the `deploy` branch. cPanel (Git Version Control) pulls the `deploy` branch and runs its `.cpanel.yml`, which copies the files into `/home/viorowzb/profile.wheretospot.com/`.

One-time cPanel setup: set the repository's checked-out branch to `deploy`, then Update from Remote → Deploy HEAD Commit.

## Server-only config

Secrets never go in git. On the server, create `profile.wheretospot.com/config.local.php` (site root) from `php/config.local.example.php` with the admin password hash (for `leads.php`) and, optionally, the Anthropic API key for the chat. Without a key the chat gives a scripted reply. Leads are saved outside the web root in `/home/viorowzb/profile-data/leads.jsonl`, never in public files.
