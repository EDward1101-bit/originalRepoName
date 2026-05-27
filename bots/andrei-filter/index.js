import { AetherBot } from 'aether-bot-sdk';

const BOT_SECRET = process.env.BOT_SECRET || '82ad1c725ac496865d6e024f385e6f28d6a1effdb7954da39ff344eb8b3bbdb4';
const PORT = parseInt(process.env.PORT || '4001', 10);
const API_URL = process.env.API_URL || 'http://localhost:8000';

const bot = new AetherBot({
  name: 'AndreiFilterBot',
  secret: BOT_SECRET,
  port: PORT,
  apiUrl: API_URL
});

bot.on('message', async (message) => {
  const { id, body, roomName, sender } = message;

  if (typeof body !== 'string' || sender === 'AndreiFilterBot') {
    return;
  }

  // Handle !ping command
  if (body.trim() === '!ping') {
    console.log(`[AndreiFilterBot] Received !ping from ${sender} in #${roomName}. Sending Pong!`);
    try {
      await message.reply('Pong!');
    } catch (err) {
      console.error(`[AndreiFilterBot] Error sending Pong! message:`, err);
    }
    return;
  }

  // Replace every word sequence with 'andrei'
  const filtered = body.replace(/\b[A-Za-z0-9_']+\b/g, (match) => {
    if (match === match.toUpperCase() && match.length > 1) return 'ANDREI';
    if (match[0] === match[0].toUpperCase()) return 'Andrei';
    return 'andrei';
  });

  if (filtered !== body) {
    console.log(`[AndreiFilterBot] Filtering message from ${sender} in #${roomName}:`);
    console.log(`  Original: ${body}`);
    console.log(`  Filtered: ${filtered}`);

    try {
      await message.edit(filtered);
      console.log(`[AndreiFilterBot] Message ${id} successfully edited.`);
    } catch (err) {
      console.error(`[AndreiFilterBot] Error calling edit message REST API:`, err);
    }
  }
});

bot.start();
