# profile.wheretospot.com

Where To Spot's company profile: a bilingual (English / Arabic) creative-studio site covering printing, acrylic, branding, NFC smart cards, events, video, social media, web, AI and SEO, with a filterable portfolio ("Selected work") and client logos.

## How it's built

- `index.html`: the whole page. Inside `<x-dc>` is a template (HTML with `{{ }}` placeholders) plus one script that holds all the content (services, projects, clients, EN/AR text) and the page logic.
- `support.js`: the small runtime that renders the `<x-dc>` template (React 18 from unpkg). `image-slot.js`: image placeholders.
- `images/`: `work/` (portfolio), `clients/` (logos), `ph/` (service and section images). WebP, max 1800 px (logos 600 px). Some names are built in code: `images/ph/svc-<service>.webp`, `images/clients/color-01…23.webp`, `images/clients/mono-13…23.webp`.
- `api/chat.php`: the chat assistant. Sends the conversation to Claude (official Anthropic PHP SDK in `api/lib/vendor`, same as the shop) and gets back a short reply plus any contact details. With no API key it answers with a scripted reply that still collects the lead.
- `api/lead.php`: the contact form.
- `leads.php`: password-protected leads inbox with CSV download. Every new lead is also emailed to `lead_email`.
- Leads live in `profile-data/leads.jsonl`, next to (not inside) the website folder.
- "＋ Add project" and the footer "Leads" link only appear with `?edit=1` in the address. Projects added there are saved in that browser only.

## Settings (server only)

Copy `config.local.example.php` to `config.local.php` on the server and fill in `anthropic_api_key` (optional), `lead_email` and `admin_password_hash`. Never commit `config.local.php`.

## Run locally

The browser-pane server `profile-local` in `~/Documents/GitHub/.claude/launch.json` serves this folder with `php -S` and keeps test leads in a scratch folder. Leads inbox password locally: `profile-local`.

## Deploy

See `.cpanel.yml`. Confirm the document root first (cPanel > Domains), then in Git Version Control: Update from Remote, then Deploy HEAD Commit.

## Known issues

- About 10 harmless 404 requests per page load: the browser fetches `src="{{ … }}"` placeholders before the template renders. Fixing it needs a change to how the template runtime works.
- `images/ph/svc-nfc.png` doesn't exist on the live site either, so the NFC service has no image.
- The footer's Instagram / LinkedIn / TikTok links go nowhere (`#`).
