import express from 'express';
import crypto from 'crypto';

// Use the secret provided by the user
const BOT_SECRET = process.env.BOT_SECRET || '6c25d37b8882a27e0b97a31c679a3e21acdd947d24ad2c71585aad2fd35ef344';
// Use port 4001 to avoid conflicting with the example bot on 4000
const PORT = parseInt(process.env.PORT || '4001', 10);

/**
 * Verify the X-Aether-Signature header against the request body.
 */
function verifySignature(secret, body, signature) {
  if (!secret) return true;
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

app.post('/webhook', (req, res) => {
  const signature = req.headers['x-aether-signature'];

  if (!verifySignature(BOT_SECRET, req.body, signature)) {
    console.warn('[AndreiFilterBot] Rejected request: invalid signature');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const { body, room_name, sender } = req.body;

  if (typeof body !== 'string') {
    return res.status(400).json({ error: 'Missing body field' });
  }

  // Replace every word sequence with 'andrei'
  // using \p{L} so it catches words even with accents/unicode letters if present.
  // We'll keep it simple: \w+ matches A-Z, a-z, 0-9, _
  const filtered = body.replace(/\b[A-Za-z0-9_']+\b/g, (match) => {
    // Preserve case of the original word if possible
    if (match === match.toUpperCase() && match.length > 1) return 'ANDREI';
    if (match[0] === match[0].toUpperCase()) return 'Andrei';
    return 'andrei';
  });

  console.log(`[AndreiFilterBot] Filtered message from ${sender} in #${room_name}:`);
  console.log(`  Original: ${body}`);
  console.log(`  Filtered: ${filtered}`);

  res.json({ body: filtered });
});

app.get('/health', (_req, res) => res.json({ status: 'ok', bot: 'AndreiFilterBot' }));

app.listen(PORT, () => {
  console.log(`[AndreiFilterBot] Bot running on http://localhost:${PORT}`);
  console.log(`[AndreiFilterBot] Webhook endpoint: POST http://localhost:${PORT}/webhook`);
});
