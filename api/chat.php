<?php
// Site chat assistant. The browser sends the conversation; we ask Claude for a short reply plus any contact
// details the visitor shared, save the lead on the server (one lead per conversation, updated as it goes)
// and email new contact details to the team. With no API key set, a scripted reply still collects the lead.
declare(strict_types=1);
require __DIR__ . '/_common.php';

only_post();
$in = read_json_body();
$lang = ($in['lang'] ?? '') === 'ar' ? 'ar' : 'en';
$chatId = preg_match('/^[a-z0-9]{8,32}$/', (string)($in['chat_id'] ?? '')) ? $in['chat_id'] : '';

// Clean the conversation: user/assistant only, text only, length-limited, starting with the visitor.
$turns = [];
foreach (array_slice((array)($in['messages'] ?? []), -20) as $m) {
    $role = ($m['role'] ?? '') === 'assistant' ? 'assistant' : (($m['role'] ?? '') === 'user' ? 'user' : '');
    $text = clean((string)($m['content'] ?? ''), 2000);
    if ($role === '' || $text === '') continue;
    if (!$turns && $role === 'assistant') continue; // the greeting is shown in the page, not sent to Claude
    if ($turns && end($turns)['role'] === $role) { $turns[count($turns) - 1]['content'] .= "\n" . $text; continue; }
    $turns[] = ['role' => $role, 'content' => $text];
}
if (!$turns || end($turns)['role'] !== 'user') json_out(['ok' => false, 'error' => 'empty'], 422);
if (rate_limited('chat', 30, 3600)) {
    json_out(['ok' => true, 'reply' => $lang === 'ar'
        ? 'وصلنا الكثير من الرسائل منك. راسلنا على واتساب: https://wa.me/201277660666'
        : 'You have sent a lot of messages. Please continue on WhatsApp: https://wa.me/201277660666']);
}

$userText = implode("\n", array_map(fn($t) => $t['content'], array_filter($turns, fn($t) => $t['role'] === 'user')));
$transcript = implode("\n", array_map(fn($t) => $t['role'] . ': ' . $t['content'], $turns));
$found = ['name' => '', 'email' => '', 'phone' => '', 'service' => '', 'project' => ''];
if (preg_match('/[\w.+-]+@[\w-]+\.[\w.-]+/u', $userText, $mm)) $found['email'] = $mm[0];
if (preg_match('/\+?\d[\d\s-]{7,}\d/', $userText, $mm)) $found['phone'] = trim($mm[0]);

$reply = '';
if (cfg('anthropic_api_key') !== '' && PHP_VERSION_ID >= 80100) {
    try {
        $reply = chat_with_claude($turns, $lang, $found);
    } catch (Throwable $e) {
        error_log('profile chat: ' . $e->getMessage());
        $reply = '';
    }
}
if ($reply === '') $reply = scripted_reply($lang, $found);

if ($found['email'] !== '' || $found['phone'] !== '') {
    save_lead([
        'source' => 'chat', 'lang' => $lang, 'chat_id' => $chatId ?: bin2hex(random_bytes(6)),
        'name' => $found['name'], 'email' => $found['email'], 'phone' => $found['phone'],
        'service' => $found['service'], 'message' => $found['project'], 'transcript' => $transcript,
    ]);
}
json_out(['ok' => true, 'reply' => $reply]);

// ---------------------------------------------------------------------------------------------------------

