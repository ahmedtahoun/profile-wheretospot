// profile.wheretospot.com on Cloudflare.
// Static pages come from the Eleventy build (_site). This Worker only answers the three server URLs,
// kept the same as the old PHP ones so the page scripts did not change:
//   POST /api/lead.php  contact form        POST /api/chat.php  site chat        /leads.php  leads inbox
// Leads and rate limits live in the D1 database bound as DB. Secrets (set with `wrangler secret put`):
//   ADMIN_PASSWORD     password for /leads.php
//   ANTHROPIC_API_KEY  optional; without it the chat gives a scripted reply and still collects the lead
import Anthropic from "@anthropic-ai/sdk";

const CHAT_MODEL = "claude-haiku-5-5"; // same model as the shop's chat
const WHATSAPP = "https://wa.me/201277660666";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    try {
      if (url.pathname === "/api/lead.php") return await lead(request, env, ctx);
      if (url.pathname === "/api/chat.php") return await chat(request, env, ctx);
      if (url.pathname === "/leads.php") return await leadsPage(request, env, url);
      if (url.pathname.startsWith("/api/")) return new Response("Not found", { status: 404 });
    } catch (e) {
      console.error("profile worker:", e && e.stack ? e.stack : e);
      return json({ ok: false, error: "server" }, 500);
    }
    return env.ASSETS.fetch(request);
  },
};

// ---------------------------------------------------------------------------------------------------------
// Helpers

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function clean(s, len) {
  return String(s ?? "").replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "").trim().slice(0, len);
}

const validEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function newId() {
  return [...crypto.getRandomValues(new Uint8Array(6))].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// At most `max` calls per `seconds` from one visitor (IP hashed, never stored in plain text).
async function rateLimited(env, request, bucket, max, seconds) {
  const ip = request.headers.get("CF-Connecting-IP") || "";
  const key = (await sha256(ip + bucket)).slice(0, 16);
  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare("DELETE FROM rate WHERE t <= ?").bind(now - 86400).run();
  const row = await env.DB.prepare("SELECT COUNT(*) AS n FROM rate WHERE bucket = ? AND k = ? AND t > ?")
    .bind(bucket, key, now - seconds).first();
  if ((row?.n ?? 0) >= max) return true;
  await env.DB.prepare("INSERT INTO rate (bucket, k, t) VALUES (?, ?, ?)").bind(bucket, key, now).run();
  return false;
}

// Save a lead. A chat conversation updates its own lead instead of adding a new one per message.
async function saveLead(env, lead) {
  if (lead.chat_id) {
    const old = await env.DB.prepare("SELECT id FROM leads WHERE chat_id = ?").bind(lead.chat_id).first();
    if (old) {
      await env.DB.prepare(
        "UPDATE leads SET name = ?, email = ?, phone = ?, service = ?, message = ?, transcript = ?, lang = ? WHERE id = ?"
      ).bind(lead.name, lead.email, lead.phone, lead.service, lead.message, lead.transcript ?? "", lead.lang, old.id).run();
      return;
    }
  }
  await env.DB.prepare(
    "INSERT INTO leads (id, chat_id, at, source, lang, name, email, phone, service, message, transcript) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).bind(newId(), lead.chat_id || null, new Date().toISOString(), lead.source, lead.lang,
    lead.name, lead.email, lead.phone, lead.service, lead.message, lead.transcript ?? "").run();
}

// ---------------------------------------------------------------------------------------------------------
// POST /api/lead.php — contact form (JSON from the page script, or a normal form post without JavaScript)

async function lead(request, env) {
  if (request.method !== "POST") return json({ ok: false, error: "POST only" }, 405);
  const isForm = !(request.headers.get("Content-Type") || "").includes("application/json");
  let input = {};
  if (isForm) {
    const fd = await request.formData();
    for (const [k, v] of fd.entries()) input[k] = typeof v === "string" ? v : "";
  } else {
    input = await request.json().catch(() => ({}));
    if (!input || typeof input !== "object") input = {};
  }
  let back = String(input.back ?? "/contact/");
  if (!/^\/(ar\/)?contact\/$/.test(back)) back = "/contact/";
  const done = (ok, err = "") => {
    if (isForm) {
      return Response.redirect(new URL(back + (ok ? "?sent=1#sent" : "?error=" + encodeURIComponent(err) + "#contact-form"), request.url).toString(), 303);
    }
    return json(ok ? { ok: true } : { ok: false, error: err }, ok ? 200 : err === "busy" ? 429 : 422);
  };
  if (input.website) return done(true); // honeypot: bots fill hidden fields

  const name = clean(input.name, 80), email = clean(input.email, 120), phone = clean(input.phone, 40);
  const service = clean(input.service, 60), message = clean(input.message, 3000);
  const lang = input.lang === "ar" ? "ar" : "en";
  if (email !== "" && !validEmail(email)) return done(false, "email");
  if (email === "" && phone.replace(/\D/g, "").length < 7) return done(false, "contact");
  if (await rateLimited(env, request, "lead", 6, 3600)) return done(false, "busy");

  await saveLead(env, { source: "contact form", lang, name, email, phone, service, message });
  return done(true);
}

// ---------------------------------------------------------------------------------------------------------
// POST /api/chat.php — site chat. Claude replies briefly and pulls out any contact details shared.

function chatSystem(lang) {
  return "You are the friendly sales assistant on the website of Where To Spot, a creative studio serving Egypt, "
    + "the GCC (Gulf) region and worldwide. Services: Digital Printing, Acrylic Solutions, Branding & Identity, "
    + "NFC Smart Cards, Events, Video Production, Social Media, Web Development, AI Solutions, AI Automation, "
    + "SEO and UGC. Contact: WhatsApp +20 127 766 0666, info@wheretospot.com.\n\n"
    + "Your goals: (1) answer questions about the services warmly and briefly, (2) understand the visitor's "
    + "project, (3) ask naturally for their name and their WhatsApp number or email so the team can send a quote. "
    + "Once you have a way to reach them, confirm the team will reply within one business day.\n\n"
    + "Rules: keep each reply to 2-4 short sentences. Never invent prices, delivery times or past clients; for "
    + "prices say the team will send a quote. If you can't help, point to WhatsApp. "
    + (lang === "ar" ? "Reply in Arabic." : "Reply in the visitor's language (English if unclear).")
    + "\n\nAlso fill in the contact fields with whatever the visitor has shared so far in the whole "
    + "conversation (empty string if not shared). Never make them up.";
}

const CHAT_SCHEMA = {
  type: "object",
  properties: {
    reply: { type: "string", description: "The message to show the visitor" },
    name: { type: "string", description: "Visitor's name if shared, else empty" },
    email: { type: "string", description: "Visitor's email if shared, else empty" },
    phone: { type: "string", description: "Visitor's phone or WhatsApp if shared, else empty" },
    service: { type: "string", description: "The service they are interested in, else empty" },
    project: { type: "string", description: "One-line summary of their project, else empty" },
  },
  required: ["reply", "name", "email", "phone", "service", "project"],
  additionalProperties: false,
};

async function askClaude(env, turns, lang, found) {
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 1, timeout: 25_000 });
  const msg = await client.messages.create({
    model: CHAT_MODEL,
    max_tokens: 2000,
    system: [{ type: "text", text: chatSystem(lang), cache_control: { type: "ephemeral" } }],
    messages: turns,
    output_config: { effort: "low", format: { type: "json_schema", schema: CHAT_SCHEMA } },
  });
  // Use the answer only when it finished normally (a refusal or a cut-off answer falls back to the script).
  if (msg.stop_reason !== "end_turn") return "";
  for (const block of msg.content) {
    if (block.type !== "text") continue;
    let d;
    try { d = JSON.parse(block.text); } catch { return ""; }
    if (!d || !String(d.reply ?? "").trim()) return "";
    for (const [k, len] of Object.entries({ name: 80, email: 120, phone: 40, service: 60, project: 500 })) {
      const v = clean(d[k], len);
      if (v) found[k] = v;
    }
    if (found.email && !validEmail(found.email)) found.email = "";
    return clean(d.reply, 2000);
  }
  return "";
}

function scriptedReply(lang, found) {
  const have = found.email || found.phone;
  if (lang === "ar") {
    return have
      ? `شكراً! وصلتنا بياناتك وسيتواصل معك فريقنا خلال يوم عمل. لرد أسرع راسلنا على واتساب: ${WHATSAPP}`
      : `شكراً لرسالتك! لنرسل لك عرض سعر، اكتب اسمك ورقم واتساب أو بريدك الإلكتروني، أو راسلنا مباشرة على واتساب: ${WHATSAPP}`;
  }
  return have
    ? `Thanks! We've got your details and the team will reply within one business day. For a faster answer, message us on WhatsApp: ${WHATSAPP}`
    : `Thanks for your message! To send you a quote, share your name and your WhatsApp number or email, or message us directly on WhatsApp: ${WHATSAPP}`;
}

