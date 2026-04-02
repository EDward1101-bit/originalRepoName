-- mod_auth_supabase - Authenticate against Supabase
-- Queries Supabase REST API to validate user credentials

local http = require "net.http";
local json = require "util.json";
local usermanager = require "core.usermanager";

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
    
    local headers = {
        ["Content-Type"] = "application/json",
        ["apikey"] = api_key
    };
    
    local body = json.encode({
        username = username,
        password = password,
        host = module.host
    });
    
    local response = http.request(url, {
        method = "POST",
        headers = headers,
        body = body
    });
    
    if response and response.code == 200 then
        local data = json.decode(response.body);
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
    
    local url = supabase_url .. "/api/users/" .. username;
    
    local headers = {
        ["apikey"] = api_key
    };
    
    local response = http.request(url, {
        method = "GET",
        headers = headers
    });
    
    if response and response.code == 200 then
        return true;
    end
    
    return false;
end

local auth_provider = {};

function auth_provider.test_password(username, password)
    module:log("info", "Testing password for user: %s", username);
    return auth_user(username, password);
end

function auth_provider.get_password(username)
    -- We don't store passwords in Prosody, return nil
    -- Authentication is done via Supabase
    return nil;
end

function auth_provider.set_password(username, password)
    -- Passwords are managed in Supabase, not Prosody
    return false;
end

function auth_provider.user_exists(username)
    return user_exists(username);
end

function auth_provider.create_user(username, password)
    -- Users are created in Supabase, not Prosody
    return false;
end

function auth_provider.delete_user(username)
    -- Users are deleted in Supabase, not Prosody
    return false;
end

function auth_provider.get_sasl_handler()
    return module:require("sasl").new(module.host);
end

module:provides("auth", auth_provider);
module:log("info", "Supabase auth module loaded");