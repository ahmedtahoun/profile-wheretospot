# Content cleanup list

Things to fix or confirm in the data files (`src/_data/`). Nothing here was invented; every item is existing content or a missing piece.


## 1. Generic project names to rename

These were grouped under a generic card name. They have temporary unique slugs; rename `title_en` / `title_ar` (and the slug if you like) in `projects.json`.

- **NFC Google-Review Cards** — `nfc-google-review-cards` (was shown under "Google Review")
- **Retail NFC Smart Cards** — `retail-nfc-smart-cards` (was shown under "NFC Smart Cards")
- **Client Collection** — `nfc-client-collection` (was shown under "NFC Smart Cards")
- **Multi-Brand NFC Table Stands** — `multi-brand-nfc-table-stands` (was shown under "NFC Smart Cards")
- **Acrylic Stand Set** — `google-review-acrylic-stand-set` (was shown under "Google Review")

## 2. Repeated project titles

The visible title repeats across clients; the slug includes the client so URLs are unique. Consider more specific titles.

- "Exhibition Booth" ×7: `enppi-exhibition-booth`, `huawei-exhibition-booth`, `elaraby-hospital-exhibition-booth`, `midos-food-beverage-distributor-exhibition-booth`, `elaraby-hospital-exhibition-booth-video`, `dynabook-intel-exhibition-booth`, `yuwell-exhibition-booth`
- "Event" ×6: `iconc-real-estate-event`, `invstx-event`, `rixos-premium-seagate-electrostar-event`, `rock-eden-event`, `elaraby-global-partners-conference-event`, `elaraby-global-partners-conference-event-2`
- "Product Shoot" ×3: `handcrafted-jewelry-product-shoot`, `handcrafted-bracelets-product-shoot`, `brass-cuff-decor-product-shoot`
- "Showroom" ×3: `nippon-paint-showroom`, `bosch-home-showroom`, `elaraby-store-showroom`
- "NFC Card" ×2: `tulip-fashion-store-nfc-card`, `mom-yas-burger-nfc-card`
- "Hijri New Year Post" ×2: `blue-max-hijri-new-year-post`, `hma-pharma-hijri-new-year-post`
- "Search Visibility" ×2: `maged-pharmacy-search-visibility`, `oriental-weavers-retail-search-visibility`
- "Booth Coverage" ×2: `enppi-booth-coverage`, `gasreg-booth-coverage`
- "Event Coverage" ×2: `huawei-event-coverage`, `bosch-event-coverage`
- "Branding" ×2: `dive-wiz-sam-into-the-adventure-branding`, `elfares-academy-for-horse-riding-branding`

## 3. Descriptions

Every project uses its category's one-line summary (e.g. "One-tap digital networking.") and has `description_todo: true`. Add a real `description_en` / `description_ar` per project; it shows on the project page. Category pages also have `description_todo: true` in `categories.json`.

- "Motion that stops the scroll." used by 26 projects
- "One-tap digital networking." used by 21 projects
- "Full production, concept to teardown." used by 16 projects
- "Content that grows audiences." used by 11 projects
- "Ranking clients on Google’s first page." used by 10 projects
- "Packaging & identity that elevate the brand." used by 6 projects
- "Custom AI built for your business." used by 4 projects
- "Sharp large-format print, on brand." used by 3 projects
- "Authentic creator content that sells." used by 3 projects
- "Automate the busywork, ship faster." used by 2 projects
- "Custom acrylic that turns heads." used by 1 projects
- "Fast, beautiful, built to convert." used by 1 projects

## 4. "Ten ways we make you stand out"

This heading (home page and /services/) sits above **12** services. Change `services_title` in `src/_data/i18n.json` (EN and AR).


## 5. Testimonials to confirm

Kept as they were, with `verified: false` in `testimonials.json`. Confirm they are real clients before launch, or remove them.

- Ahmed Al Mansouri, Marketing Director: "They turned our idea into reality — better quality than we imagined and incredibly fast."
- Sara Al Hajri, Founder: "One team for everything saved us serious time and money. Total peace of mind."
- Khalid Al Otaibi, CEO: "Attention to detail you rarely find in this market. We keep coming back."

## 6. Also found

- **Acrylic Display Stands** (`/work/acrylic/acrylic-display-stands/`): one project with 24 photos from several clients (CoffeeLab, Pandora, Falahy, Beda…). Split into one project per client? It's also the only project in Acrylic Solutions. Flag: `split_todo: true`.
- **Client logos** (`clients.json`): the 24 logo files have no names, so their alt text is empty. Add `name` for each so screen readers and Google can read them.
- **Stats** (`stats.json`): 500+ projects, 200+ clients, 8 years, 6 GCC countries. Confirm they are current.
- **Years**: no project has a `year`; the field stays empty until you add them.
- **Same title, different videos**: `elaraby-global-partners-conference-event` and `elaraby-global-partners-conference-event-2` are both "ElAraby Global Partners Conference — Event".
- **Swapped client/title**: "Personal Brand SEO" shows Omar Abdelshafy as the title (`personal-brand-seo-omar-abdelshafy`); "Pharmacy Retail Displays" shows Uriage as the title (`pharmacy-retail-displays-uriage`). Check which is the client.
- **Arabic video titles**: a few Arabic video titles were split differently from the English (e.g. `elaraby-hospital-exhibition-booth-video` shows "مستشفى — جناح المعرض"). Check `title_ar` / `client_ar` on video projects.
- **Removed**: the 3 empty "AI Project 1/2/3" placeholder cards.
