plugin_paths = { "/usr/lib/prosody/modules-custom" }

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
    "auth_supabase";
    "online_rest";
}

local function get_env(name, default)
    local value = os.getenv(name)
    if value == nil or value == "" then
        return default
    end
    return value
end

local hostname = get_env("SERVER_HOSTNAME", get_env("PROSODY_DOMAIN", "localhost"))

-- Backend Configuration (used by mod_auth_supabase)
supabase_url = get_env("BACKEND_URL", "http://backend:8000")
supabase_anon_key = get_env("SUPABASE_ANON_KEY", "")

-- Enable debug logging for BOSH

log_levels = {
    ["mod_bosh"] = "debug";
}

-- CORS for BOSH
cross_domain_bosh = true

-- Reduce long-poll hold time so presence/messages aren't delayed 30 seconds
bosh_max_wait = 5

local admin_user = get_env("PROSODY_ADMIN_USER", "admin")

-- 2. HTTP Server Configuration
https_ports = { }
http_ports = { 5280 } 
http_interfaces = { "*" }
http_default_host = hostname

-- Use Supabase authentication if configured
authentication = "supabase" 
admins = { admin_user .. "@" .. hostname }

VirtualHost(hostname)
    authentication = "supabase"
    c2s_require_encryption = false
    allow_unencrypted_plain_auth = true

-- 3. MUC Component
Component ("conference." .. hostname) "muc"
    name = "Chatrooms"
    restrict_room_creation = false
    modules_enabled = {
        "muc_mam",
    }
