import express from 'express';
import crypto from 'crypto';

// Use the secret provided by the user
const BOT_SECRET = process.env.BOT_SECRET || '82ad1c725ac496865d6e024f385e6f28d6a1effdb7954da39ff344eb8b3bbdb4';
// Use port 4001 to avoid conflicting with the example bot on 4000
const PORT = parseInt(process.env.PORT || '4001', 10);
const API_URL = process.env.API_URL || 'http://localhost:8000';

/**
 * Verify the X-Aether-Signature header against the request body.
 */
function verifySignature(secret, body, signature) {
  if (!secret) return true;

  // Recursively sort object keys so it matches Python's sort_keys=True
  function sortKeys(obj) {
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
      return obj;
    }
    return Object.keys(obj)
      .sort()
      .reduce((result, key) => {
        result[key] = sortKeys(obj[key]);
        return result;
      }, {});
  }

  const expected =
    'sha256=' +
    crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(sortKeys(body)))
      .digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature || ''));
  } catch {
    return false;
  }
}

const app = express();
app.use(express.json());

app.post('/webhook', async (req, res) => {
  const signature = req.headers['x-aether-signature'];

  if (!verifySignature(BOT_SECRET, req.body, signature)) {
    console.warn('[AndreiFilterBot] Rejected request: invalid signature');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // The webhook dispatcher now returns immediately, so we just acknowledge it
  res.json({ status: 'received' });

  const { event, message } = req.body;

  if (event !== 'message_create' || !message) {
    return;
  }

  const { id, body, room_name, sender } = message;

  if (typeof body !== 'string') {
    return;
  }

  // Ignore our own messages to prevent infinite loops
  if (sender === 'AndreiFilterBot') {
    return;
  }

  // Handle !ping command
  if (body.trim() === '!ping') {
    console.log(`[AndreiFilterBot] Received !ping from ${sender} in #${room_name}. Sending Pong!`);
    try {
      const sendRes = await fetch(`${API_URL}/api/bots/rooms/${room_name}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Aether-Secret': BOT_SECRET
        },
        body: JSON.stringify({ body: 'Pong!' })
      });
      if (!sendRes.ok) {
        console.error(`[AndreiFilterBot] Failed to send message: ${sendRes.status}`);
      }
    } catch (err) {
      console.error(`[AndreiFilterBot] Error calling send message REST API:`, err);
    }
    return; // Stop processing further for commands
  }

  // Replace every word sequence with 'andrei'
  const filtered = body.replace(/\b[A-Za-z0-9_']+\b/g, (match) => {
    if (match === match.toUpperCase() && match.length > 1) return 'ANDREI';
    if (match[0] === match[0].toUpperCase()) return 'Andrei';
    return 'andrei';
  });

  if (filtered !== body) {
    console.log(`[AndreiFilterBot] Filtering message from ${sender} in #${room_name}:`);
    console.log(`  Original: ${body}`);
    console.log(`  Filtered: ${filtered}`);

    try {
      // Async SDK: Edit the message via REST API
      const patchRes = await fetch(`${API_URL}/api/bots/messages/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Aether-Secret': BOT_SECRET
        },
        body: JSON.stringify({ body: filtered })
      });

      if (!patchRes.ok) {
        console.error(`[AndreiFilterBot] Failed to edit message: ${patchRes.status}`);
      } else {
        console.log(`[AndreiFilterBot] Message ${id} successfully edited.`);
      }
    } catch (err) {
      console.error(`[AndreiFilterBot] Error calling REST API:`, err);
    }
  }
});

app.get('/health', (_req, res) => res.json({ status: 'ok', bot: 'AndreiFilterBot' }));

app.listen(PORT, () => {
  console.log(`[AndreiFilterBot] Bot running on http://localhost:${PORT}`);
  console.log(`[AndreiFilterBot] Webhook endpoint: POST http://localhost:${PORT}/webhook`);
});
