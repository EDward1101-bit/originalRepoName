-- mod_admin_net - HTTP API for user management
-- Allows HTTP requests to manage users via Prosody

local jid = require "util.jid";
local json = require "cjson";
local http = require "net.http";
local usermanager = require "core.usermanager";

local function handle_request(event)
    local request = event.request;
    local path = event.path;
    
    -- Set CORS headers
    local response = {
        headers = {
            ["Content-Type"] = "application/json";
            ["Access-Control-Allow-Origin"] = "*";
            ["Access-Control-Allow-Methods"] = "GET, POST, DELETE, OPTIONS";
            ["Access-Control-Allow-Headers"] = "Content-Type, Authorization";
        }
    };
    
    -- Handle OPTIONS for CORS preflight
    if request.method == "OPTIONS" then
        return 200, response, "{}";
    end
    
    -- Health check endpoint
    if path == "/health" or path == "/health/" then
        return 200, response, json.encode({status = "ok"});
    end
    
    -- User management endpoints
    local user_path = "^/users/?(.*)$";
    local user_match = path:match(user_path);
    
    if user_match then
        local user_jid = user_match;
        
        -- GET /users - List all users
        if request.method == "GET" and user_jid == "" then
            local users = {};
            local host = "localhost";
            
            -- Get all users from user manager
            for user in usermanager.users(host) do
                table.insert(users, {
                    username = user,
                    jid = user .. "@" .. host
                });
            end
            
            return 200, response, json.encode({users = users});
        end
        
        -- GET /users/{username} - Get user info
        if request.method == "GET" and user_jid ~= "" then
            local username = user_jid;
            local host = "localhost";
            
            local exists = usermanager.user_exists(username, host);
            if exists then
                return 200, response, json.encode({
                    username = username,
                    jid = username .. "@" .. host,
                    exists = true
                });
            else
                return 404, response, json.encode({error = "User not found"});
            end
        end
        
        -- POST /users/{username} - Create user
        if request.method == "POST" and user_jid ~= "" then
            local body = request.body;
            local ok, data = pcall(json.decode, body);
            
            if not ok then
                return 400, response, json.encode({error = "Invalid JSON"});
            end
            
            local username = user_jid;
            local password = data.password;
            local host = "localhost";
            
            if not password then
                return 400, response, json.encode({error = "Password required"});
            end
            
            local success, err = usermanager.create_user(username, password, host);
            
            if success then
                return 201, response, json.encode({
                    username = username,
                    jid = username .. "@" .. host,
                    created = true
                });
            else
                return 409, response, json.encode({error = err or "Failed to create user"});
            end
        end
        
        -- DELETE /users/{username} - Delete user
        if request.method == "DELETE" and user_jid ~= "" then
            local username = user_jid;
            local host = "localhost";
            
            local success = usermanager.delete_user(username, host);
            
            if success then
                return 200, response, json.encode({
                    username = username,
                    deleted = true
                });
            else
                return 404, response, json.encode({error = "User not found"});
            end
        end
    end
    
    -- Auth endpoint for JWT validation
    local auth_path = "^/auth/?$";
    if path:match(auth_path) and request.method == "POST" then
        local body = request.body;
        local ok, data = pcall(json.decode, body);
        
        if not ok then
            return 400, response, json.encode({error = "Invalid JSON"});
        end
        
        local username = data.username;
        local host = data.host or "localhost";
        
        if not username then
            return 400, response, json.encode({error = "Username required"});
        end
        
        local exists = usermanager.user_exists(username, host);
        return 200, response, json.encode({exists = exists});
    end
    
    -- 404 for unknown paths
    return 404, response, json.encode({error = "Not found"});
end

module:provides("http", {
    default_path = "/";
    route = {
        ["GET /health"] = function(event) return handle_request(event); end;
        ["GET /users"] = function(event) return handle_request(event); end;
        ["GET /users/*"] = function(event) return handle_request(event); end;
        ["POST /users/*"] = function(event) return handle_request(event); end;
        ["DELETE /users/*"] = function(event) return handle_request(event); end;
        ["POST /auth"] = function(event) return handle_request(event); end;
        ["OPTIONS /*"] = function(event) return handle_request(event); end;
    };
});

module:log("info", "Admin HTTP API loaded");
