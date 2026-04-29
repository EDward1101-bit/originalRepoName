-- mod_online_rest.lua
-- Simple module to expose online users via HTTP

local json = require "util.json";
local sessions = prosody.full_sessions;

module:depends("http");

local function handle_get_online_users(event)
    local users = {};
    for jid, session in pairs(sessions) do
        local resources = {};
        if session.resource then
            table.insert(resources, session.resource);
        end
        table.insert(users, { jid = jid, resources = resources });
    end
    return {
        status_code = 200;
        headers = { ["Content-Type"] = "application/json" };
        body = json.encode({ users = users });
    };
end

module:provides("http", {
    route = {
        ["GET /online_users"] = handle_get_online_users;
    };
});
