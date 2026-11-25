<?php
// Contact form: saves the lead on the server and emails it to the team. Replaces the old contact.php call.
declare(strict_types=1);
require __DIR__ . '/_common.php';

only_post();
// JSON from the page script, or a normal form post when JavaScript is off (then we redirect back).
$isForm = stripos((string)($_SERVER['CONTENT_TYPE'] ?? ''), 'application/json') === false;
$in = $isForm ? $_POST : read_json_body();
$back = (string)($in['back'] ?? '/contact/');
if (!preg_match('#^/(ar/)?contact/$#', $back)) $back = '/contact/';
function done(bool $ok, string $err = ''): void {
    global $isForm, $back;
    if ($isForm) { header('Location: ' . $back . ($ok ? '?sent=1#sent' : '?error=' . rawurlencode($err) . '#contact-form'), true, 303); exit; }
    json_out($ok ? ['ok' => true] : ['ok' => false, 'error' => $err], $ok ? 200 : ($err === 'busy' ? 429 : 422));
}
if (!empty($in['website'])) done(true); // honeypot: bots fill hidden fields

$name = clean((string)($in['name'] ?? ''), 80);
$email = clean((string)($in['email'] ?? ''), 120);
$phone = clean((string)($in['phone'] ?? ''), 40);
$service = clean((string)($in['service'] ?? ''), 60);
$message = clean((string)($in['message'] ?? ''), 3000);
$lang = ($in['lang'] ?? '') === 'ar' ? 'ar' : 'en';

if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) done(false, 'email');
if ($email === '' && strlen(preg_replace('/\D/', '', $phone)) < 7) done(false, 'contact');
if (rate_limited('lead', 6, 3600)) done(false, 'busy');

save_lead([
    'source' => 'contact form', 'lang' => $lang,
    'name' => $name, 'email' => $email, 'phone' => $phone, 'service' => $service, 'message' => $message,
]);
done(true);
