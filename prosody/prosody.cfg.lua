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

local hostname = os.getenv("SERVER_HOSTNAME") or os.getenv("PROSODY_DOMAIN") or "localhost"

-- Enable debug logging for BOSH

log_levels = {
    ["mod_bosh"] = "debug";
}

-- CORS for BOSH
cross_domain_bosh = true

-- Reduce long-poll hold time so presence/messages aren't delayed 30 seconds
bosh_max_wait = 5

local admin_user = os.getenv("PROSODY_ADMIN_USER") or "admin"

-- 2. HTTP Server Configuration
https_ports = { }
http_ports = { 5280 } 
http_interfaces = { "*" }
http_default_host = hostname

authentication = "internal_plain" 
admins = { admin_user .. "@" .. hostname }

VirtualHost(hostname)
    authentication = "internal_plain"
    c2s_require_encryption = false
    allow_unencrypted_plain_auth = true

-- 3. MUC Component
Component ("conference." .. hostname) "muc"
    name = "Chatrooms"
    restrict_room_creation = false
    modules_enabled = {
        "muc_mam",
    }
