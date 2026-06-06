-- mod_auth_supabase - Authenticate against Supabase
-- Queries Supabase REST API to validate user credentials

local http = require "net.http";
local json = require "util.json";
local sasl_factory = require "util.sasl";
local async = require "util.async";

-- Configuration
local function get_supabase_url()
    return module:get_option_string("supabase_url", "http://backend:8000"):gsub("/+$", "");
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
    
    module:log("debug", "Attempting auth for user '%s' via backend: %s", username, url);

    -- Use util.async to make the async http call look synchronous
    local wait, done = async.waiter();
    local result = false;

    http.request(url, {
        method = "POST",
        headers = {
            ["Content-Type"] = "application/json",
            ["apikey"] = api_key
        },
        body = body,
    }, function(response_body, code)
        if code == 200 then
            local decode_ok, data = pcall(json.decode, response_body);
            if decode_ok and data and data.valid == true then
                module:log("info", "Backend auth successful for user '%s'", username);
                result = true;
            else
                module:log("warn", "Backend auth returned invalid data for '%s': %s", username, response_body);
            end
        else
            module:log("warn", "Backend auth failed for user '%s' (code: %s)", username, tostring(code));
        end
        done();
    end);

    wait();
    return result;
end

local function check_user_exists(username)
    local url = get_supabase_url() .. "/api/auth/users/" .. username;
    local api_key = get_supabase_api_key();
    
    module:log("debug", "Checking existence for user '%s' via backend", username);

    local wait, done = async.waiter();
    local exists = false;

    http.request(url, {
        method = "GET",
        headers = { ["apikey"] = api_key },
    }, function(response_body, code)
        if code == 200 then
            local decode_ok, data = pcall(json.decode, response_body);
            if decode_ok and data and data.exists == true then
                exists = true;
            end
        end
        done();
    end);

    wait();
    return exists;
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
    local function plain_test_handler(sasl, username, password, realm)
        -- Prosody SASL handlers can be asynchronous since 0.10+
        -- by returning a coroutine or using async.waiter
        if provider.test_password(username, password) then
            return true, true;
        end
        return nil, "Invalid username or password";
    end
    return sasl_factory.new(realm, {
        plain_test = plain_test_handler;
    });
end

module:provides("auth", provider);
module:log("info", "Supabase auth provider loaded for host %s", module.host);

