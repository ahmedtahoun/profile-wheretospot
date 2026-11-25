// Contact page: pre-select the service from ?service=, and send the form without leaving the page.
// Without JavaScript the form posts normally and the server redirects back with ?sent=1.
(function () {
  'use strict';
  var T = {};
  try { T = JSON.parse(document.getElementById('i18n').textContent); } catch (e) {}
  var form = document.getElementById('contact-form'), done = document.getElementById('sent');
  if (!form) return;
  var params = new URLSearchParams(location.search);
  var sel = document.getElementById('f-service');
  var want = params.get('service');
  if (want && sel && sel.querySelector('option[value="' + CSS.escape(want) + '"]')) sel.value = want;
  if (params.get('sent') === '1') { form.hidden = true; done.hidden = false; }
  var err = form.querySelector('.form-error'), btn = form.querySelector('button[type=submit]');
  var codes = { contact: T.f_need_contact, email: T.f_bad_email };
  if (params.get('error')) { err.textContent = codes[params.get('error')] || T.f_failed; err.hidden = false; }
  function fail(msg) { err.textContent = msg; err.hidden = false; btn.disabled = false; btn.textContent = T.f_send; }
  form.addEventListener('submit', function (e) {
    if (!window.fetch) return; // normal post
    e.preventDefault();
    var data = Object.fromEntries(new FormData(form).entries());
    var hasEmail = /\S+@\S+\.\S+/.test(data.email || ''), hasPhone = (data.phone || '').replace(/\D/g, '').length >= 7;
    if (!hasEmail && !hasPhone) return fail(T.f_need_contact);
    err.hidden = true; btn.disabled = true; btn.textContent = T.f_sending;
    fetch('/api/lead.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok || !d.ok) throw new Error(d.error || 'x'); }); })
      .then(function () { form.hidden = true; done.hidden = false; done.querySelector('h2').focus && done.querySelector('h2').setAttribute('tabindex', '-1'); done.querySelector('h2').focus(); })
      .catch(function (e) { fail(codes[e.message] || T.f_failed); });
  });
})();
