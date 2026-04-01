-- 1. Enable the modules
modules_enabled = {
    "roster";
    "saslauth";
    "disco";
    "carbons";
    "admin_net";
    "http";        -- (required for admin_net to work over HTTP)
}

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