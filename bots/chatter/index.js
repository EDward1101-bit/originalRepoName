import express from 'express';
import crypto from 'crypto';
import fs from 'fs';
import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const PORT = parseInt(process.env.PORT || '4002', 10);
const API_URL = process.env.API_URL || 'http://localhost:8000';
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:7b';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const WEBHOOK_HOST = process.env.WEBHOOK_HOST || 'http://172.17.0.1'; // docker host IP or container name

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('[Chatter] Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const AGENTS_CONFIG = [
  {
    name: 'Grumps',
    emoji: '😠',
    description: 'A grumpy old man who complains about everything.',
    prompt: `You are Grumps, a grumpy, cynical old man. You complain about modern technology, kids these days, and everything in general. You are currently chatting in a group chat. Keep your responses short (1-3 sentences) and always sound annoyed. Do not be overly helpful. Do not output anything like "Message:" or quotation marks, just your raw conversational reply.`
  },
  {
    name: 'Zappy',
    emoji: '⚡',
    description: 'A Gen Alpha kid with lots of brainrot.',
    prompt: `You are Zappy, a Gen Alpha kid with absolute brainrot. You use slang like skibidi, rizz, ohio, sigma, cap, fanum tax, gyatt. You are currently chatting in a group chat. Keep your responses short (1-3 sentences) and act like a chaotic, chronically online kid! Do not output anything like "Message:" or quotation marks, just your raw conversational reply.`
  }
];

let agents = {};
let agentsBySecret = {};

// Track recent bot replies to avoid infinite loops
// roomName -> { lastMessageTime, messageCount }
const conversationMemory = {};

async function authenticateSupabase() {
  const email = 'chatter_system@example.com';
  const password = 'password123';
  await supabase.auth.signUp({
    email, password, options: { data: { username: 'chatter_system' } }
  });
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    console.error('[Chatter] Failed to authenticate with Supabase:', error.message);
  } else {
    console.log('[Chatter] Authenticated with Supabase to bypass RLS.');
  }
}

function verifySignature(secret, body, signature) {
  if (!secret) return true;
  function sortKeys(obj) {
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return obj;
    return Object.keys(obj).sort().reduce((result, key) => {
      result[key] = sortKeys(obj[key]);
      return result;
    }, {});
  }
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(JSON.stringify(sortKeys(body))).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature || ''));
  } catch {
    return false;
  }
}

async function generateReply(prompt, userMessage) {
  const fullPrompt = `${prompt}\n\nRecent message to reply to:\n"${userMessage}"\n\nYour response:`;
  try {
    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt: fullPrompt,
        stream: false
      })
    });
    if (!res.ok) return null;
    const data = await res.json();
    let text = data.response.trim();
    text = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    return text.replace(/^"|"$/g, '').trim();
  } catch (err) {
    console.error('[Chatter] Ollama error:', err.message);
    return null;
  }
}

async function loadOrRegisterAgents() {
  const file = process.env.AGENTS_FILE || 'agents.json';
  if (fs.existsSync(file)) {
    agents = JSON.parse(fs.readFileSync(file, 'utf8'));
    console.log('[Chatter] Loaded existing agents configuration.');
  }

  for (const config of AGENTS_CONFIG) {
    if (!agents[config.name]) {
      console.log(`[Chatter] Registering new agent: ${config.name}`);
      const res = await fetch(`${API_URL}/api/bots/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: config.name,
          description: config.description,
          emoji: config.emoji,
          webhook_url: `${WEBHOOK_HOST}:${PORT}/webhook`,
          owner_username: 'system'
        })
      });

      if (!res.ok) {
        console.error(`[Chatter] Failed to register ${config.name}`);
        continue;
      }
      const data = await res.json();
      agents[config.name] = {
        bot_id: data.bot_id,
        webhook_secret: data.webhook_secret,
        config: config
      };
      fs.writeFileSync(file, JSON.stringify(agents, null, 2));
    } else {
      agents[config.name].config = config;
    }

    // Clean up any duplicate active registrations with the same name in the DB
    const botId = agents[config.name].bot_id;
    const { error: cleanError } = await supabase
      .from('bots')
      .update({ is_active: false })
      .eq('name', config.name)
      .neq('id', botId);
    if (cleanError) {
      console.error(`[Chatter] Error cleaning duplicate bots for ${config.name}:`, cleanError.message);
    } else {
      console.log(`[Chatter] Cleaned stale duplicate bots for ${config.name}`);
    }
  }

  agentsBySecret = Object.values(agents).reduce((acc, a) => {
    acc[a.webhook_secret] = a;
    return acc;
  }, {});
}

async function sendBotMessage(roomName, agent, text) {
  try {
    await fetch(`${API_URL}/api/bots/rooms/${encodeURIComponent(roomName)}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Aether-Secret': agent.webhook_secret
      },
      body: JSON.stringify({ body: text })
    });
  } catch (err) {
    console.error(`[Chatter] Failed to send message in ${roomName}:`, err.message);
  }
}

