-- mod_admin_net - HTTP API for user management
-- Allows HTTP requests to manage users via Prosody

local jid = require "util.jid";
local json = require "util.json";
local http = require "net.http";
local usermanager = require "core.usermanager";

local function handle_request(event)
   local request = event.request;
    local path = event.path or request.path or "";
    
    -- IMPORTANT: Strip ALL leading slashes so "/users" becomes "users"
    path = path:gsub("^/+", ""); 
    -- Strip trailing slashes so "users/" becomes "users"
    path = path:gsub("/+$", "");

    module:log("info", "Final normalized path for logic: '%s'", path);

    -- 1. Health Check
    if path == "health" then
        return { status = 200, headers = { ["Content-Type"] = "application/json" }, body = '{"status":"ok"}' };
    end

    -- 2. List Users
    if path == "users" and request.method == "GET" then
        local users = {};
        local host = module.host;
        for user in usermanager.users(host) do
            table.insert(users, { username = user, jid = user .. "@" .. host });
        end
        return { 
            status = 200, 
            headers = { ["Content-Type"] = "application/json" }, 
            body = json.encode({users = users}) 
        };
    end

    -- 3. Individual User Operations
    local user_jid = path:match("^users/([^/]+)$");
    if user_jid then
        local username = user_jid;
        local host = module.host;

        if request.method == "GET" then
            if usermanager.user_exists(username, host) then
                return { status = 200, body = json.encode({username = username, exists = true}) };
            end
            return { status = 404, body = '{"error":"User not found"}' };
        end

        if request.method == "POST" then
            local data = json.decode(request.body);
            if not data or not data.password then
                return { status = 400, body = '{"error":"Password required"}' };
            end
            local ok, err = usermanager.create_user(username, data.password, host);
            if ok then return { status = 201, body = '{"created":true}' }; end
            return { status = 409, body = json.encode({error = err or "Conflict"}) };
        end
    end

    return { status = 404, body = '{"error":"Not found", "path_tried":"'..path..'"}' };
end

module:provides("http", {
    default_path = "/";
    route = {
        ["GET /health"] = function(event) return handle_request(event) end;
        ["GET /users"] = function(event) return handle_request(event) end;
        ["GET /users/*"] = function(event) return handle_request(event) end;
        ["POST /users/*"] = function(event) return handle_request(event) end;
        ["DELETE /users/*"] = function(event) return handle_request(event) end;
        ["POST /auth"] = function(event) return handle_request(event) end;
        ["OPTIONS /*"] = function(event) return handle_request(event) end;
    };
});
module:log("info", "Admin HTTP API loaded");
