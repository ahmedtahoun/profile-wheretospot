<?php
// Leads inbox: every chat and contact-form lead, newest first. Password-protected.
// Set admin_password_hash in config.local.php (locally the password is "profile-local").
declare(strict_types=1);
require __DIR__ . '/api/_common.php';

session_name('wts_profile_admin');
session_set_cookie_params(['httponly' => true, 'samesite' => 'Strict', 'secure' => !is_local()]);
session_start();
header('X-Robots-Tag: noindex, nofollow');
header('Cache-Control: no-store');

function pw_ok(string $pw): bool {
    $hash = (string)cfg('admin_password_hash');
    if ($hash !== '') return password_verify($pw, $hash);
    return is_local() && hash_equals('profile-local', $pw);
}

$error = '';
if (isset($_GET['logout'])) { $_SESSION = []; session_destroy(); header('Location: leads.php'); exit; }
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST' && isset($_POST['password'])) {
    if (rate_limited('login', 8, 900)) $error = 'Too many tries. Wait 15 minutes.';
    elseif (pw_ok((string)$_POST['password'])) { session_regenerate_id(true); $_SESSION['ok'] = 1; header('Location: leads.php'); exit; }
    else $error = 'Wrong password.';
}
$in = !empty($_SESSION['ok']);
$leads = $in ? read_leads() : [];

if ($in && isset($_GET['csv'])) {
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="wheretospot-leads.csv"');
    $out = fopen('php://output', 'w');
    fwrite($out, "\xEF\xBB\xBF"); // so Excel shows Arabic correctly
    fputcsv($out, ['date', 'source', 'name', 'email', 'phone', 'service', 'language', 'message', 'conversation']);
    foreach ($leads as $l) fputcsv($out, [$l['at'] ?? '', $l['source'] ?? '', $l['name'] ?? '', $l['email'] ?? '', $l['phone'] ?? '', $l['service'] ?? '', $l['lang'] ?? '', $l['message'] ?? '', $l['transcript'] ?? '']);
    exit;
}
$h = fn($s) => htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8');
?><!doctype html>
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
</style></head><body><div class="w">
<?php if (!$in): ?>
  <h1>Leads inbox</h1>
  <form method="post" style="display:flex;gap:10px;flex-wrap:wrap;margin-top:16px">
    <input type="password" name="password" placeholder="Password" required autofocus autocomplete="current-password">
    <button>Open</button>
  </form>
  <?php if ($error): ?><p class="err"><?= $h($error) ?></p><?php endif; ?>
  <?php if (!cfg('admin_password_hash') && !is_local()): ?><p class="meta">Set admin_password_hash in config.local.php to open this page.</p><?php endif; ?>
<?php else: ?>
  <div class="top">
    <div><h1>Leads inbox</h1><div class="meta"><?= count($leads) ?> leads from the chat and the contact form</div></div>
    <div><a class="btn" href="leads.php?csv=1">Download CSV</a> &nbsp;<a href="leads.php?logout=1">Log out</a></div>
  </div>
  <?php if (!$leads): ?><p class="meta">No leads yet.</p><?php endif; ?>
  <?php foreach ($leads as $l): $wa = preg_replace('/\D/', '', (string)($l['phone'] ?? '')); ?>
    <div class="card">
      <div><span class="tag"><?= $h($l['source'] ?? '') ?></span><b><?= $h(($l['name'] ?? '') ?: 'No name') ?></b> <span class="meta">· <?= $h(date('j M Y, H:i', strtotime($l['at'] ?? 'now'))) ?> UTC<?= !empty($l['service']) ? ' · ' . $h($l['service']) : '' ?><?= ($l['lang'] ?? '') === 'ar' ? ' · Arabic' : '' ?></span></div>
      <div class="c" style="margin-top:6px">
        <?php if (!empty($l['email'])): ?><a href="mailto:<?= $h($l['email']) ?>"><?= $h($l['email']) ?></a><?php endif; ?>
        <?php if ($wa !== ''): ?><a href="https://wa.me/<?= $h($wa) ?>" target="_blank" rel="noopener">WhatsApp <?= $h($l['phone']) ?></a><?php endif; ?>
      </div>
      <?php if (!empty($l['message'])): ?><pre><?= $h($l['message']) ?></pre><?php endif; ?>
      <?php if (!empty($l['transcript'])): ?><details><summary>Conversation</summary><pre><?= $h($l['transcript']) ?></pre></details><?php endif; ?>
    </div>
  <?php endforeach; ?>
<?php endif; ?>
</div></body></html>