async function chat(request, env) {
  if (request.method !== "POST") return json({ ok: false, error: "POST only" }, 405);
  const input = (await request.json().catch(() => null)) || {};
  const lang = input.lang === "ar" ? "ar" : "en";
  const chatId = /^[a-z0-9]{8,32}$/.test(String(input.chat_id ?? "")) ? input.chat_id : "";

  // Clean the conversation: user/assistant only, text only, length-limited, starting with the visitor.
  const turns = [];
  for (const m of (Array.isArray(input.messages) ? input.messages : []).slice(-20)) {
    const role = m?.role === "assistant" ? "assistant" : m?.role === "user" ? "user" : "";
    const text = clean(m?.content, 2000);
    if (!role || !text) continue;
    if (!turns.length && role === "assistant") continue; // the greeting is shown in the page, not sent to Claude
    if (turns.length && turns[turns.length - 1].role === role) { turns[turns.length - 1].content += "\n" + text; continue; }
    turns.push({ role, content: text });
  }
  if (!turns.length || turns[turns.length - 1].role !== "user") return json({ ok: false, error: "empty" }, 422);
  if (await rateLimited(env, request, "chat", 30, 3600)) {
    return json({ ok: true, reply: lang === "ar"
      ? `وصلنا الكثير من الرسائل منك. راسلنا على واتساب: ${WHATSAPP}`
      : `You have sent a lot of messages. Please continue on WhatsApp: ${WHATSAPP}` });
  }

  const userText = turns.filter((t) => t.role === "user").map((t) => t.content).join("\n");
  const transcript = turns.map((t) => `${t.role}: ${t.content}`).join("\n");
  const found = { name: "", email: "", phone: "", service: "", project: "" };
  const em = userText.match(/[\w.+-]+@[\w-]+\.[\w.-]+/u); if (em) found.email = em[0];
  const ph = userText.match(/\+?\d[\d\s-]{7,}\d/); if (ph) found.phone = ph[0].trim();

  let reply = "";
  if (env.ANTHROPIC_API_KEY) {
    try {
      reply = await askClaude(env, turns, lang, found);
    } catch (e) {
      if (e instanceof Anthropic.APIError) console.error(`profile chat: API ${e.status}: ${e.message}`);
      else console.error("profile chat:", e?.message ?? e);
      reply = "";
    }
  }
  if (!reply) reply = scriptedReply(lang, found);

  if (found.email || found.phone) {
    await saveLead(env, {
      source: "chat", lang, chat_id: chatId || newId(),
      name: found.name, email: found.email, phone: found.phone,
      service: found.service, message: found.project, transcript,
    });
  }
  return json({ ok: true, reply });
}

// ---------------------------------------------------------------------------------------------------------
// /leads.php — password-protected inbox of every lead, newest first, with CSV download.

const COOKIE = "wts_profile_admin";

async function hmac(secret, text) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(text));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