function chat_system(string $lang): string {
    return "You are the friendly sales assistant on the website of Where To Spot, a creative studio serving Egypt, "
        . "the GCC (Gulf) region and worldwide. Services: Digital Printing, Acrylic Solutions, Branding & Identity, "
        . "NFC Smart Cards, Events, Video Production, Social Media, Web Development, AI Solutions, AI Automation, "
        . "SEO and UGC. Contact: WhatsApp +20 127 766 0666, info@wheretospot.com.\n\n"
        . "Your goals: (1) answer questions about the services warmly and briefly, (2) understand the visitor's "
        . "project, (3) ask naturally for their name and their WhatsApp number or email so the team can send a quote. "
        . "Once you have a way to reach them, confirm the team will reply within one business day.\n\n"
        . "Rules: keep each reply to 2-4 short sentences. Never invent prices, delivery times or past clients; for "
        . "prices say the team will send a quote. If you can't help, point to WhatsApp. "
        . ($lang === 'ar' ? 'Reply in Arabic.' : "Reply in the visitor's language (English if unclear).")
        . "\n\nAlso fill in the contact fields with whatever the visitor has shared so far in the whole "
        . "conversation (empty string if not shared). Never make them up.";
}

// Returns the reply text and fills $found with the details Claude extracted.
function chat_with_claude(array $turns, string $lang, array &$found): string {
    require_once __DIR__ . '/lib/vendor/autoload.php';
    $client = new \Anthropic\Client(apiKey: (string)cfg('anthropic_api_key'));
    $msg = $client->messages->create(
        model: (string)cfg('chat_model'),
        maxTokens: 2000,
        system: [['type' => 'text', 'text' => chat_system($lang), 'cacheControl' => ['type' => 'ephemeral']]],
        messages: $turns,
        outputConfig: [
            'effort' => 'low',
            'format' => ['type' => 'json_schema', 'schema' => [
                'type' => 'object',
                'properties' => [
                    'reply'   => ['type' => 'string', 'description' => 'The message to show the visitor'],
                    'name'    => ['type' => 'string', 'description' => "Visitor's name if shared, else empty"],
                    'email'   => ['type' => 'string', 'description' => "Visitor's email if shared, else empty"],
                    'phone'   => ['type' => 'string', 'description' => "Visitor's phone or WhatsApp if shared, else empty"],
                    'service' => ['type' => 'string', 'description' => 'The service they are interested in, else empty'],
                    'project' => ['type' => 'string', 'description' => 'One-line summary of their project, else empty'],
                ],
                'required' => ['reply', 'name', 'email', 'phone', 'service', 'project'],
                'additionalProperties' => false,
            ]],
        ],
    );
    // Use the answer only when it finished normally (a refusal or a cut-off answer falls back to the script).
    if ($msg->stopReason !== 'end_turn') return '';
    foreach ($msg->content as $block) {
        if ($block->type !== 'text') continue;
        $d = json_decode($block->text, true);
        if (!is_array($d) || trim((string)($d['reply'] ?? '')) === '') return '';
        foreach (['name' => 80, 'email' => 120, 'phone' => 40, 'service' => 60, 'project' => 500] as $k => $len) {
            $v = clean((string)($d[$k] ?? ''), $len);
            if ($v !== '') $found[$k] = $v;
        }
        if ($found['email'] !== '' && !filter_var($found['email'], FILTER_VALIDATE_EMAIL)) $found['email'] = '';
        return clean((string)$d['reply'], 2000);
    }
    return '';
}

function scripted_reply(string $lang, array $found): string {
    $haveContact = $found['email'] !== '' || $found['phone'] !== '';
    if ($lang === 'ar') {
        return $haveContact
            ? 'شكراً! وصلتنا بياناتك وسيتواصل معك فريقنا خلال يوم عمل. لرد أسرع راسلنا على واتساب: https://wa.me/201277660666'
            : 'شكراً لرسالتك! لنرسل لك عرض سعر، اكتب اسمك ورقم واتساب أو بريدك الإلكتروني، أو راسلنا مباشرة على واتساب: https://wa.me/201277660666';
    }
    return $haveContact
        ? "Thanks! We've got your details and the team will reply within one business day. For a faster answer, message us on WhatsApp: https://wa.me/201277660666"
        : "Thanks for your message! To send you a quote, share your name and your WhatsApp number or email, or message us directly on WhatsApp: https://wa.me/201277660666";
}
