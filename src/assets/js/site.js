// Enhancements only: every page works without this file.
(function () {
  'use strict';
  document.documentElement.classList.add('js');
  var T = {};
  try { T = JSON.parse(document.getElementById('i18n').textContent); } catch (e) {}
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  // ---- Work dropdown: tap to open on touch screens (hover/focus already work in CSS) ----
  $$('.dd-btn').forEach(function (b) {
    b.addEventListener('click', function () {
      var li = b.closest('.has-dd'); var open = li.classList.toggle('open');
      b.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  });
  document.addEventListener('click', function (e) {
    $$('.has-dd.open').forEach(function (li) { if (!li.contains(e.target)) { li.classList.remove('open'); $('.dd-btn', li).setAttribute('aria-expanded', 'false'); } });
    var m = $('.mnav[open]'); if (m && !m.contains(e.target)) m.removeAttribute('open');
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    $$('.has-dd.open').forEach(function (li) { li.classList.remove('open'); });
    var m = $('.mnav[open]'); if (m) m.removeAttribute('open');
  });

  // ---- Video: swap the thumbnail link for the player on click ----
  $$('.video-frame[data-yt]').forEach(function (f) {
    var a = $('.video-facade', f);
    if (!a) return;
    a.addEventListener('click', function (e) {
      e.preventDefault();
      var i = document.createElement('iframe');
      i.src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(f.dataset.yt) + '?autoplay=1&rel=0&modestbranding=1';
      i.title = f.dataset.title || 'Video';
      i.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
      i.allowFullscreen = true;
      f.replaceChild(i, a);
    });
  });

  // ---- Gallery lightbox ----
  $$('[data-gallery]').forEach(function (g) {
    var links = $$('.gallery-link', g);
    if (!links.length) return;
    var box, img, cap, idx = 0;
    function build() {
      box = document.createElement('div');
      box.className = 'lightbox'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.hidden = true;
      box.innerHTML = '<button class="lb-btn lb-prev" type="button"></button><figure><img alt=""><figcaption></figcaption></figure><button class="lb-btn lb-next" type="button"></button><button class="lb-btn lb-close" type="button">×</button>';
      document.body.appendChild(box);
      img = $('img', box); cap = $('figcaption', box);
      var rtl = document.documentElement.dir === 'rtl';
      var prev = $('.lb-prev', box), next = $('.lb-next', box), close = $('.lb-close', box);
      prev.textContent = rtl ? '›' : '‹'; next.textContent = rtl ? '‹' : '›';
      prev.setAttribute('aria-label', T.gallery_prev || 'Previous'); next.setAttribute('aria-label', T.gallery_next || 'Next'); close.setAttribute('aria-label', T.close || 'Close');
      prev.addEventListener('click', function () { show(idx - 1); });
      next.addEventListener('click', function () { show(idx + 1); });
      close.addEventListener('click', hide);
      box.addEventListener('click', function (e) { if (e.target === box) hide(); });
      document.addEventListener('keydown', function (e) {
        if (box.hidden) return;
        if (e.key === 'Escape') hide();
        if (e.key === 'ArrowRight') show(idx + (rtl ? -1 : 1));
        if (e.key === 'ArrowLeft') show(idx + (rtl ? 1 : -1));
      });
      if (links.length < 2) { prev.hidden = true; next.hidden = true; }
    }
    var last;
    function show(i) {
      idx = (i + links.length) % links.length;
      var l = links[idx], th = $('img', l);
      img.src = l.getAttribute('href'); img.alt = th ? th.alt : '';
      cap.textContent = (th ? th.alt + ' · ' : '') + (idx + 1) + ' / ' + links.length;
    }
    function hide() { box.hidden = true; document.body.style.overflow = ''; if (last) last.focus(); }
    links.forEach(function (l, i) {
      l.addEventListener('click', function (e) {
        e.preventDefault(); if (!box) build();
        last = l; show(i); box.hidden = false; document.body.style.overflow = 'hidden'; $('.lb-close', box).focus();
      });
    });
  });

  // ---- Chat widget (talks to /api/chat.php; leads are stored on the server only) ----
  var float = document.getElementById('float');
  if (float && window.fetch) {
    var chatId = Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
    var msgs = [];
    var btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'chat-btn'; btn.textContent = '✦';
    btn.setAttribute('aria-label', T.chat_open || 'Chat'); btn.setAttribute('aria-expanded', 'false');
    var panel = document.createElement('section');
    panel.className = 'chat-panel'; panel.hidden = true; panel.setAttribute('aria-label', T.chat_title || 'Chat');
    panel.innerHTML = '<div class="chat-head"><span></span><button type="button" class="chat-close">×</button></div><div class="chat-log" aria-live="polite"></div><form class="chat-form"><textarea rows="1" maxlength="1500"></textarea><button type="submit">↑</button></form>';
    float.insertBefore(btn, float.firstChild);
    float.insertBefore(panel, float.firstChild);
    $('.chat-head span', panel).textContent = T.chat_title || 'Where To Spot';
    $('.chat-close', panel).setAttribute('aria-label', T.chat_close || 'Close');
    var log = $('.chat-log', panel), form = $('.chat-form', panel), ta = $('textarea', panel), send = $('button[type=submit]', form);
    ta.placeholder = T.chat_ph || ''; ta.setAttribute('aria-label', T.chat_ph || 'Message'); send.setAttribute('aria-label', T.chat_send || 'Send');
    function add(role, text) {
      var d = document.createElement('div'); d.className = 'msg ' + (role === 'user' ? 'me' : 'bot'); d.textContent = text;
      log.appendChild(d); log.scrollTop = log.scrollHeight; return d;
    }
    function toggle(open) {
      panel.hidden = !open; btn.textContent = open ? '×' : '✦';
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      btn.setAttribute('aria-label', open ? (T.chat_close || 'Close') : (T.chat_open || 'Chat'));
      if (open && !log.childNodes.length) add('assistant', T.chat_greet || 'Hi!');
      if (open) ta.focus();
    }
    btn.addEventListener('click', function () { toggle(panel.hidden); });
    $('.chat-close', panel).addEventListener('click', function () { toggle(false); btn.focus(); });
    ta.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit')); } });
    var busy = false;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var text = ta.value.trim(); if (!text || busy) return;
      ta.value = ''; busy = true; add('user', text); msgs.push({ role: 'user', content: text });
      var typing = add('assistant', '…'); typing.classList.add('typing');
      fetch('/api/chat.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lang: T.lang, chat_id: chatId, messages: msgs }) })
        .then(function (r) { return r.json().then(function (d) { if (!r.ok || !d.ok || !d.reply) throw new Error('x'); return d.reply; }); })
        .then(function (reply) { typing.remove(); add('assistant', reply); msgs.push({ role: 'assistant', content: reply }); })
        .catch(function () { typing.remove(); add('assistant', T.chat_err || 'Sorry, something went wrong.'); })
        .then(function () { busy = false; });
    });
  }
})();