async function wanderLoop() {
  try {
    // Fetch public rooms (not starting with e2e_)
    const { data: rooms } = await supabase.from('rooms').select('id, name');
    if (!rooms) return;
    const publicRooms = rooms.filter(r => !r.name.startsWith('e2e_'));

    for (const agentName of Object.keys(agents)) {
      const agent = agents[agentName];
      // Fetch rooms this bot is in
      const { data: roomBots } = await supabase.from('room_bots').select('room_id').eq('bot_id', agent.bot_id);
      const joinedRoomIds = new Set((roomBots || []).map(rb => rb.room_id));
      
      for (const room of publicRooms) {
        // 20% chance to join a public room if not in it
        if (!joinedRoomIds.has(room.id) && Math.random() < 0.2) {
          console.log(`[Chatter] ${agentName} joining room ${room.name}`);
          const { error } = await supabase.from('room_bots').insert({ room_id: room.id, bot_id: agent.bot_id, invited_by: 'chatter_system' });
          if (error) console.error(`[Chatter] Error joining room: ${error.message}`);
          joinedRoomIds.add(room.id);
        }
        // 0.5% chance to leave a room
        else if (joinedRoomIds.has(room.id) && Math.random() < 0.005) {
          console.log(`[Chatter] ${agentName} leaving room ${room.name}`);
          await supabase.from('room_bots').delete().eq('room_id', room.id).eq('bot_id', agent.bot_id);
          joinedRoomIds.delete(room.id);
        }
        
        // 2% chance to start a conversation if they are in the room
        if (joinedRoomIds.has(room.id) && Math.random() < 0.02) {
          const { data: messages } = await supabase.from('room_messages').select('sender, body').eq('room_id', room.id).order('created_at', { ascending: false }).limit(1);
          let prompt = `${agent.config.prompt}\n\n`;
          let context = "";
          
          if (messages && messages.length > 0 && messages[0].sender !== agentName) {
             prompt += "Read the last message sent in the room, and reply to it organically to restart the conversation. Do NOT say hello, welcome, or greet anyone. Just dive straight into the response.";
             context = `${messages[0].sender} said: ${messages[0].body}`;
          } else {
             prompt += "Send a completely random thought about something you did recently or an opinion you have. Do NOT say hello, welcome, or greet anyone. Just dive straight into talking.";
          }

          const text = await generateReply(prompt, context);
          if (text) {
            console.log(`[Chatter] ${agentName} starting conversation in ${room.name}`);
            await sendBotMessage(room.name, agent, text);
            conversationMemory[room.name] = { lastMessageTime: Date.now(), messageCount: 1 };
          }
        }
      }
    }
  } catch (err) {
    console.error('[Chatter] Wander loop error:', err.message);
  }
}

const app = express();
app.use(express.json());

app.post('/webhook', async (req, res) => {
  const signature = req.headers['x-aether-signature'];
  
  // Find which agent this webhook is for
  let targetAgent = null;
  for (const secret of Object.keys(agentsBySecret)) {
    if (verifySignature(secret, req.body, signature)) {
      targetAgent = agentsBySecret[secret];
      break;
    }
  }

  if (!targetAgent) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  res.json({ status: 'received' });

  const { event, message } = req.body;
  if (event !== 'message_create' || !message || !message.body) return;

  const { room_name, sender, body } = message;

  // Don't reply to self or other bots blindly to avoid rapid infinite loops
  if (sender === targetAgent.config.name) {
    return; // Ignore our own messages
  } else if (Object.keys(agents).includes(sender)) {
    // 100% chance to reply to another bot
  } else if (sender === 'SwearShield') {
    return;
  }

  // Conversation tracking
  const mem = conversationMemory[room_name] || { lastMessageTime: 0, messageCount: 0 };
  const now = Date.now();
  if (now - mem.lastMessageTime > 60000) {
    // reset if more than 60s
    mem.messageCount = 0;
  }
  
  // Throttling: Stop replying if the bot has already talked a lot recently in this room
  if (mem.messageCount > 5) {
    // Cool down
    return;
  }

  // General probability to reply to a normal user message (50%)
  // If mentioned directly, 100% chance to reply
  const isMentioned = body.toLowerCase().includes(targetAgent.config.name.toLowerCase());
  if (!isMentioned && Math.random() > 0.5) {
    return;
  }

  console.log(`[Chatter] ${targetAgent.config.name} replying to ${sender} in #${room_name}`);
  const replyText = await generateReply(targetAgent.config.prompt, `${sender} said: ${body}`);
  if (replyText) {
    await sendBotMessage(room_name, targetAgent, replyText);
    mem.lastMessageTime = Date.now();
    mem.messageCount += 1;
    conversationMemory[room_name] = mem;
  }
});

// Heartbeat
async function sendHeartbeats() {
  for (const agent of Object.values(agents)) {
    try {
      await fetch(`${API_URL}/api/bots/heartbeat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Aether-Secret': agent.webhook_secret
        }
      });
    } catch {}
  }
}

app.listen(PORT, async () => {
  console.log(`[Chatter] Server running on port ${PORT}`);
  await authenticateSupabase();
  await loadOrRegisterAgents();
  
  sendHeartbeats();
  setInterval(sendHeartbeats, 30_000);
  
  // Wander loop every 10s
  setInterval(wanderLoop, 10_000);
  // Initial wander after 5s
  setTimeout(wanderLoop, 5_000);
});