async function sessionOk(request, env) {
  const m = (request.headers.get("Cookie") || "").match(new RegExp(`${COOKIE}=(\\d+)\\.([a-f0-9]{64})`));
  if (!m || !env.ADMIN_PASSWORD) return false;
  if (Number(m[1]) < Date.now() / 1000) return false;
  return safeEqual(m[2], await hmac(env.ADMIN_PASSWORD, "session:" + m[1]));
}

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function page(body, extraHeaders = {}) {
  return new Response(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
<title>Leads · Where To Spot</title>
<style>
body{margin:0;background:#070B16;color:#EAF0FF;font:15px/1.5 Manrope,system-ui,sans-serif}
.w{max-width:960px;margin:0 auto;padding:28px 18px}
h1{font-size:26px;margin:0 0 6px}a{color:#8FB6FF}
.top{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:18px}
.card{background:#111B31;border:1px solid rgba(150,180,255,.12);border-radius:16px;padding:16px 18px;margin-bottom:12px}
.meta{color:rgba(226,234,255,.58);font-size:13px}.tag{display:inline-block;font-size:12px;font-weight:700;padding:2px 9px;border-radius:99px;background:#1c2b4d;margin-right:6px}
.c a{margin-right:14px;font-weight:600}pre{white-space:pre-wrap;font:13px/1.5 inherit;color:rgba(226,234,255,.8);margin:8px 0 0}
details summary{cursor:pointer;color:#8FB6FF;font-size:13px;margin-top:6px}
input{font:inherit;padding:11px 13px;border-radius:12px;border:1px solid rgba(150,180,255,.25);background:#0D1426;color:#EAF0FF}
button,.btn{font:inherit;font-weight:700;padding:10px 18px;border-radius:999px;border:0;background:linear-gradient(135deg,#2E6BF2,#6D3BF5);color:#fff;cursor:pointer;text-decoration:none}
.err{color:#fca5a5}
</style></head><body><div class="w">${body}</div></body></html>`, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow", ...extraHeaders },
  });
}

function loginForm(error = "") {
  return page(`<h1>Leads inbox</h1>
  <form method="post" style="display:flex;gap:10px;flex-wrap:wrap;margin-top:16px">
    <input type="password" name="password" placeholder="Password" required autofocus autocomplete="current-password">
    <button>Open</button>
  </form>${error ? `<p class="err">${esc(error)}</p>` : ""}`);
}

async function leadsPage(request, env, url) {
  if (url.searchParams.has("logout")) {
    return new Response(null, { status: 302, headers: { Location: "/leads.php", "Set-Cookie": `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict` } });
  }
  if (request.method === "POST") {
    if (!env.ADMIN_PASSWORD) return loginForm("The admin password is not set yet.");
    const fd = await request.formData();
    if (await rateLimited(env, request, "login", 8, 900)) return loginForm("Too many tries. Wait 15 minutes.");
    const pw = String(fd.get("password") ?? "");
    if (!safeEqual(await sha256(pw), await sha256(env.ADMIN_PASSWORD))) return loginForm("Wrong password.");
    const exp = Math.floor(Date.now() / 1000) + 12 * 3600;
    const cookie = `${COOKIE}=${exp}.${await hmac(env.ADMIN_PASSWORD, "session:" + exp)}; Path=/; Max-Age=${12 * 3600}; HttpOnly; Secure; SameSite=Strict`;
    return new Response(null, { status: 303, headers: { Location: "/leads.php", "Set-Cookie": cookie } });
  }
  if (!(await sessionOk(request, env))) return loginForm();

  const { results: leads } = await env.DB.prepare("SELECT * FROM leads ORDER BY at DESC").all();

  if (url.searchParams.has("csv")) {
    const cell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows = [["date", "source", "name", "email", "phone", "service", "language", "message", "conversation"]]
      .concat(leads.map((l) => [l.at, l.source, l.name, l.email, l.phone, l.service, l.lang, l.message, l.transcript]));
    return new Response("﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n"), {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="wheretospot-leads.csv"', "Cache-Control": "no-store" },
    });
  }

  const cards = leads.map((l) => {
    const wa = String(l.phone ?? "").replace(/\D/g, "");
    const when = new Date(l.at).toUTCString().replace(/:\d\d GMT$/, " UTC");
    return `<div class="card">
      <div><span class="tag">${esc(l.source)}</span><b>${esc(l.name || "No name")}</b> <span class="meta">· ${esc(when)}${l.service ? " · " + esc(l.service) : ""}${l.lang === "ar" ? " · Arabic" : ""}</span></div>
      <div class="c" style="margin-top:6px">${l.email ? `<a href="mailto:${esc(l.email)}">${esc(l.email)}</a>` : ""}${wa ? `<a href="https://wa.me/${esc(wa)}" target="_blank" rel="noopener">WhatsApp ${esc(l.phone)}</a>` : ""}</div>
      ${l.message ? `<pre>${esc(l.message)}</pre>` : ""}
      ${l.transcript ? `<details><summary>Conversation</summary><pre>${esc(l.transcript)}</pre></details>` : ""}
    </div>`;
  }).join("");
  return page(`<div class="top">
    <div><h1>Leads inbox</h1><div class="meta">${leads.length} leads from the chat and the contact form</div></div>
    <div><a class="btn" href="/leads.php?csv=1">Download CSV</a> &nbsp;<a href="/leads.php?logout=1">Log out</a></div>
  </div>${leads.length ? cards : '<p class="meta">No leads yet.</p>'}`);
}
