-- 1. Enable the modules
modules_enabled = {
    "roster";
    "saslauth";
    "disco";
    "carbons";
    "offline";
    "admin_net";
    "http";
    "bosh";
}

-- Enable debug logging for BOSH
log_levels = {
    ["mod_bosh"] = "debug";
}

-- CORS for BOSH
cross_domain_bosh = true

-- Reduce long-poll hold time so presence/messages aren't delayed 30 seconds
bosh_max_wait = 5

-- 2. HTTP Server Configuration
https_ports = { }
http_ports = { 5280 } 
http_interfaces = { "*" }
http_default_host = "localhost"

authentication = "internal_plain" 
admins = { "admin@localhost" }

VirtualHost "localhost"
    http_host = "localhost"
    authentication = "internal_plain"
    c2s_require_encryption = false
    allow_unencrypted_plain_auth = true

Component "upload.localhost" "http_file_share"
    -- Optional: Change the max file size (default is 10 MiB)
    http_file_share_size_limit = 50 * 1024 * 1024 -- 50 MiB

    -- Optional: Set how long files are kept (default 1 week)
    -- In Prosody 0.12.x this is a number in seconds
    http_file_share_expires_after = 60 * 60 * 24 * 7 

    http_file_share_allow_gets = true

    -- Ensure the base URL is correct for your local setup
    http_external_url = "http://localhost:5280/"
