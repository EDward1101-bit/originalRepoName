const globalHostname = window.location.hostname || 'localhost';

// Port 8085 is where Nginx is listening.
// If we are on port 8085, it means we are going through the proxy.
export const API_URL = 
  (window.location.port === '8085')
    ? `${window.location.protocol}//${globalHostname}:8085`
    : (globalHostname === 'localhost' || globalHostname === '127.0.0.1')
      ? `http://${globalHostname}:8000`
      : `${window.location.origin}`;

// Prosody and the frontend MUST agree on the domain name for JIDs.
// Using 'localhost' is fine for local dev, but it must be consistent.
const DEFAULT_XMPP_DOMAIN = globalHostname;

// Use the global hostname if the env variable is set to localhost, to allow local network access
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
