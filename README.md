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
| `worker/index.js` | Cloudflare Worker: contact form (`/api/lead.php`), chat (`/api/chat.php`), leads inbox (`/leads.php`) |
| `worker/schema.sql` | Tables for the `profile-leads` D1 database |
| `wrangler.jsonc` | Cloudflare config |
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

`npm run build` writes the site to `_site/`. To test the form, chat and leads inbox locally, run `npm run build` then `npx wrangler dev` (uses a local copy of the database).

## Deploy

Hosted on **Cloudflare** as the Worker `profile` (moved from cPanel on 2026-11-25).
- **Push to `main` → Cloudflare Workers Builds** runs `npm run build`, then `npx wrangler deploy`. Other branches get a preview link.
- Manual deploy from this Mac: `npm run build && npx wrangler deploy`.
- Test link: https://profile.wheretospot.workers.dev

## Server-only settings

Secrets never go in git. Set them once in Cloudflare (dashboard → Workers → profile → Settings → Variables and Secrets, or `npx wrangler secret put NAME`):
- `ADMIN_PASSWORD`: password for `/leads.php`
- `ANTHROPIC_API_KEY`: optional; without it the chat gives a scripted reply and still saves the lead

Leads are stored in the D1 database `profile-leads` (never in public files). Lead emails are not sent yet: they will use Cloudflare Email Routing once wheretospot.com's DNS is on Cloudflare. Until then, check `/leads.php`.
