// The list of pages Eleventy generates, in English and Arabic.
// Templates paginate over these arrays; each item knows its language and the data it shows.
import fs from "node:fs";

const read = (f) => JSON.parse(fs.readFileSync(new URL(f, import.meta.url), "utf8"));
const categories = read("./categories.json").sort((a, b) => a.order - b.order);
const services = read("./services.json");
const projects = read("./projects.json");

const LANGS = ["en", "ar"];
const inCat = (slug) => projects.filter((p) => p.category === slug);

// 3 related projects from the same category, starting after this one (wraps around).
function related(p) {
  const list = inCat(p.category);
  if (list.length < 2) return [];
  const i = list.findIndex((x) => x.slug === p.slug);
  const out = [];
  for (let k = 1; k < list.length && out.length < 3; k++) out.push(list[(i + k) % list.length]);
  return out;
}

// Every page path (without the /ar prefix), for the sitemap.
const allPaths = ["/", "/services/", "/work/", "/about/", "/contact/"]
  .concat(categories.flatMap((c) => ["/services/" + c.slug + "/", "/work/" + c.slug + "/"]))
  .concat(projects.map((p) => "/work/" + p.category + "/" + p.slug + "/"));

export default {
  allPaths,
  langs: LANGS.map((lang) => ({ lang })),
  categories: LANGS.flatMap((lang) => categories.map((cat) => ({ lang, cat, projects: inCat(cat.slug) }))),
  services: LANGS.flatMap((lang) =>
    categories.map((cat) => ({ lang, cat, service: services.find((s) => s.slug === cat.slug), projects: inCat(cat.slug).slice(0, 3), total: inCat(cat.slug).length }))
  ),
  projects: LANGS.flatMap((lang) =>
    projects.map((p) => ({ lang, p, cat: categories.find((c) => c.slug === p.category), related: related(p) }))
  ),
};
