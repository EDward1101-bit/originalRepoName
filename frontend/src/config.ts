const globalHostname = window.location.hostname || import.meta.env.VITE_SERVER_HOSTNAME || 'localhost';

// Use port 8000 for local development (when not using Nginx)
// Use the current origin + /api when running behind Nginx (port 8085 or remote)
const DEFAULT_HTTP_API_URL = 
  (globalHostname === 'localhost' || globalHostname === '127.0.0.1') && window.location.port !== '8085'
    ? `http://${globalHostname}:8000`
    : `${window.location.origin}/api`;

const DEFAULT_XMPP_DOMAIN = globalHostname;

// Use the global hostname if the env variable is set to localhost, to allow local network access
export const API_URL = import.meta.env.VITE_API_URL && !import.meta.env.VITE_API_URL.includes('localhost') ? import.meta.env.VITE_API_URL : DEFAULT_HTTP_API_URL;
export const XMPP_DOMAIN = import.meta.env.VITE_XMPP_DOMAIN && !import.meta.env.VITE_XMPP_DOMAIN.includes('localhost') ? import.meta.env.VITE_XMPP_DOMAIN : DEFAULT_XMPP_DOMAIN;
export const MUC_DOMAIN = import.meta.env.VITE_XMPP_MUC_DOMAIN || `conference.${XMPP_DOMAIN}`;

export function buildApiUrl(path: string): string {
  return new URL(path, API_URL).toString();
}

export function buildBareJid(username: string): string {
  return `${username}@${XMPP_DOMAIN}`;
}

export function buildRoomJid(roomName: string): string {
  return `${roomName}@${MUC_DOMAIN}`;
}
