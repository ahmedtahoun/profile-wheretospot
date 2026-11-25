// Eleventy build for profile.wheretospot.com.
// Every page is plain HTML generated here; JavaScript in the browser only adds enhancements.
import Image from "@11ty/eleventy-img";
import fs from "node:fs";

const i18n = JSON.parse(fs.readFileSync("src/_data/i18n.json", "utf8"));
const site = JSON.parse(fs.readFileSync("src/_data/site.json", "utf8"));

const escapeHtml = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export default function (eleventyConfig) {
  // Files copied as they are.
  eleventyConfig.addPassthroughCopy({ "src/images": "images" });
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });
  // Server URLs (/api/*, /leads.php) are answered by the Cloudflare Worker in worker/index.js.

  // Interface text: {{ "nav_work" | t(lang) }}, with {placeholders}: {{ "photos" | t(lang, {n: 3}) }}
  eleventyConfig.addFilter("t", (key, lang, vars) => {
    const entry = i18n[key];
    if (!entry) throw new Error(`Missing i18n key: ${key}`);
    let s = entry[lang] ?? entry.en;
    if (vars && typeof s === "string") for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, v);
    return s;
  });
  // Bilingual data fields: {{ project | f("title", lang) }} reads title_ar, falling back to title_en.
  eleventyConfig.addFilter("f", (obj, field, lang) => obj?.[`${field}_${lang}`] ?? obj?.[`${field}_en`] ?? obj?.[field] ?? "");
  // Localised path: "/work/" -> "/ar/work/" on Arabic pages.
  eleventyConfig.addFilter("lp", (path, lang) => (lang === "ar" ? "/ar" + path : path));
  eleventyConfig.addFilter("abs", (path) => site.url + (path.startsWith("/") ? path : "/" + path));
  eleventyConfig.addFilter("byCategory", (projects, slug) => projects.filter((p) => p.category === slug));
  eleventyConfig.addFilter("featured", (projects) => projects.filter((p) => p.featured));
  eleventyConfig.addFilter("findBySlug", (list, slug) => list.find((x) => x.slug === slug));
  eleventyConfig.addFilter("limit", (arr, n) => (arr || []).slice(0, n));
  eleventyConfig.addFilter("shareImage", (src) => (/^https?:/.test(src) ? src : site.url + "/" + src));

  // Responsive images. Local files get WebP sizes + srcset; YouTube thumbnails are used as they are.
  eleventyConfig.addNunjucksAsyncShortcode("img", async (src, alt, sizes = "100vw", cls = "", eager = false) => {
    const loading = eager ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"';
    if (/^https?:/.test(src)) {
      return `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" width="480" height="360" class="${cls}" ${loading} decoding="async">`;
    }
    const meta = await Image(`src/${src}`, {
      widths: [480, 960, 1600],
      formats: ["webp"],
      outputDir: "_site/img/",
      urlPath: "/img/",
      cacheOptions: { duration: "1d" },
    });
    const list = meta.webp;
    const largest = list[list.length - 1];
    const srcset = list.map((m) => `${m.url} ${m.width}w`).join(", ");
    return `<img src="${list[Math.min(1, list.length - 1)].url}" srcset="${srcset}" sizes="${sizes}" alt="${escapeHtml(alt)}" width="${largest.width}" height="${largest.height}" class="${cls}" ${loading} decoding="async">`;
  });

  // Share image for link previews (WhatsApp, LinkedIn, email): a 1200px JPEG, since not every app shows WebP.
  eleventyConfig.addNunjucksAsyncShortcode("ogimg", async (src, fallback) => {
    src = src || fallback;
    if (/^https?:/.test(src)) return src;
    const meta = await Image(`src/${src}`, { widths: [1200], formats: ["jpeg"], outputDir: "_site/img/og/", urlPath: "/img/og/", sharpJpegOptions: { quality: 80 } });
    return site.url + meta.jpeg[0].url;
  });

  return {
    dir: { input: "src", output: "_site", includes: "_includes", data: "_data" },
    templateFormats: ["njk"],
    htmlTemplateEngine: "njk",
  };
}
