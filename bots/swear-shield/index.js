/**
 * SwearShield — Example Aether Bot
 * -----------------------------------
 * A minimal webhook server that filters swear words from room messages.
 * This is the reference implementation for building Aether bots.
 *
 * Setup:
 *   1. npm install
 *   2. Register this bot via the Aether BotsPage (set webhook URL to your server's /webhook)
 *   3. Copy the webhook_secret you receive
 *   4. BOT_SECRET=<your_secret> PORT=4000 node index.js
 *
 * How it works:
 *   - Aether POSTs every room message to POST /webhook
 *   - The payload is signed with HMAC-SHA256 using your BOT_SECRET
 *   - This bot verifies the signature, filters the text, and returns { body: filteredText }
 *   - Aether stores the returned body instead of the original
 */

import express from 'express';
import crypto from 'crypto';

const BOT_SECRET = process.env.BOT_SECRET || '';
const PORT = parseInt(process.env.PORT || '4000', 10);

if (!BOT_SECRET) {
  console.warn('[SwearShield] WARNING: BOT_SECRET is not set. Signature verification is disabled.');
}

// Words to censor — extend as needed
const SWEAR_PATTERN =
  /\b(shit|fuck|crap|ass|damn|bitch|bastard|piss|cock|cunt|dick|prick|twat|wanker|bollocks)\b/gi;

/**
 * Verify the X-Aether-Signature header against the request body.
 * Aether signs: HMAC-SHA256(secret, JSON.stringify(payload, sorted keys))
 */
function verifySignature(secret, body, signature) {
  if (!secret) return true; // skip verification if no secret configured
  const expected =
    'sha256=' +
    crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(body, Object.keys(body).sort()))
      .digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature || ''));
  } catch {
    return false;
  }
}

const app = express();
app.use(express.json());

/**
 * POST /webhook
 *
 * Incoming payload:
 *   { body: string, room_name: string, sender: string, timestamp: number }
 * Headers:
 *   X-Aether-Signature: sha256=<hmac>
 *
 * Response:
 *   { body: string }   — the filtered message text
 */
app.post('/webhook', (req, res) => {
  const signature = req.headers['x-aether-signature'];

  if (!verifySignature(BOT_SECRET, req.body, signature)) {
    console.warn('[SwearShield] Rejected request: invalid signature');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const { body, room_name, sender } = req.body;

  if (typeof body !== 'string') {
    return res.status(400).json({ error: 'Missing body field' });
  }

  const filtered = body.replace(SWEAR_PATTERN, '***');

  if (filtered !== body) {
    console.log(`[SwearShield] Filtered message from ${sender} in #${room_name}`);
  }

  res.json({ body: filtered });
});

app.get('/health', (_req, res) => res.json({ status: 'ok', bot: 'SwearShield' }));

app.listen(PORT, () => {
  console.log(`[SwearShield] Bot running on http://localhost:${PORT}`);
  console.log(`[SwearShield] Webhook endpoint: POST http://localhost:${PORT}/webhook`);
});
