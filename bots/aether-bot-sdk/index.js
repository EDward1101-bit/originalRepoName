import express from 'express';
import crypto from 'crypto';
import EventEmitter from 'events';

export class AetherBot extends EventEmitter {
  constructor(options = {}) {
    super();
    this.name = options.name || 'AetherBot';
    this.secret = options.secret || process.env.BOT_SECRET;
    this.apiUrl = options.apiUrl || process.env.API_URL || 'http://localhost:8000';
    this.port = parseInt(options.port || process.env.PORT || '4000', 10);
    this.path = options.path || '/webhook';

    // Support for multi-agent setups (e.g. Chatter bot)
    this.agents = {}; // name -> { name, secret }
    this.agentsBySecret = {}; // secret -> { name, secret }

    this.app = express();
    this.app.use(express.json());
    this._setupRoutes();
  }

  /**
   * Register a sub-agent with its own secret (for multi-agent bots).
   */
  addAgent({ name, secret }) {
    if (!name || !secret) {
      throw new Error('[AetherBot] addAgent requires both a name and a secret.');
    }
    this.agents[name] = { name, secret };
    this.agentsBySecret[secret] = { name, secret };
    console.log(`[${this.name}] Registered sub-agent: ${name}`);
  }

  _verifySignature(secret, body, signature) {
    if (!secret) return true;

    const expected =
      'sha256=' +
      crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(body))
        .digest('hex');

    try {
      return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature || ''));
    } catch {
      return false;
    }
  }

  _setupRoutes() {
    // Webhook endpoint
    this.app.post(this.path, async (req, res) => {
      const signature = req.headers['x-aether-signature'];
      let targetAgentName = this.name;
      let targetAgentSecret = this.secret;

      // Multi-agent routing logic
      const agentSecrets = Object.keys(this.agentsBySecret);
      if (agentSecrets.length > 0) {
        let matchedAgent = null;
        for (const sec of agentSecrets) {
          if (this._verifySignature(sec, req.body, signature)) {
            matchedAgent = this.agentsBySecret[sec];
            break;
          }
        }
        if (!matchedAgent) {
          console.warn(`[${this.name}] Webhook signature verification failed for all registered agents.`);
          return res.status(401).json({ error: 'Invalid signature' });
        }
        targetAgentName = matchedAgent.name;
        targetAgentSecret = matchedAgent.secret;
      } else {
        // Single bot signature verification
        if (!this._verifySignature(this.secret, req.body, signature)) {
          console.warn(`[${this.name}] Webhook signature verification failed.`);
          return res.status(401).json({ error: 'Invalid signature' });
        }
      }

      // Acknowledge the webhook immediately as expected by the Aether backend
      res.json({ status: 'received' });

      const { event, message } = req.body;
      if (event === 'message_create' && message) {
        const { id, body, room_name, sender, timestamp } = message;

        // Construct high-level message object with convenient methods
        const sdkMessage = {
          id,
          body,
          roomName: room_name,
          sender,
          timestamp,
          agentName: targetAgentName,
          agentSecret: targetAgentSecret,
          raw: message,

          // Edit this specific message using the correct secret
          edit: async (newBody) => {
            const editRes = await fetch(`${this.apiUrl}/api/bots/messages/${id}`, {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                'X-Aether-Secret': targetAgentSecret
              },
              body: JSON.stringify({ body: newBody })
            });
            if (!editRes.ok) {
              throw new Error(`[${targetAgentName}] Failed to edit message: ${editRes.status}`);
            }
            return editRes.json();
          },

          // Delete this specific message
          delete: async () => {
            const delRes = await fetch(`${this.apiUrl}/api/bots/messages/${id}`, {
              method: 'DELETE',
              headers: {
                'X-Aether-Secret': targetAgentSecret
              }
            });
            if (!delRes.ok) {
              throw new Error(`[${targetAgentName}] Failed to delete message: ${delRes.status}`);
            }
            return delRes.json();
          },

          // Reply in the room this message was sent to
          reply: async (replyText) => {
            const replyRes = await fetch(`${this.apiUrl}/api/bots/rooms/${encodeURIComponent(room_name)}/messages`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Aether-Secret': targetAgentSecret
              },
              body: JSON.stringify({ body: replyText })
            });
            if (!replyRes.ok) {
              throw new Error(`[${targetAgentName}] Failed to send reply message: ${replyRes.status}`);
            }
            return replyRes.json();
          }
        };

        this.emit('message', sdkMessage);
      }
    });

    // Health check endpoint
    this.app.get('/health', (_req, res) => {
      res.json({ status: 'ok', bot: this.name, agents: Object.keys(this.agents) });
    });
  }

  /**
   * Sends heartbeat for a specific secret to keep the bot marked online.
   */
  async _sendHeartbeatForSecret(secret, botName) {
    if (!secret) return;
    try {
      const res = await fetch(`${this.apiUrl}/api/bots/heartbeat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Aether-Secret': secret,
        },
      });
      if (!res.ok) {
        console.warn(`[${botName}] Heartbeat failed: ${res.status}`);
      }
    } catch (err) {
      console.warn(`[${botName}] Heartbeat error:`, err.message);
    }
  }

  /**
   * Dispatches heartbeat(s) for the default secret or all sub-agents.
   */
  async sendHeartbeats() {
    const agentsList = Object.values(this.agents);
    if (agentsList.length > 0) {
      for (const agent of agentsList) {
        await this._sendHeartbeatForSecret(agent.secret, agent.name);
      }
    } else if (this.secret) {
      await this._sendHeartbeatForSecret(this.secret, this.name);
    }
  }

  /**
   * Helper to proactively send a message to a room.
   */
  async sendMessage(roomName, body, secret = this.secret) {
    if (!secret) {
      throw new Error(`[${this.name}] Cannot send message: no secret provided.`);
    }
    const res = await fetch(`${this.apiUrl}/api/bots/rooms/${encodeURIComponent(roomName)}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Aether-Secret': secret
      },
      body: JSON.stringify({ body })
    });
    if (!res.ok) {
      throw new Error(`[${this.name}] Failed to send proactive message: ${res.status}`);
    }
    return res.json();
  }

  /**
   * Start the bot's HTTP server and heartbeat routines.
   */
  start() {
    this.app.listen(this.port, () => {
      console.log(`[${this.name}] AetherBot running on http://localhost:${this.port}`);
      console.log(`[${this.name}] Webhook path: POST http://localhost:${this.port}${this.path}`);

      // Dispatch initial heartbeats immediately
      this.sendHeartbeats();

      // Schedule periodic heartbeats every 30 seconds
      this.heartbeatInterval = setInterval(() => this.sendHeartbeats(), 30_000);

      this.emit('ready');
    });
  }

  /**
   * Clean up background resources.
   */
  stop() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
  }
}
