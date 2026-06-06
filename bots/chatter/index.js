import fs from 'fs';
import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { AetherBot } from 'aether-bot-sdk';

dotenv.config();

const PORT = parseInt(process.env.PORT || '4002', 10);
const API_URL = process.env.API_URL || 'http://localhost:8000';
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:0.5b';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const WEBHOOK_HOST = process.env.WEBHOOK_HOST || 'http://172.17.0.1';

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

// Track recent bot replies to avoid infinite loops
// roomName -> { lastMessageTime, messageCount }
const conversationMemory = {};

const bot = new AetherBot({
  name: 'ChatterManager',
  port: PORT,
  apiUrl: API_URL
});

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
    try {
      agents = JSON.parse(fs.readFileSync(file, 'utf8'));
      console.log('[Chatter] Loaded existing agents configuration.');
    } catch (err) {
      console.error('[Chatter] Failed to parse agents.json, starting fresh:', err.message);
      agents = {};
    }
  }

  for (const config of AGENTS_CONFIG) {
    let needsRegister = false;
    const expectedWebhookUrl = `${WEBHOOK_HOST}:${PORT}/webhook`;

    if (agents[config.name]) {
      // Validate with Supabase that the bot exists and is active
      const botId = agents[config.name].bot_id;
      const { data: dbBot, error: fetchError } = await supabase
        .from('bots')
        .select('*')
        .eq('id', botId)
        .eq('is_active', true)
        .maybeSingle();

      if (fetchError || !dbBot) {
        if (fetchError) {
          console.error(`[Chatter] Error checking database for agent ${config.name} (ID: ${botId}):`, fetchError.message || fetchError);
        }
        console.log(`[Chatter] Agent ${config.name} (ID: ${botId}) not found or inactive in database. Re-registering...`);
        needsRegister = true;
      } else {
        // Stored bot is valid, but check if webhook URL needs to be synchronized/updated
        if (dbBot.webhook_url !== expectedWebhookUrl) {
          console.log(`[Chatter] Syncing webhook URL for ${config.name} (ID: ${botId}) to ${expectedWebhookUrl}`);
          const { error: updateError } = await supabase
            .from('bots')
            .update({ webhook_url: expectedWebhookUrl })
            .eq('id', botId);
          if (updateError) {
            console.error(`[Chatter] Failed to update webhook URL for ${config.name}:`, updateError.message);
          }
        }
        agents[config.name].config = config;
      }
    } else {
      needsRegister = true;
    }

    if (needsRegister) {
      console.log(`[Chatter] Registering new agent: ${config.name}`);
      const res = await fetch(`${API_URL}/api/bots/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: config.name,
          description: config.description,
          emoji: config.emoji,
          webhook_url: expectedWebhookUrl,
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
    }

    // Register this agent inside the AetherBot SDK instance
    bot.addAgent({
      name: config.name,
      secret: agents[config.name].webhook_secret
    });

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
            await bot.sendMessage(room.name, text, agent.webhook_secret);
            conversationMemory[room.name] = { lastMessageTime: Date.now(), messageCount: 1 };
          }
        }
      }
    }
  } catch (err) {
    console.error('[Chatter] Wander loop error:', err.message);
  }
}

bot.on('message', async (message) => {
  const { id, body, roomName, sender, agentName, agentSecret } = message;

  // Don't reply to self or other bots blindly to avoid rapid infinite loops
  if (sender === agentName) {
    return; // Ignore our own messages
  } else if (Object.keys(agents).includes(sender)) {
    // 100% chance to reply to another bot
  } else if (sender === 'SwearShield') {
    return;
  }

  // Conversation tracking
  const mem = conversationMemory[roomName] || { lastMessageTime: 0, messageCount: 0 };
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
  const isMentioned = body.toLowerCase().includes(agentName.toLowerCase());
  if (!isMentioned && Math.random() > 0.5) {
    return;
  }

  console.log(`[Chatter] ${agentName} replying to ${sender} in #${roomName}`);
  const replyText = await generateReply(agents[agentName].config.prompt, `${sender} said: ${body}`);
  if (replyText) {
    await message.reply(replyText);
    mem.lastMessageTime = Date.now();
    mem.messageCount += 1;
    conversationMemory[roomName] = mem;
  }
});

// Start initialization and boot up server using the SDK
async function bootstrap() {
  await authenticateSupabase();
  await loadOrRegisterAgents();
  
  bot.start();

  // Wander loop every 10s
  setInterval(wanderLoop, 10_000);
  // Initial wander after 5s
  setTimeout(wanderLoop, 5_000);
}

bootstrap();
