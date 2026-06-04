-- mod_admin_net - HTTP API for user management
-- Allows HTTP requests to manage users via Prosody

local jid = require "util.jid";
local json = require "util.json";
local usermanager = require "core.usermanager";

local function handle_request(event, path)
    local request = event.request;
    
    -- Normalize path: strip leading/trailing slashes
    path = path or "";
    path = path:gsub("^/+", ""):gsub("/+$", "");

    module:log("info", "Request %s %s (normalized path: '%s')", request.method, request.path, path);

    local function reply(status, data)
        return {
            status = status,
            headers = {
                ["Content-Type"] = "application/json",
                ["Access-Control-Allow-Origin"] = "*",
                ["Access-Control-Allow-Methods"] = "GET, POST, DELETE, OPTIONS",
                ["Access-Control-Allow-Headers"] = "Content-Type",
            },
            body = json.encode(data)
        };
    end

    -- 1. Health Check
    if path == "health" then
        return reply(200, {status = "ok"});
    end

    -- 2. List Users
    if path == "users" and request.method == "GET" then
        return reply(200, {users = {}}); -- Listing not supported for Supabase auth
    end

    -- 3. Individual User Operations
    local username = path:match("^users/([^/]+)$");
    if username then
        local host = module.host;

        if request.method == "GET" then
            if usermanager.user_exists(username, host) then
                return reply(200, {username = username, exists = true});
            end
            return reply(404, {error = "User not found"});
        end

        if request.method == "POST" then
            local data = json.decode(request.body);
            if not data or not data.password then
                return reply(400, {error = "Password required"});
            end
            local ok, err = usermanager.create_user(username, data.password, host);
            if ok then 
                return reply(201, {created = true}); 
            end
            return reply(409, {error = err or "Conflict"});
        end

        if request.method == "DELETE" then
            local ok = usermanager.delete_user(username, host);
            if ok then 
                return reply(200, {deleted = true}); 
            end
            return reply(404, {error = "User not found or could not be deleted"});
        end
    end

    if request.method == "OPTIONS" then
        return {
            status = 200,
            headers = {
                ["Access-Control-Allow-Origin"] = "*",
                ["Access-Control-Allow-Methods"] = "GET, POST, DELETE, OPTIONS",
                ["Access-Control-Allow-Headers"] = "Content-Type",
            },
            body = ""
        };
    end

    return reply(404, {error = "Not found", path_tried = path});
end

module:provides("http", {
    default_path = "/";
    route = {
        ["GET /health"] = function(event) return handle_request(event, "health") end;
        ["GET /users"] = function(event) return handle_request(event, "users") end;
        ["GET /users/*"] = function(event, path) return handle_request(event, "users/"..path) end;
        ["POST /users/*"] = function(event, path) return handle_request(event, "users/"..path) end;
        ["DELETE /users/*"] = function(event, path) return handle_request(event, "users/"..path) end;
        ["OPTIONS /*"] = function(event, path) return handle_request(event, path) end;
    };
});

module:log("info", "Admin HTTP API loaded");
