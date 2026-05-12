import express from 'express';
import crypto from 'crypto';

/**
 * SwearShield — Ollama-powered Aether Bot
 * -----------------------------------
 * Filters profanity using a local Ollama LLM.
 */

const BOT_SECRET = process.env.BOT_SECRET || 'f3259af28fcd26fef3b520f62ab2203183b5e284b9df78454234fea1f06c55dd';
const PORT = parseInt(process.env.PORT || '4001', 10);
const API_URL = process.env.API_URL || 'http://localhost:8000';
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:7b';

if (!BOT_SECRET) {
  console.warn('[SwearShield] WARNING: BOT_SECRET is not set. Signature verification is disabled.');
}

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
    console.warn('[SwearShield] Rejected request: invalid signature');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Acknowledge the webhook immediately
  res.json({ status: 'received' });

  const { event, message } = req.body;
  if (event !== 'message_create' || !message) {
    return;
  }

  const { id, body, room_name, sender } = message;

  if (typeof body !== 'string' || sender === 'SwearShield') {
    return;
  }

  console.log(`[SwearShield] Checking message from ${sender} in #${room_name} using Ollama (${OLLAMA_MODEL})...`);

  try {
    // Prompting Ollama to filter the message
    const prompt = `You are a chat filter bot. Filter the following message to remove any profanity or highly offensive language. Replace profane words with '***'. If the message is clean, return it exactly as is. Keep in mind we want an EXTREMELY family friendly environment. Return ONLY the final message text, nothing else. THIS IS VERY IMPORTANT. Return ONLY THE FINAL TEXT! Do not put "Message: " before it.\n\nMessage: ${body}`;

    const ollamaRes = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt: prompt,
        stream: false
      })
    });

    if (!ollamaRes.ok) {
      console.error(`[SwearShield] Ollama error: ${ollamaRes.status} ${ollamaRes.statusText}`);
      return;
    }

    const data = await ollamaRes.json();
    let filtered = data.response.trim();

    // 1. Strip thinking blocks if present (for thinking models)
    filtered = filtered.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

    // 2. Strip common prefixes that LLMs sometimes hallucinate
    filtered = filtered.replace(/^(Message|Filtered Message|Output|Result):\s*/i, '').trim();

    // 3. Remove any potential quotes or leading/trailing noise
    const cleaned = filtered.replace(/^"|"$/g, '').trim();

    if (cleaned !== body && cleaned.length > 0) {
      console.log(`[SwearShield] Profanity detected. Original: "${body}" -> Filtered: "${cleaned}"`);

      const patchRes = await fetch(`${API_URL}/api/bots/messages/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Aether-Secret': BOT_SECRET
        },
        body: JSON.stringify({ body: cleaned })
      });

      if (!patchRes.ok) {
        console.error(`[SwearShield] Failed to edit message: ${patchRes.status}`);
      }
    } else {
      console.log(`[SwearShield] Message is clean.`);
    }
  } catch (err) {
    console.error(`[SwearShield] Error processing message:`, err);
  }
});

app.get('/health', (_req, res) => res.json({ status: 'ok', bot: 'SwearShield' }));

// ── Heartbeat: keep the bot marked as "online" on the backend ────────────────
async function sendHeartbeat() {
  if (!BOT_SECRET) return;
  try {
    const res = await fetch(`${API_URL}/api/bots/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Aether-Secret': BOT_SECRET,
      },
    });
    if (!res.ok) {
      console.warn(`[SwearShield] Heartbeat failed: ${res.status}`);
    }
  } catch (err) {
    console.warn(`[SwearShield] Heartbeat error:`, err.message);
  }
}

app.listen(PORT, () => {
  console.log(`[SwearShield] Bot running on http://localhost:${PORT}`);
  console.log(`[SwearShield] Webhook endpoint: POST http://localhost:${PORT}/webhook`);

  // Send initial heartbeat immediately, then every 30 seconds
  sendHeartbeat();
  setInterval(sendHeartbeat, 30_000);
});
