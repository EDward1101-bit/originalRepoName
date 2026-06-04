-- mod_auth_supabase - Authenticate against Supabase
-- Queries Supabase REST API to validate user credentials

-- Hack to allow ltn12 and socket.http to set globals during loading
local http, ltn12;
local json = require "util.json";
do
    local _G = _G;
    local mt = getmetatable(_G);
    local old_newindex;
    if mt then
        old_newindex = mt.__newindex;
        mt.__newindex = nil;
    end
    http = require "socket.http";
    ltn12 = require "ltn12";
    if mt then
        mt.__newindex = old_newindex;
    end
end

local function get_supabase_url()
    return module:get_option_string("supabase_url", "http://backend:8000");
end

local function get_supabase_api_key()
    return module:get_option_string("supabase_anon_key", "");
end

local function auth_user(username, password)
    local supabase_url = get_supabase_url();
    local api_key = get_supabase_api_key();

    -- Call backend API to validate credentials
    local url = supabase_url .. "/api/auth/verify";
    
    local body = json.encode({
        username = username,
        password = password,
        host = module.host
    });
    
    local response_body = {};
    local res, code, headers, status = http.request{
        url = url,
        method = "POST",
        headers = {
            ["Content-Type"] = "application/json",
            ["Content-Length"] = #body,
            ["apikey"] = api_key
        },
        source = ltn12.source.string(body),
        sink = ltn12.sink.table(response_body)
    }
    
    if code == 200 then
        local data = json.decode(table.concat(response_body));
        if data and data.valid == true then
            return true;
        end
    end
    
    return false;
end

local function user_exists(username)
    -- Check if user exists in Supabase via backend API
    local supabase_url = get_supabase_url();
    local api_key = get_supabase_api_key();
    
    local url = supabase_url .. "/api/auth/users/" .. username;
    
    module:log("info", "Checking if user exists in Supabase: %s (URL: %s)", username, url);
    local response_body = {};
    local res, code, headers, status = http.request{
        url = url,
        method = "GET",
        headers = {
            ["apikey"] = api_key
        },
        sink = ltn12.sink.table(response_body)
    }
    
    module:log("info", "Supabase user_exists response: %s (code: %s)", status, code);
    
    if code == 200 then
        local data = json.decode(table.concat(response_body));
        if data and data.exists == true then
            return true;
        end
    end
    
    return false;
end

local auth_provider = {};

function auth_provider.test_password(username, password)
    module:log("info", "Testing password for user: %s", username);
    return auth_user(username, password);
end

function auth_provider.get_password(username)
    return nil;
end

function auth_provider.set_password(username, password)
    return false;
end

function auth_provider.user_exists(username)
    return user_exists(username);
end

function auth_provider.create_user(username, password)
    return false;
end

function auth_provider.delete_user(username)
    return false;
end

function auth_provider.get_sasl_handler()
    return module:require("sasl").new(module.host);
end

module:provides("auth", auth_provider);
module:log("info", "Supabase auth module loaded");