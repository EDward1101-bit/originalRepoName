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

-- 3. MUC Component
Component "conference.localhost" "muc"
    name = "Localhost Chatrooms"
    restrict_room_creation = false