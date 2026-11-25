# Multi-page rebuild: plan for approval

Status: approved and built (2026-11-25). See README.md for how to edit and deploy, docs/URLS.md for every URL, docs/CLEANUP.md for content to fix.

## 1. Generator: Eleventy (11ty)

Eleventy over Astro, because:

- **It's a content site, not an app.** Eleventy turns data files + templates into plain HTML with zero client JavaScript by default. Astro does that too, but is built around components and islands we don't need.
- **One project page per data entry is a built-in feature** (pagination over `projects.json`). EN and AR mirrors are the same templates run twice.
- **Templates stay readable** (Nunjucks, close to HTML), so content changes later are edits to JSON files, not code.
- **Fewer moving parts:** two dependencies (`@11ty/eleventy`, `@11ty/eleventy-img`). The image plugin makes responsive WebP sizes (`srcset`) at build time, which matters for the Lighthouse 90+ target.

The React runtime (`support.js`, React from unpkg, `image-slot.js`) goes away completely. Every page is server-rendered HTML; JavaScript only adds the lightbox, ticker, rotating hero word, phone menu, chat widget and form submit.

## 2. Build and deploy

cPanel shared hosting can't run the build, so (same pattern as Cairo Roast):

1. You or I push to `main`.
2. GitHub Actions runs `npm ci && npx @11ty/eleventy` and pushes the built `_site/` to a `deploy` branch, with the `.cpanel.yml` that copies it.
3. cPanel Git Version Control tracks `deploy`: Update from Remote, then Deploy HEAD Commit (as now).

The PHP parts (`api/chat.php`, `api/lead.php`, `leads.php`, `api/lib`) are copied into the build untouched. `leads.php` stays a password-protected server page that nothing links to; no lead data ever goes into public HTML or JS.

## 3. File structure

```
profile-wheretospot/
├── package.json, eleventy.config.js
├── .github/workflows/deploy.yml     build on push to main → deploy branch
├── src/
│   ├── _data/
│   │   ├── site.json                name, URL, phone, email, socials, showreel id
│   │   ├── i18n.json                every interface string, en + ar
│   │   ├── categories.json          12 entries
│   │   ├── services.json            12 entries, one per category (same slug)
│   │   ├── projects.json            all projects (photo + video + AI)
│   │   ├── testimonials.json, clients.json, stats.json
│   │   └── pages.js                 builds the EN/AR page list for pagination
│   ├── _includes/
│   │   ├── base.njk                 <head> (title, meta, canonical, hreflang, OG/Twitter), header, footer
│   │   └── partials/                header, footer, project-card, gallery, cta, chat, breadcrumbs
│   ├── home.njk                     /  and /ar/
│   ├── services.njk, service.njk    /services/ and /services/{slug}/
│   ├── work.njk, category.njk       /work/ and /work/{category}/
│   ├── project.njk                  /work/{category}/{project}/
│   ├── about.njk, contact.njk, 404.njk, sitemap.xml.njk, robots.txt.njk
│   ├── assets/css/site.css          one stylesheet, design tokens, one .container
│   ├── assets/js/site.js            menu, lightbox, ticker, hero word
│   ├── assets/js/chat.js, contact.js
│   └── images/                      current images (originals for eleventy-img)
└── php/                             api/, leads.php, .htaccess (copied as-is)
```

## 4. Data schema

Field names follow your brief (`name_en` / `name_ar`). Anything not in today's content is `null` or marked `TODO`, never invented.

**categories.json**
```json
{ "slug": "events", "name_en": "Events", "name_ar": "الفعاليات",
  "blurb_en": "Full event production, concept to teardown.", "blurb_ar": "…",
  "description_en": "…", "description_ar": "…", "description_todo": true,
  "icon": "events", "order": 5 }
```

**services.json** (same slug as its category)
```json
{ "slug": "events", "tags_en": ["Booths", "Activations", "Production"], "tags_ar": ["أجنحة", "تفعيلات", "إنتاج"],
  "summary_en": "Full event production, concept to teardown.", "summary_ar": "…" }
```

**projects.json**
```json
{ "slug": "rosatom-media-wall-podium", "category": "events",
  "title_en": "Media Wall & Podium", "title_ar": "…", "client": "Rosatom",
  "summary_en": "Full production, concept to teardown.", "summary_ar": "…",
  "description_en": null, "description_ar": null, "description_todo": true,
  "images": [{ "src": "images/work/rosatom-wall-front.png", "alt_en": "…", "alt_ar": "…" }],
  "video_url": null, "year": null, "featured": false, "rename_todo": false }
```
For video projects, `video_url` is the YouTube embed and `images[0]` is the YouTube thumbnail (also used as the share image).

**testimonials.json**
```json
{ "name": "Ahmed Al Mansouri", "role_en": "Marketing Director", "role_ar": "…",
  "quote_en": "…", "quote_ar": "…", "verified": false }
```
**clients.json** `{ "logo": "images/clients/color-01.png", "name": null }`, where `name` is a TODO (needed for alt text).
**stats.json** `{ "value": 500, "suffix": "+", "label_en": "Projects delivered", "label_ar": "…" }`

