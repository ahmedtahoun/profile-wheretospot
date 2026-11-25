<?php
// Contact form: saves the lead on the server and emails it to the team. Replaces the old contact.php call.
declare(strict_types=1);
require __DIR__ . '/_common.php';

only_post();
$in = read_json_body();
if (!empty($in['website'])) json_out(['ok' => true]); // honeypot: bots fill hidden fields

$name = clean((string)($in['name'] ?? ''), 80);
$email = clean((string)($in['email'] ?? ''), 120);
$phone = clean((string)($in['phone'] ?? ''), 40);
$service = clean((string)($in['service'] ?? ''), 60);
$message = clean((string)($in['message'] ?? ''), 3000);
$lang = ($in['lang'] ?? '') === 'ar' ? 'ar' : 'en';

if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) json_out(['ok' => false, 'error' => 'email'], 422);
if ($email === '' && strlen(preg_replace('/\D/', '', $phone)) < 7) json_out(['ok' => false, 'error' => 'contact'], 422);
if (rate_limited('lead', 6, 3600)) json_out(['ok' => false, 'error' => 'busy'], 429);

save_lead([
    'source' => 'contact form', 'lang' => $lang,
    'name' => $name, 'email' => $email, 'phone' => $phone, 'service' => $service, 'message' => $message,
]);
json_out(['ok' => true]);
