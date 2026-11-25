<?php
// Shared by api/chat.php, api/lead.php and leads.php: settings, lead storage, email, rate limiting.
// Secrets live only in config.local.php on the server (never in git). See config.local.example.php.
declare(strict_types=1);

function cfg(string $key, $default = null) {
    static $c = null;
    if ($c === null) {
        $root = dirname(__DIR__);
        $c = [
            // Outside the website folder, so leads can never be opened from the web.
            'data_dir'            => dirname($root) . '/profile-data',
            'anthropic_api_key'   => '',
            'chat_model'          => 'claude-haiku-5-5',  // same model as the shop's chat (api/ai.php)
            'lead_email'          => 'info@wheretospot.com',
            'mail_from'           => 'no-reply@wheretospot.com',
            'admin_password_hash' => '',
        ];
        if (is_file($root . '/config.local.php')) {
            $over = require $root . '/config.local.php';
            if (is_array($over)) $c = array_merge($c, $over);
        }
        if (getenv('PROFILE_DATA_DIR')) $c['data_dir'] = getenv('PROFILE_DATA_DIR');
        if (getenv('ANTHROPIC_API_KEY') && $c['anthropic_api_key'] === '') $c['anthropic_api_key'] = getenv('ANTHROPIC_API_KEY');
    }
    return $c[$key] ?? $default;
}

function data_dir(): string {
    $d = cfg('data_dir');
    if (!is_dir($d)) @mkdir($d, 0700, true);
    return $d;
}

function json_out(array $data, int $code = 200): void {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function read_json_body(): array {
    $raw = (string)file_get_contents('php://input', false, null, 0, 64000);
    $d = json_decode($raw, true);
    return is_array($d) ? $d : [];
}

function only_post(): void {
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') json_out(['ok' => false, 'error' => 'POST only'], 405);
}

function is_local(): bool {
    $h = $_SERVER['HTTP_HOST'] ?? '';
    return PHP_SAPI === 'cli-server' || preg_match('/^(localhost|127\.0\.0\.1)(:\d+)?$/', $h) === 1;
}

// Allow at most $max calls per $seconds from one visitor (IP hashed, never stored in plain text).
function rate_limited(string $bucket, int $max, int $seconds): bool {
    $file = data_dir() . '/rate-' . preg_replace('/[^a-z]/', '', $bucket) . '.json';
    $key = substr(hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? '') . $bucket), 0, 16);
    $now = time();
    $fp = @fopen($file, 'c+');
    if (!$fp) return false;
    flock($fp, LOCK_EX);
    $all = json_decode((string)stream_get_contents($fp), true) ?: [];
    foreach ($all as $k => $times) {
        $all[$k] = array_values(array_filter($times, fn($t) => $t > $now - $seconds));
        if (!$all[$k]) unset($all[$k]);
    }
    $limited = count($all[$key] ?? []) >= $max;
    if (!$limited) $all[$key][] = $now;
    ftruncate($fp, 0); rewind($fp);
    fwrite($fp, json_encode($all));
    flock($fp, LOCK_UN); fclose($fp);
    return $limited;
}

function clean(string $s, int $len): string {
    return mb_substr(trim(preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/u', '', $s) ?? ''), 0, $len);
}

// Save a lead (one JSON line per lead) and email it to the team.
// A chat conversation updates its own lead instead of adding a new one each message.
function save_lead(array $lead): void {
    $lead += ['id' => bin2hex(random_bytes(6)), 'at' => gmdate('c')];
    $file = data_dir() . '/leads.jsonl';
    $fp = fopen($file, 'c+');
    flock($fp, LOCK_EX);
    $lines = array_filter(explode("\n", (string)stream_get_contents($fp)));
    $replaced = false;
    $isNew = true;
    if (!empty($lead['chat_id'])) {
        foreach ($lines as $i => $line) {
            $old = json_decode($line, true);
            if (($old['chat_id'] ?? '') === $lead['chat_id']) {
                $lead['id'] = $old['id']; $lead['at'] = $old['at'];
                $lines[$i] = json_encode($lead, JSON_UNESCAPED_UNICODE);
                $replaced = true; $isNew = false;
                // Email again only when new contact details appear.
                $isNew = ($old['email'] ?? '') !== ($lead['email'] ?? '') || ($old['phone'] ?? '') !== ($lead['phone'] ?? '');
                break;
            }
        }
    }
    if (!$replaced) $lines[] = json_encode($lead, JSON_UNESCAPED_UNICODE);
    ftruncate($fp, 0); rewind($fp);
    fwrite($fp, implode("\n", $lines) . "\n");
    flock($fp, LOCK_UN); fclose($fp);
    @chmod($file, 0600);
    if ($isNew) mail_lead($lead);
}

function mail_lead(array $l): void {
    if (is_local() || !cfg('lead_email')) return;
    $who = trim(($l['name'] ?? '') . ' ' . ($l['email'] ?? '') . ' ' . ($l['phone'] ?? ''));
    $subject = 'New lead (' . ($l['source'] ?? 'site') . '): ' . ($who !== '' ? $who : 'no contact yet');
    $body = "New lead from profile.wheretospot.com\n\n"
        . 'Source: ' . ($l['source'] ?? '') . "\n"
        . 'Name: ' . ($l['name'] ?? '') . "\nEmail: " . ($l['email'] ?? '') . "\nPhone: " . ($l['phone'] ?? '') . "\n"
        . 'Service: ' . ($l['service'] ?? '') . "\nLanguage: " . ($l['lang'] ?? '') . "\n\n"
        . ($l['message'] ?? '') . "\n\n"
        . (!empty($l['transcript']) ? "Conversation:\n" . $l['transcript'] . "\n\n" : '')
        . "All leads: https://profile.wheretospot.com/leads.php\n";
    $headers = 'From: ' . cfg('mail_from') . "\r\nContent-Type: text/plain; charset=utf-8";
    if (!empty($l['email']) && filter_var($l['email'], FILTER_VALIDATE_EMAIL)) $headers .= "\r\nReply-To: " . $l['email'];
    @mail((string)cfg('lead_email'), '=?UTF-8?B?' . base64_encode($subject) . '?=', $body, $headers);
}

function read_leads(): array {
    $file = data_dir() . '/leads.jsonl';
    if (!is_file($file)) return [];
    $out = [];
    foreach (file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        $l = json_decode($line, true);
        if (is_array($l)) $out[] = $l;
    }
    usort($out, fn($a, $b) => strcmp($b['at'] ?? '', $a['at'] ?? ''));
    return $out;
}
