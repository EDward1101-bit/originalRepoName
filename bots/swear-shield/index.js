import { AetherBot } from 'aether-bot-sdk';

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

const bot = new AetherBot({
  name: 'SwearShield',
  secret: BOT_SECRET,
  port: PORT,
  apiUrl: API_URL
});

bot.on('message', async (message) => {
  const { id, body, roomName, sender } = message;

  if (typeof body !== 'string' || sender === 'SwearShield') {
    return;
  }

  console.log(`[SwearShield] Checking message from ${sender} in #${roomName} using Ollama (${OLLAMA_MODEL})...`);

  try {
    // Prompting Ollama to filter the message
    const prompt = `You are a strict chat filter bot. Your task is to identify and censor EVERY SINGLE PROFANE OR OFFENSIVE WORD in the provided message. Replace EACH profane word with '*', based on the letter count of the word. If there are multiple swear words, you MUST replace all of them. If the message is completely clean, return it exactly as is. We enforce an EXTREMELY family-friendly environment. Return ONLY the final filtered message text. DO NOT add any line breaks or newlines unless they are in the original message. Do not add explanations, and do not put "Message: " before it.\n\nMessage: ${body}`;

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
    let cleaned = filtered.replace(/^"|"$/g, '').trim();

    // 4. Ensure no newlines are added if the original message had none
    if (!body.includes('\n') && cleaned.includes('\n')) {
      cleaned = cleaned.replace(/\n+/g, ' ');
    }

    if (cleaned !== body && cleaned.length > 0) {
      console.log(`[SwearShield] Profanity detected. Original: "${body}" -> Filtered: "${cleaned}"`);

      // Edit the message via the SDK's message.edit method
      await message.edit(cleaned);
      console.log(`[SwearShield] Message ${id} successfully edited.`);
    } else {
      console.log(`[SwearShield] Message is clean.`);
    }
  } catch (err) {
    console.error(`[SwearShield] Error processing message:`, err);
  }
});

bot.start();