## 5. Categories and slugs (same in EN and AR)

| # | Slug | Category | Projects |
|---|---|---|---|
| 1 | `digital-printing` | Digital Printing | 3 |
| 2 | `acrylic` | Acrylic Solutions | 1 (24 images) |
| 3 | `branding` | Branding & Identity | 6 |
| 4 | `nfc-smart-cards` | NFC Smart Cards | 21 |
| 5 | `events` | Events | 16 |
| 6 | `video-production` | Video Production | 26 |
| 7 | `social-media` | Social Media | 11 |
| 8 | `web-development` | Web Development | 1 |
| 9 | `ai-solutions` | AI Solutions | 4 |
| 10 | `ai-automation` | AI Automation | 2 |
| 11 | `seo` | SEO | 10 |
| 12 | `ugc` | UGC | 3 |

**104 projects**: 68 photo projects + 25 gallery videos + 11 AI/UGC videos, with the video mapping in section 6. The 3 empty "AI Project" placeholders are not counted.

## 6. Where the videos go (default; tell me what to change)

- **Video Production:** all 22 event, booth, showroom and store coverage videos (Rosatom COP27, Enppi, Huawei ×2, Bosch ×2, Samsung, Yuwell, Elaraby ×4, Rock Eden ×2, …), the two "Branding" videos (Dive Wiz Sam, ElFares Academy), plus "Phone Mock-up — Reminder Video" and "MediLink360 — How to Book Through the App".
- **Web Development:** Dive Wiz Sam | Website Development.
- **AI Solutions:** Smart Chatbot demo, AI Assistant support demo, AI-Powered System walkthrough, AI English System for Learning.
- **AI Automation:** AI Booking Automation, AI Workflow Automation.
- **UGC:** Grevo UGC ×2, QR Codes & SEO UGC.
- **Removed:** "AI Project 1/2/3" (empty placeholder cards with placeholder images).

## 7. Pages and URLs

Per language: home 1 + services index 1 + 12 service pages + work index 1 + 12 category pages + 104 project pages + about 1 + contact 1 = **133 pages**, so **266** with the Arabic mirror, plus one bilingual 404. Every page gets its own title, description, canonical, `hreflang` en/ar/x-default, and Open Graph + Twitter image (a project's first image). Arabic pages: `lang="ar" dir="rtl"`. The language toggle links to the same page in the other language.

## 8. Layout

- Tokens: `--content-max: 1240px; --gutter: clamp(20px, 5vw, 48px)`. One `.container { max-width: var(--content-max); padding-inline: var(--gutter); margin-inline: auto }` used by every section.
- Full-width backgrounds, the ticker and the logo marquee keep their full width; their content sits in `.container`.
- Long text: `max-width: 65ch` aligned to the start edge (left in EN, right in AR), never centred in its own box.
- The 1280px / 1500px section widths are removed.
- Images: `loading="lazy"` below the fold, width/height set (no layout shift), responsive `srcset`, alt text in both languages (from the project title until real alt text is written).

## 9. Cleanup list (for you; nothing invented)

1. **Generic titles to rename** (temporary unique slugs in brackets):
   - "NFC Smart Cards" ×4: NFC Google-Review Cards (`nfc-google-review-cards`), Retail NFC Smart Cards (`retail-nfc-smart-cards`), Client Collection (`nfc-client-collection`), Multi-Brand NFC Table Stands (`multi-brand-nfc-table-stands`).
   - "Google Review": Acrylic Stand Set (`google-review-acrylic-stand-set`).
   - Repeated sub-titles that become the visible project title: "Product Shoot" ×3 (Handcrafted Jewelry, Handcrafted Bracelets, Brass Cuff & Décor), "Exhibition Booth" ×3 (Enppi, Huawei, ELARABY Hospital), "Hijri New Year Post" ×2, "Search Visibility" ×2, "NFC Card" ×2. These get the client name in the slug, e.g. `huawei-exhibition-booth`.
2. **One repeated line per category** ("One-tap digital networking.", "Content that grows audiences." …) is kept as the summary. Every project gets `description_todo: true`.
3. **"Ten ways we make you stand out"** sits above 12 services.
4. **Testimonials:** the three are kept with `verified: false`. Confirm they're real before launch.
5. **Other things I found:**
   - **Acrylic Display Stands:** one project holding 24 images from several clients (CoffeeLab, Pandora, Falahy, Beda…). Split per client?
   - **Client logos:** the 24 files have no names (`color-01.png` …), so I can't write proper alt text.
   - **Stats:** 500+ projects, 200+ clients, 8 years, 6 GCC countries. Confirm they're current.
   - **Project years:** no project has a year; the field stays empty.
   - **Duplicate videos:** "ElAraby Global Partners Conference — Event" appears twice with two different videos.

## 10. Remove from the public site

"＋ Add project", "＋ Add client logo", the add modal, the "Leads" link and panel, and every localStorage lead store. All gone because the React page goes away entirely. The chat posts to `api/chat.php` and the form to `api/lead.php`, as today.
