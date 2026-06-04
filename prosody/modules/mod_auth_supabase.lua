-- mod_auth_supabase - Authenticate against Supabase
-- Queries Supabase REST API to validate user credentials

-- 130 IQ Fix: Pre-create tables to bypass Prosody's global protection.
-- The libraries will find these existing tables and won't try to create new globals.
rawset(_G, "ltn12", {});
rawset(_G, "socket", {});
rawset(_G, "mime", {});

local http = require "socket.http";
local ltn12 = require "ltn12";
local json = require "util.json";
local sasl_factory = require "util.sasl";

-- Configuration
local function get_supabase_url()
    return module:get_option_string("supabase_url", "http://backend:8000");
end

local function get_supabase_api_key()
    return module:get_option_string("supabase_anon_key", "");
end

local function auth_user(username, password)
    local url = get_supabase_url() .. "/api/auth/verify";
    local api_key = get_supabase_api_key();
    
    local body_data = {
        username = username,
        password = password,
        host = module.host
    };
    
    local ok, body = pcall(json.encode, body_data);
    if not ok then return false; end
    
    module:log("info", "Attempting auth for user '%s' via backend", username);

    local response_body = {};
    -- 130 IQ: Supabase Auth can be slow, especially on cold starts. 15s is safer.
    http.TIMEOUT = 15;
    local res, code, headers, status = http.request{
        url = url,
        method = "POST",
        headers = {
            ["Content-Type"] = "application/json",
            ["Content-Length"] = tostring(#body),
            ["apikey"] = api_key
        },
        source = ltn12.source.string(body),
        sink = ltn12.sink.table(response_body)
    }
    
    if code == 200 then
        local resp_str = table.concat(response_body);
        local decode_ok, data = pcall(json.decode, resp_str);
        if decode_ok and data and data.valid == true then
            module:log("info", "Backend auth successful for user '%s'", username);
            return true;
        end
        module:log("warn", "Backend auth returned valid=false or invalid JSON for '%s': %s", username, resp_str);
    else
        module:log("warn", "Backend auth failed for user '%s' (code: %s, status: %s)", username, tostring(code), tostring(status));
    end
    return false;
end

local function check_user_exists(username)
    local url = get_supabase_url() .. "/api/auth/users/" .. username;
    local api_key = get_supabase_api_key();
    
    local response_body = {};
    http.TIMEOUT = 3;
    local res, code, headers, status = http.request{
        url = url,
        method = "GET",
        headers = { ["apikey"] = api_key },
        sink = ltn12.sink.table(response_body)
    }
    
    if code == 200 then
        local resp_str = table.concat(response_body);
        local decode_ok, data = pcall(json.decode, resp_str);
        if decode_ok and data and data.exists == true then
            return true;
        end
    end
    return false;
end

local provider = {};

function provider.test_password(username, password)
    return auth_user(username, password);
end

function provider.user_exists(username)
    return check_user_exists(username);
end

function provider.get_password(username) return nil, "Passwords not stored locally"; end
function provider.set_password(username, password) return nil, "Passwords not stored locally"; end
function provider.create_user(username, password) return nil, "Account creation via XMPP not supported"; end
function provider.delete_user(username) return nil, "Account deletion via XMPP not supported"; end

function provider.get_sasl_handler()
    local realm = module.host;
    local function plain_handler(sasl, password)
        if provider.test_password(sasl.username, password) then
            return true, true;
        end
        return nil, "Invalid username or password";
    end
    return sasl_factory.new(realm, {
        plain = plain_handler;
        plain_test_password = plain_handler;
    });
end

module:provides("auth", provider);
module:log("info", "Supabase auth provider loaded for host %s", module.host);
