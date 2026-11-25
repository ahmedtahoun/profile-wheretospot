<?php
// Copy to config.local.php ON THE SERVER ONLY (never commit it) and fill in.
// Make a password hash on any computer with PHP:  php -r "echo password_hash('your-password', PASSWORD_DEFAULT);"
return [
    'anthropic_api_key'   => '',                      // the same kind of key the shop uses; empty = scripted chat replies
    'chat_model'          => 'claude-haiku-5-5',
    'lead_email'          => 'info@wheretospot.com',  // every new lead is emailed here
    'admin_password_hash' => '',                      // for leads.php
    // 'data_dir'         => '/home/viorowzb/profile-data',  // default: a folder next to the website folder
];
